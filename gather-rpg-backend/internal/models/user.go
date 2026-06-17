package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Username    string         `gorm:"unique;not null" json:"username"`
	Email       string         `gorm:"unique;not null" json:"email"`
	Password    string         `json:"-"`
	Role        string         `gorm:"not null;default:'user'" json:"role"` // "admin", "user"
	IsGuest        bool           `gorm:"not null;default:false" json:"is_guest"`
	CharacterID    string         `gorm:"not null;default:'1'" json:"character_id"`
	HasChosenSprite bool          `gorm:"not null;default:false" json:"has_chosen_sprite"`
	CompanionNPCID *uint          `gorm:"type:integer" json:"companion_npc_id,omitempty"`
	TermsAccepted  bool           `gorm:"not null;default:false" json:"terms_accepted"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
