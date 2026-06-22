package services

import (
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/utils"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	Repo *repository.UserRepository
}

func NewAuthService(repo *repository.UserRepository) *AuthService {
	return &AuthService{Repo: repo}
}

func (s *AuthService) LoginGuest(characterIDs []string, nativeLang string) (*models.AuthResponse, error) {
	guestID := uuid.New().String()
	username := fmt.Sprintf("Guest_%s", guestID[:8])
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

	user := &models.User{
		Username:       username,
		Email:          email,
		Password:       string(hashedPassword),
		IsGuest:        true,
		CharacterID:    randomCharID,
		NativeLanguage: utils.NormalizeLang(nativeLang),
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

func (s *AuthService) Login(req models.LoginRequest) (*models.AuthResponse, error) {
	user, err := s.Repo.FindByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
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


