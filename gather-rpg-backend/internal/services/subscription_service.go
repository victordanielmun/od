package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// premiumCacheTTL bounds how long a cached premium/free verdict is trusted before
// we re-read the subscriptions table. Mission listing/accept checks premium on
// nearly every request, so — mirroring the throttle in the auth middleware — we
// avoid a DB round-trip per call while still reflecting a new subscription within
// a minute or two.
const premiumCacheTTL = 90 * time.Second

type premiumCacheEntry struct {
	isPremium bool
	at        time.Time
}

// SubscriptionService owns Wompi billing and the local mirror of subscription
// state. Wompi has no native subscription object, so this service also drives the
// recurrence: it stores the reusable payment source and charges it again when a
// period lapses (ChargeDueSubscriptions, run by the scheduler).
type SubscriptionService struct {
	cfg          *config.Config
	http         *http.Client
	premiumCache sync.Map // userID(string) -> premiumCacheEntry
}

func NewSubscriptionService(cfg *config.Config) *SubscriptionService {
	return &SubscriptionService{
		cfg:  cfg,
		http: &http.Client{Timeout: 20 * time.Second},
	}
}

// ── Premium checks ──────────────────────────────────────────────────────────

// IsUserPremium reports whether the user currently has an active membership.
// Result is cached for premiumCacheTTL to keep the hot mission path cheap.
func (s *SubscriptionService) IsUserPremium(userID uuid.UUID) bool {
	key := userID.String()
	if v, ok := s.premiumCache.Load(key); ok {
		e := v.(premiumCacheEntry)
		if time.Since(e.at) < premiumCacheTTL {
			return e.isPremium
		}
	}
	var sub models.Subscription
	err := database.DB.Where("user_id = ?", userID).First(&sub).Error
	isPremium := err == nil && sub.IsActive()
	s.premiumCache.Store(key, premiumCacheEntry{isPremium: isPremium, at: time.Now()})
	return isPremium
}

func (s *SubscriptionService) invalidatePremiumCache(userID uuid.UUID) {
	s.premiumCache.Delete(userID.String())
}

// GetSubscription returns the user's local subscription row (nil if none).
func (s *SubscriptionService) GetSubscription(userID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	if err := database.DB.Where("user_id = ?", userID).First(&sub).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

// ── Frontend config ─────────────────────────────────────────────────────────

// PublicConfig is the data the checkout page needs to tokenize a card and show
// the price. The public key and acceptance tokens are safe to expose.
type PublicConfig struct {
	APIBase              string `json:"api_base"` // where the frontend tokenizes the card
	PublicKey            string `json:"public_key"`
	AcceptanceToken      string `json:"acceptance_token"`
	AcceptPersonalAuth   string `json:"accept_personal_auth"`
	AmountInCents        int64  `json:"amount_in_cents"`
	Currency             string `json:"currency"`
	PermalinkAcceptance  string `json:"permalink_acceptance,omitempty"`
	PermalinkPersonalDat string `json:"permalink_personal_data,omitempty"`
}

func (s *SubscriptionService) GetPublicConfig() (*PublicConfig, error) {
	acc, err := s.getAcceptanceTokens()
	if err != nil {
		return nil, err
	}
	return &PublicConfig{
		APIBase:              s.cfg.WompiBaseURL,
		PublicKey:            s.cfg.WompiPublicKey,
		AcceptanceToken:      acc.acceptanceToken,
		AcceptPersonalAuth:   acc.personalDataToken,
		AmountInCents:        s.cfg.MembershipAmountCents,
		Currency:             s.cfg.MembershipCurrency,
		PermalinkAcceptance:  acc.acceptancePermalink,
		PermalinkPersonalDat: acc.personalDataPermalink,
	}, nil
}

// ── Subscribe (register card + first charge) ────────────────────────────────

// Subscribe registers the user's card as a reusable payment source and issues the
// first membership charge. The card itself is tokenized client-side (Wompi public
// key) so the PAN never reaches us; we only receive `cardToken`. The subscription
// is not granted premium until the charge is APPROVED (handled here if synchronous,
// otherwise by the webhook).
func (s *SubscriptionService) Subscribe(userID uuid.UUID, cardToken string) (*models.Subscription, error) {
	if s.cfg.WompiPrivateKey == "" || s.cfg.WompiPublicKey == "" {
		return nil, errors.New("billing not configured")
	}
	if cardToken == "" {
		return nil, errors.New("missing card token")
	}

	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}
	if user.IsGuest {
		return nil, errors.New("guests cannot subscribe; please register first")
	}

	acc, err := s.getAcceptanceTokens()
	if err != nil {
		return nil, fmt.Errorf("acceptance token: %w", err)
	}

	psID, err := s.createPaymentSource(cardToken, user.Email, acc.acceptanceToken, acc.personalDataToken)
	if err != nil {
		return nil, fmt.Errorf("payment source: %w", err)
	}

	reference := s.newReference(userID)
	txn, err := s.createTransaction(psID, user.Email, reference)
	if err != nil {
		return nil, fmt.Errorf("charge: %w", err)
	}

	// Persist the subscription. Grant premium only once the charge is APPROVED;
	// PENDING transactions are activated later by the webhook.
	now := time.Now()
	row := models.Subscription{
		UserID:          userID,
		Provider:        "wompi",
		PaymentSourceID: psID,
		CustomerEmail:   user.Email,
		Tier:            "premium",
		LastReference:   reference,
		Status:          "incomplete",
	}
	if txn.Status == "APPROVED" {
		end := now.AddDate(0, 0, s.cfg.MembershipPeriodDays)
		row.Status = "active"
		row.CurrentPeriodEnd = &end
		row.FailedCharges = 0
	}

	if err := s.upsert(&row); err != nil {
		return nil, err
	}
	s.invalidatePremiumCache(userID)

	saved, _ := s.GetSubscription(userID)
	return saved, nil
}

