package models

import (
	"time"

	"github.com/google/uuid"
)

// Subscription is the local record of a user's membership. There is at most one
// row per user. Because Wompi has no native "subscription" object, we drive the
// recurrence ourselves: we store the reusable payment source (tokenized card)
// and a CurrentPeriodEnd; a scheduler charges the payment source again when the
// period lapses (see SubscriptionService.ChargeDueSubscriptions).
//
// A user counts as "premium" when Status is active AND CurrentPeriodEnd is in
// the future (see Subscription.IsActive / SubscriptionService.IsUserPremium).
type Subscription struct {
	ID       uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID   uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	Provider string    `gorm:"size:20;not null;default:'wompi'" json:"provider"`
	// PaymentSourceID is Wompi's reusable token for the customer's card, used to
	// charge them again without their presence. 0 until the card is registered.
	PaymentSourceID int64  `gorm:"default:0" json:"-"`
	CustomerEmail   string `gorm:"size:255" json:"-"`
	// Status: active, past_due (a renewal charge failed), canceled.
	Status string `gorm:"size:30;not null;default:'incomplete'" json:"status"`
	Tier   string `gorm:"size:30;not null;default:'premium'" json:"tier"`
	// CurrentPeriodEnd is when the paid access lapses; the scheduler renews on/after it.
	CurrentPeriodEnd *time.Time `json:"current_period_end"`
	// CancelAtPeriodEnd, when true, stops the scheduler from renewing; access lasts
	// until CurrentPeriodEnd and then the row flips to canceled.
	CancelAtPeriodEnd bool `gorm:"not null;default:false" json:"cancel_at_period_end"`
	// LastReference is the reference of the most recent transaction we created, so a
	// webhook (transaction.updated) can be matched back to this subscription.
	LastReference string `gorm:"size:100;index" json:"-"`
	// FailedCharges counts consecutive failed renewal attempts (for dunning/backoff).
	FailedCharges int       `gorm:"not null;default:0" json:"-"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// IsActive reports whether the subscription currently grants premium access.
func (s *Subscription) IsActive() bool {
	if s == nil {
		return false
	}
	if s.Status != "active" {
		return false
	}
	if s.CurrentPeriodEnd == nil {
		return false
	}
	return s.CurrentPeriodEnd.After(time.Now())
}
