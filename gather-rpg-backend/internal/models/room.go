package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Room struct {
	ID         uuid.UUID       `gorm:"type:uuid;primary_key;" json:"id"`
	Name       string          `gorm:"not null;size:50" json:"name"` // Removed uniqueIndex for Name to allow multiple lobbies
	MaxUsers   int             `gorm:"default:50" json:"max_users"`
	MapData    json.RawMessage `gorm:"type:jsonb" json:"map_data"`
	IsPublic   bool            `gorm:"default:true" json:"is_public"`
	// Type decide cómo se comparte la instancia. Lo fija el backend según el Mode
	// de la misión de la escena (ver SceneMissionMode):
	//   public      → compartida por cualquiera, hasta MaxUsers
	//   solo        → un jugador; nunca se reutiliza (misiones individuales)
	//   cooperative → equipo; audio de reunión y crédito de kills compartido
	//   competitive → equipo en el mismo mapa, pero sin compartir crédito
	//   mission/private → instancia por PIN
	Type       string          `gorm:"default:'public';size:20" json:"type"`
	SceneKey   string          `gorm:"not null;size:50" json:"scene_key"`    // e.g., 'lobby', 'shop_1'
	InviteCode string          `gorm:"size:10;index" json:"invite_code"`     // Random code for private rooms
	ParentID   *uuid.UUID      `gorm:"type:uuid" json:"parent_id"`           // For submaps
	CreatedBy  uuid.UUID       `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type CreateRoomRequest struct {
	Name     string          `json:"name" validate:"required,min=3,max=50"`
	MaxUsers int             `json:"max_users" validate:"min=2,max=100"`
	IsPublic bool            `json:"is_public"`
	Type     string          `json:"type" validate:"oneof=public private mission"`
	SceneKey string          `json:"scene_key" validate:"required"`
	MapData  json.RawMessage `json:"map_data"`
}

func (r *Room) BeforeCreate(tx *gorm.DB) (err error) {
	r.ID = uuid.New()
	return
}