// CancelSubscription flags the subscription to not renew. Access remains until the
// current period ends; if there is no active period, it is canceled immediately.
func (s *SubscriptionService) CancelSubscription(userID uuid.UUID) error {
	sub, err := s.GetSubscription(userID)
	if err != nil {
		return err
	}
	if sub == nil {
		return errors.New("no subscription")
	}
	updates := map[string]any{"cancel_at_period_end": true, "updated_at": time.Now()}
	if !sub.IsActive() {
		updates["status"] = "canceled"
	}
	if err := database.DB.Model(&models.Subscription{}).Where("user_id = ?", userID).Updates(updates).Error; err != nil {
		return err
	}
	s.invalidatePremiumCache(userID)
	return nil
}

// ── Recurrence (scheduler) ──────────────────────────────────────────────────

// ChargeDueSubscriptions renews every active subscription whose period has lapsed
// (and that isn't set to cancel). Called periodically by the scheduler. Each charge
// is asynchronous: APPROVED/DECLINED is finalized by the webhook, but we advance
// LastReference so the webhook can match it back.
func (s *SubscriptionService) ChargeDueSubscriptions() {
	if s.cfg.WompiPrivateKey == "" {
		return
	}
	var due []models.Subscription
	// Renew active subs whose period ended; keep charging past_due ones (dunning)
	// up to a small retry cap so a transient decline doesn't drop the member.
	err := database.DB.Where(
		"cancel_at_period_end = ? AND payment_source_id > 0 AND (( status = ? AND current_period_end <= ?) OR (status = ? AND failed_charges < ?))",
		false, "active", time.Now(), "past_due", 4,
	).Find(&due).Error
	if err != nil {
		log.Printf("[Billing] ChargeDueSubscriptions query failed: %v", err)
		return
	}

	for i := range due {
		sub := due[i]
		reference := s.newReference(sub.UserID)
		_, err := s.createTransaction(sub.PaymentSourceID, sub.CustomerEmail, reference)
		if err != nil {
			log.Printf("[Billing] renewal charge failed for user %s: %v", sub.UserID, err)
			continue
		}
		// Record the reference so the webhook resolves this subscription; the actual
		// activation/extension happens when transaction.updated arrives.
		database.DB.Model(&models.Subscription{}).Where("id = ?", sub.ID).
			Update("last_reference", reference)
	}
}

// ── Webhook handling ────────────────────────────────────────────────────────

