package models

import (
	"time"

	"github.com/google/uuid"
)

// BlockReason son los motivos que el jugador elige al bloquear a otro usuario.
// Se guarda como varchar (no ENUM de PG) para poder añadir motivos sin migración.
type BlockReason string

const (
	BlockReasonInappropriateName    BlockReason = "inappropriate_name"
	BlockReasonInappropriateMessage BlockReason = "inappropriate_message"
	BlockReasonHarassment           BlockReason = "harassment"
	BlockReasonSpam                 BlockReason = "spam"
	BlockReasonOther                BlockReason = "other"
)

// ValidBlockReasons se usa para validar el body del endpoint de bloqueo.
var ValidBlockReasons = map[BlockReason]bool{
	BlockReasonInappropriateName:    true,
	BlockReasonInappropriateMessage: true,
	BlockReasonHarassment:           true,
	BlockReasonSpam:                 true,
	BlockReasonOther:                true,
}

// UserBlock registra que Blocker bloqueó a Blocked con un motivo. Una fila por
// par (blocker, blocked): re-bloquear actualiza el motivo en vez de duplicar,
// así el conteo del admin ("cuántas veces fue bloqueado") = nº de usuarios
// distintos que lo bloquearon y no se infla re-bloqueando.
type UserBlock struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BlockerID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_block_pair;index" json:"blocker_id"`
	BlockedID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_block_pair;index" json:"blocked_id"`
	Reason    string    `gorm:"size:40;not null;default:'other'" json:"reason"`
	// Details es el texto libre opcional (obligatorio en la UI cuando reason='other').
	Details   string    `json:"details"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
