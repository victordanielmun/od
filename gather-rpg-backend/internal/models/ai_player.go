package models

import (
	"time"

	"github.com/google/uuid"
)

// AIPlayer es un "jugador" gobernado por el servidor: pasea por una escena con el
// mismo aspecto que una persona y conversa por la misma ventana de chat que un
// usuario.
//
// Es un tipo DELIBERADAMENTE aparte de los NPCs. No comparte tabla ni código con
// npc_definitions / npc_templates / npc_room_instances, ni pasa por el pipeline de
// misiones y diálogo. Las diferencias no son cosméticas:
//
//   - Aspecto: usa los personajes de JUGADOR (el atlas char-N), no los sprites de NPC.
//   - Movimiento: lo decide el SERVIDOR y es igual para todos; un NPC lo mueve cada
//     cliente por su cuenta desde su posición de plantilla.
//   - Conversación: entra y sale por el chat privado entre usuarios, no por el
//     overlay de diálogo de NPC. No tiene misiones, tareas ni tienda.
//
// UserID es la pieza que lo hace posible: cada bot tiene su fila espejo en `users`,
// que es lo que permite enrutarle un mensaje privado y mostrar su nombre en la
// ventana de chat como el de cualquier otro jugador.
type AIPlayer struct {
	ID     uint      `gorm:"primaryKey" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`

	// Identidad visible en el mapa.
	Username    string `gorm:"size:50;not null" json:"username"`
	CharacterID string `gorm:"size:10;not null;default:'1'" json:"character_id"`

	// Escena en la que vive. Solo aparece ahí.
	SceneKey string `gorm:"size:100;not null;index;default:'lobby'" json:"scene_key"`

	// Personality son las instrucciones de sistema para el LLM: quién es, de qué
	// habla, cómo trata al jugador. Es el equivalente al campo `instructions` de
	// una plantilla de NPC, pero de este lado del mundo.
	Personality string `gorm:"type:text" json:"personality"`
	// Greeting es la primera línea al abrir la conversación. Si está vacía, el bot
	// espera a que hable el jugador.
	Greeting string `gorm:"type:text" json:"greeting"`

	// InteractionMode: "text_only" (solo texto), "audio_only" (el cliente reproduce
	// la respuesta con TTS y no muestra el texto) o "hybrid" (ambos).
	InteractionMode string `gorm:"size:20;not null;default:'text_only'" json:"interaction_mode"`
	// VoiceType elige la voz de Piper cuando la respuesta se reproduce en audio.
	VoiceType string `gorm:"size:20;not null;default:'female'" json:"voice_type"`

	// Ancla del paseo. Con SpawnX/SpawnY a 0 el bot se ancla donde aparece el
	// primer jugador que entra, que es lo que hace que estén donde hay gente.
	SpawnX       float64 `gorm:"default:0" json:"spawn_x"`
	SpawnY       float64 `gorm:"default:0" json:"spawn_y"`
	WanderRadius float64 `gorm:"default:0" json:"wander_radius"`

	// IsActive permite retirar un bot sin borrarlo (conserva su historial de chat).
	IsActive bool `gorm:"not null;default:true" json:"is_active"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName fija el nombre para que no dependa de la pluralización de GORM.
func (AIPlayer) TableName() string {
	return "ai_players"
}

// Modos de interacción admitidos.
const (
	AIPlayerModeTextOnly  = "text_only"
	AIPlayerModeAudioOnly = "audio_only"
	AIPlayerModeHybrid    = "hybrid"
)

// WantsText indica si la respuesta debe mostrarse escrita.
func (a *AIPlayer) WantsText() bool {
	return a.InteractionMode != AIPlayerModeAudioOnly
}

// WantsAudio indica si la respuesta debe acompañarse de voz (TTS).
func (a *AIPlayer) WantsAudio() bool {
	return a.InteractionMode == AIPlayerModeAudioOnly || a.InteractionMode == AIPlayerModeHybrid
}