// WompiEvent is the subset of the webhook body we use.
type WompiEvent struct {
	Event string `json:"event"`
	Data  struct {
		Transaction struct {
			ID            string `json:"id"`
			Status        string `json:"status"`
			Reference     string `json:"reference"`
			AmountInCents int64  `json:"amount_in_cents"`
			CustomerEmail string `json:"customer_email"`
			Currency      string `json:"currency"`
		} `json:"transaction"`
	} `json:"data"`
	SentAt    string `json:"sent_at"`
	Signature struct {
		Checksum   string   `json:"checksum"`
		Properties []string `json:"properties"`
	} `json:"signature"`
	Timestamp int64 `json:"timestamp"`
}

// VerifyAndParseEvent validates the Wompi checksum over the raw body and returns the
// parsed event. The checksum is SHA256 of the concatenated values of the properties
// listed in signature.properties (in order) + timestamp + events secret.
func (s *SubscriptionService) VerifyAndParseEvent(rawBody []byte) (*WompiEvent, error) {
	var ev WompiEvent
	if err := json.Unmarshal(rawBody, &ev); err != nil {
		return nil, err
	}
	if s.cfg.WompiEventsSecret == "" {
		return nil, errors.New("events secret not configured")
	}

	var concat string
	for _, prop := range ev.Signature.Properties {
		concat += extractProp(&ev, prop)
	}
	concat += strconv.FormatInt(ev.Timestamp, 10)
	concat += s.cfg.WompiEventsSecret

	sum := sha256.Sum256([]byte(concat))
	if !equalHex(hex.EncodeToString(sum[:]), ev.Signature.Checksum) {
		return nil, errors.New("invalid checksum")
	}
	return &ev, nil
}

// extractProp resolves a dotted property path from the event (only the fields we
// sign are supported: transaction.id/status/amount_in_cents).
func extractProp(ev *WompiEvent, prop string) string {
	switch prop {
	case "transaction.id":
		return ev.Data.Transaction.ID
	case "transaction.status":
		return ev.Data.Transaction.Status
	case "transaction.amount_in_cents":
		return strconv.FormatInt(ev.Data.Transaction.AmountInCents, 10)
	default:
		return ""
	}
}

// ApplyTransactionEvent updates the local subscription from a verified transaction
// event. APPROVED (re)activates and extends the period; a terminal failure marks the
// subscription past_due and bumps the failed-charge counter.
func (s *SubscriptionService) ApplyTransactionEvent(ev *WompiEvent) error {
	if ev.Event != "transaction.updated" {
		return nil // ignore non-transaction events
	}
	txn := ev.Data.Transaction

	var sub models.Subscription
	q := database.DB
	if txn.Reference != "" {
		q = q.Where("last_reference = ?", txn.Reference)
	} else {
		q = q.Where("customer_email = ?", txn.CustomerEmail)
	}
	if err := q.First(&sub).Error; err != nil {
		// No matching subscription (e.g. a non-membership payment) — nothing to do.
		return nil
	}

	now := time.Now()
	switch txn.Status {
	case "APPROVED":
		// Extend from the later of now / current period end so an early renewal
		// doesn't shorten the paid time.
		base := now
		if sub.CurrentPeriodEnd != nil && sub.CurrentPeriodEnd.After(now) {
			base = *sub.CurrentPeriodEnd
		}
		end := base.AddDate(0, 0, s.cfg.MembershipPeriodDays)
		database.DB.Model(&models.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
			"status":             "active",
			"current_period_end": &end,
			"failed_charges":     0,
			"updated_at":         now,
		})
	case "DECLINED", "ERROR", "VOIDED":
		database.DB.Model(&models.Subscription{}).Where("id = ?", sub.ID).Updates(map[string]any{
			"status":         "past_due",
			"failed_charges": sub.FailedCharges + 1,
			"updated_at":     now,
		})
	default:
		// PENDING: leave as-is; a later event finalizes it.
	}

	s.invalidatePremiumCache(sub.UserID)
	return nil
}

// ── Wompi API client (internal) ─────────────────────────────────────────────

type acceptanceTokens struct {
	acceptanceToken       string
	personalDataToken     string
	acceptancePermalink   string
	personalDataPermalink string
}

