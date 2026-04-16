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

func (s *AuthService) LoginGuest() (*models.AuthResponse, error) {
	guestID := uuid.New().String()
	username := fmt.Sprintf("Guest_%s", guestID[:8])
	email := fmt.Sprintf("%s@guest.local", guestID)
	password := guestID

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Select a random character ID between 1 and 3 for the guest
	charSeed := rand.New(rand.NewSource(time.Now().UnixNano()))
	randomCharID := strconv.Itoa(charSeed.Intn(3) + 1)

	user := &models.User{
		Username:    username,
		Email:       email,
		Password:    string(hashedPassword),
		IsGuest:     true,
		CharacterID: randomCharID,
	}

	// Use a transaction to create both user and player stats
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		stats := &models.PlayerStats{
			UserID: user.ID,
			Gold:   100, // Starting gold
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
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
		IsGuest:  false,
	}

	// Use a transaction to create both user and player stats
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		stats := &models.PlayerStats{
			UserID: user.ID,
			Gold:   100, // Starting gold
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
