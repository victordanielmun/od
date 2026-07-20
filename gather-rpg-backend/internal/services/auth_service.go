package services

import (
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/utils"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	usernameMinLen = 3
	usernameMaxLen = 20

	// bcrypt silently truncates input beyond 72 bytes, so we cap there rather than
	// let two different long passwords hash to the same value.
	passwordMinLen = 8
	passwordMaxLen = 72

	// strictEmailValidation gates validateEmail in Register. The client's
	// type="email" input accepts addresses without a TLD (e.g. "j@j"), so
	// once enabled this rejects them server-side too. Off until the rollout
	// decision is made.
	strictEmailValidation = false
)

// emailRegex requires a dot-separated domain with a TLD of 2+ chars,
// rejecting inputs like "j@j" that the HTML email input allows.
var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`)

func validateEmail(email string) error {
	if !emailRegex.MatchString(strings.TrimSpace(email)) {
		return errors.New("invalid email address")
	}
	return nil
}

// normalizeEmail trims surrounding whitespace and lowercases the address so that
// "J@Dominio.com " and "j@dominio.com" resolve to the same account. Without this
// the unique-email constraint is case-sensitive and lets near-duplicate accounts
// register, and login-by-email becomes case-fragile.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validatePassword enforces a minimum length and rejects anything past bcrypt's
// 72-byte truncation point. The client only marks the field required, so a direct
// API call could otherwise register an empty or 1-char password.
func validatePassword(password string) error {
	n := len(password)
	if n < passwordMinLen {
		return errors.New("password must be at least 8 characters")
	}
	if n > passwordMaxLen {
		return errors.New("password must be at most 72 characters")
	}
	return nil
}

// validateUsername enforces the same 3–20 character bound the client applies,
// so a direct API call can't bypass the input's maxLength.
func validateUsername(username string) error {
	n := utf8.RuneCountInString(username)
	if n < usernameMinLen {
		return errors.New("username must be at least 3 characters")
	}
	if n > usernameMaxLen {
		return errors.New("username must be at most 20 characters")
	}
	return nil
}

type AuthService struct {
	Repo *repository.UserRepository
}

func NewAuthService(repo *repository.UserRepository) *AuthService {
	return &AuthService{Repo: repo}
}

func (s *AuthService) LoginGuest(characterIDs []string, nativeLang string, deviceID string) (*models.AuthResponse, error) {
	// If a deviceID is provided, check if we already have a guest account for it
	if deviceID != "" {
		email := fmt.Sprintf("%s@guest.local", deviceID)
		if user, err := s.Repo.FindByEmail(email); err == nil && user.IsGuest {
			// Found existing guest account for this device, log them in
			token, err := utils.GenerateToken(user.ID.String(), user.Username, user.Role)
			if err != nil {
				return nil, err
			}
			return &models.AuthResponse{
				Token: token,
				User:  *user,
			}, nil
		}
	}

	guestID := uuid.New().String()
	if deviceID != "" {
		guestID = deviceID
	}

	names := []string{"Leo", "Mia", "Zoe", "Max", "Sam", "Ivy", "Eli", "Ava", "Ian", "Uma", "Rex", "Fay", "Kai", "Lia", "Nia", "Ray"}
	adjectives := []string{"Brave", "Swift", "Wild", "Bold", "Epic", "Fierce", "Cool", "Smart", "Wise", "Fast", "Grand", "True", "Sly", "Keen", "Noble", "Proud"}
	
	nameSeed := rand.New(rand.NewSource(time.Now().UnixNano()))
	baseName := names[nameSeed.Intn(len(names))]
	adjective := adjectives[nameSeed.Intn(len(adjectives))]
	
	// E.g., LeoBrave, MiaSwift
	username := fmt.Sprintf("%s%s", baseName, adjective)

	// If the username already exists, add a random letter to ensure uniqueness
	if _, err := s.Repo.FindByUsername(username); err == nil {
		letters := "abcdefghijklmnopqrstuvwxyz"
		username = fmt.Sprintf("%s%s%c", baseName, adjective, letters[nameSeed.Intn(len(letters))])
	}

	email := fmt.Sprintf("%s@guest.local", guestID)
	password := guestID

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Select a random character ID from the available ones, or fallback to random 1-3
	var randomCharID string
	charSeed := rand.New(rand.NewSource(time.Now().UnixNano()))
	if len(characterIDs) > 0 {
		randomCharID = characterIDs[charSeed.Intn(len(characterIDs))]
	} else {
		randomCharID = strconv.Itoa(charSeed.Intn(3) + 1)
	}

	// Guests never pick a language explicitly. An empty value would normalize to
	// English, which silently disables every native-helper translation, so default
	// to Spanish (the product's primary audience). Changeable from the Dashboard.
	guestLang := utils.NormalizeLang(nativeLang)
	if strings.TrimSpace(nativeLang) == "" {
		guestLang = "es"
	}

	user := &models.User{
		Username:       username,
		Email:          email,
		Password:       string(hashedPassword),
		IsGuest:        true,
		CharacterID:    randomCharID,
		NativeLanguage: guestLang,
	}

	// Use a transaction to create both user and player stats
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		stats := &models.PlayerStats{
			UserID:    user.ID,
			Gold:      100, // Starting gold
			HPCurrent: 100,
			MPCurrent: 50,
		}
		return tx.Create(stats).Error
	})

	if err != nil {
		return nil, err
	}

	token, err := utils.GenerateToken(user.ID.String(), user.Username, user.Role)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *AuthService) Register(req models.RegisterRequest) (*models.AuthResponse, error) {
	// Normalize and validate the username before anything else.
	req.Username = strings.TrimSpace(req.Username)
	if err := validateUsername(req.Username); err != nil {
		return nil, err
	}

	// Normalize the email so the unique constraint and login are case-insensitive.
	req.Email = normalizeEmail(req.Email)

	if strictEmailValidation {
		if err := validateEmail(req.Email); err != nil {
			return nil, err
		}
	}

	if err := validatePassword(req.Password); err != nil {
		return nil, err
	}

	// Check if user exists
	if _, err := s.Repo.FindByEmail(req.Email); err == nil {
		return nil, errors.New("email already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Username:       req.Username,
		Email:          req.Email,
		Password:       string(hashedPassword),
		IsGuest:        false,
		NativeLanguage: utils.NormalizeLang(req.NativeLanguage),
	}

	// Use a transaction to create both user and player stats
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		stats := &models.PlayerStats{
			UserID:    user.ID,
			Gold:      100, // Starting gold
			HPCurrent: 100,
			MPCurrent: 50,
		}
		return tx.Create(stats).Error
	})

	if err != nil {
		return nil, err
	}

	token, err := utils.GenerateToken(user.ID.String(), user.Username, user.Role)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *AuthService) UpgradeGuest(userIDStr string, req models.RegisterRequest) (*models.AuthResponse, error) {
	_, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}

	user, err := s.Repo.FindByID(userIDStr)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if !user.IsGuest {
		return nil, errors.New("user is already fully registered")
	}

	req.Username = strings.TrimSpace(req.Username)
	if err := validateUsername(req.Username); err != nil {
		return nil, err
	}

	req.Email = normalizeEmail(req.Email)
	if strictEmailValidation {
		if err := validateEmail(req.Email); err != nil {
			return nil, err
		}
	}

	if err := validatePassword(req.Password); err != nil {
		return nil, err
	}

	if existing, err := s.Repo.FindByEmail(req.Email); err == nil && existing.ID != user.ID {
		return nil, errors.New("email already registered")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user.Username = req.Username
	user.Email = req.Email
	user.Password = string(hashedPassword)
	user.IsGuest = false

	if err := database.DB.Save(user).Error; err != nil {
		return nil, err
	}

	token, err := utils.GenerateToken(user.ID.String(), user.Username, user.Role)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *AuthService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
	// Match the normalization done at registration so login is case-insensitive.
	user, err := s.Repo.FindByEmail(normalizeEmail(req.Email))
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Cuentas desactivadas por el admin (moderación por bloqueos) no entran.
	if !user.IsActive {
		return nil, errors.New("account disabled")
	}

	token, err := utils.GenerateToken(user.ID.String(), user.Username, user.Role)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *AuthService) GetPlayerStats(userIDStr string) (*models.PlayerStats, error) {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, errors.New("invalid user ID format")
	}

	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			stats = models.PlayerStats{
				UserID:    userID,
				Gold:      100,
				HPCurrent: 100,
				MPCurrent: 50,
			}
			if err := database.DB.Create(&stats).Error; err != nil {
				return nil, err
			}
			return &stats, nil
		}
		return nil, err
	}
	return &stats, nil
}

// UpdateCompanion saves the chosen companion NPC ID to the user's profile
func (s *AuthService) UpdateCompanion(userIDStr string, companionNPCID uint) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	return database.DB.Model(&models.User{}).Where("id = ?", userID).Update("companion_npc_id", companionNPCID).Error
}

// AcceptTerms saves the terms accepted flag to the user's profile
func (s *AuthService) AcceptTerms(userIDStr string) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	return database.DB.Model(&models.User{}).Where("id = ?", userID).Update("terms_accepted", true).Error
}

// UpdateNativeLanguage saves the player's native language (ISO-639-1). This drives all
// helper-text translation (challenges, missions, NPC replies) into that language.
func (s *AuthService) UpdateNativeLanguage(userIDStr string, lang string) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}
	return database.DB.Model(&models.User{}).Where("id = ?", userID).Update("native_language", utils.NormalizeLang(lang)).Error
}

// UpdateSprite saves the selected sprite
func (s *AuthService) UpdateSprite(userIDStr string, characterID string) error {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return errors.New("invalid user ID format")
	}

	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return err
	}

	user.CharacterID = characterID
	user.HasChosenSprite = true

	return database.DB.Save(&user).Error
}