func (s *SubscriptionService) getAcceptanceTokens() (*acceptanceTokens, error) {
	url := fmt.Sprintf("%s/merchants/%s", s.cfg.WompiBaseURL, s.cfg.WompiPublicKey)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("merchants %d: %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		Data struct {
			PresignedAcceptance struct {
				AcceptanceToken string `json:"acceptance_token"`
				Permalink       string `json:"permalink"`
			} `json:"presigned_acceptance"`
			PresignedPersonalDataAuth struct {
				AcceptanceToken string `json:"acceptance_token"`
				Permalink       string `json:"permalink"`
			} `json:"presigned_personal_data_auth"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	return &acceptanceTokens{
		acceptanceToken:       parsed.Data.PresignedAcceptance.AcceptanceToken,
		personalDataToken:     parsed.Data.PresignedPersonalDataAuth.AcceptanceToken,
		acceptancePermalink:   parsed.Data.PresignedAcceptance.Permalink,
		personalDataPermalink: parsed.Data.PresignedPersonalDataAuth.Permalink,
	}, nil
}

func (s *SubscriptionService) createPaymentSource(cardToken, email, acceptanceToken, personalAuth string) (int64, error) {
	payload := map[string]any{
		"type":                "CARD",
		"token":               cardToken,
		"customer_email":      email,
		"acceptance_token":    acceptanceToken,
		"accept_personal_auth": personalAuth,
	}
	body, err := s.doPrivate(http.MethodPost, "/payment_sources", payload)
	if err != nil {
		return 0, err
	}
	var parsed struct {
		Data struct {
			ID     int64  `json:"id"`
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, err
	}
	if parsed.Data.ID == 0 {
		return 0, fmt.Errorf("payment source not created: %s", string(body))
	}
	return parsed.Data.ID, nil
}

type wompiTxn struct {
	ID     string
	Status string
}

func (s *SubscriptionService) createTransaction(paymentSourceID int64, email, reference string) (*wompiTxn, error) {
	payload := map[string]any{
		"amount_in_cents":   s.cfg.MembershipAmountCents,
		"currency":          s.cfg.MembershipCurrency,
		"customer_email":    email,
		"payment_source_id": paymentSourceID,
		"reference":         reference,
		"recurrent":         true,
	}
	if s.cfg.WompiIntegritySecret != "" {
		payload["signature"] = s.integritySignature(reference)
	}
	body, err := s.doPrivate(http.MethodPost, "/transactions", payload)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Data struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	return &wompiTxn{ID: parsed.Data.ID, Status: parsed.Data.Status}, nil
}

// integritySignature = SHA256(reference + amount_in_cents + currency + integrity_secret).
func (s *SubscriptionService) integritySignature(reference string) string {
	raw := fmt.Sprintf("%s%d%s%s", reference, s.cfg.MembershipAmountCents, s.cfg.MembershipCurrency, s.cfg.WompiIntegritySecret)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// doPrivate performs an authenticated (private key) JSON request against the Wompi API.
func (s *SubscriptionService) doPrivate(method, path string, payload any) ([]byte, error) {
	buf, _ := json.Marshal(payload)
	req, err := http.NewRequest(method, s.cfg.WompiBaseURL+path, bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.WompiPrivateKey)
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("wompi %s %s -> %d: %s", method, path, resp.StatusCode, string(body))
	}
	return body, nil
}

// newReference builds a unique, traceable transaction reference for a user.
func (s *SubscriptionService) newReference(userID uuid.UUID) string {
	return fmt.Sprintf("sub_%s_%d", userID.String(), time.Now().UnixNano())
}

// upsert writes the subscription row, updating in place on the unique user_id.
func (s *SubscriptionService) upsert(row *models.Subscription) error {
	return database.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"provider", "payment_source_id", "customer_email", "status", "tier",
			"current_period_end", "cancel_at_period_end", "last_reference",
			"failed_charges", "updated_at",
		}),
	}).Create(row).Error
}

// equalHex compares two hex strings case-insensitively in constant-ish time.
func equalHex(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var diff byte
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'F' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'F' {
			cb += 'a' - 'A'
		}
		diff |= ca ^ cb
	}
	return diff == 0
}
