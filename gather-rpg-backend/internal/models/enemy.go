package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Enemy struct {
	ID          uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string          `json:"name"`
	Level       int             `json:"level"`
	HPMax       int             `json:"hp_max"`
	MPMax       int             `json:"mp_max"`
	Attack      int             `json:"attack"`
	Defense     int             `json:"defense"`
	Speed       int             `json:"speed"`
	EXPReward   int             `json:"exp_reward"`
	GoldReward  int             `json:"gold_reward"`
	AIBehavior  string          `json:"ai_behavior"` // arquetipo del motor: "melee" | "fast" | "thrower" | "boss" (el editor de mapas hereda este valor como Type al colocar el enemigo)
	AttackRate  int             `gorm:"default:1000" json:"attack_rate"` // ms entre ataques/disparos (cadencia). Lo hereda el editor de mapas.
	SkillIDs    json.RawMessage `gorm:"type:jsonb" json:"skill_ids"`
	SpriteKey   string          `json:"sprite_key"`

	// Economía de boss (solo aplica si AIBehavior == "boss"). El editor de mapas las
	// hereda al colocar el enemigo, igual que hp/daño/velocidad. Ver EnemySpawn.
	ManaMax         int `gorm:"default:100" json:"mana_max"`
	ManaRegen       int `gorm:"default:10" json:"mana_regen"`           // maná por segundo
	HPRegen         int `gorm:"default:0" json:"hp_regen"`              // HP por segundo (autoregen)
	CardFailHealPct int `gorm:"default:100" json:"card_fail_heal_pct"` // % de HPMax al fallar la card

	CreatedAt   time.Time       `json:"created_at"`
}

// Helper to save/load JSON skills for Enemy
func (e *Enemy) BeforeCreate(tx *gorm.DB) (err error) {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return
}

// EnemyConfig es lo que el frontend necesita para montar el pool
// y configurar la FSM de cada tipo de enemigo
type EnemyConfig struct {
	// Identificación — conecta con el sistema NPC existente
	NpcID        string `json:"npcId"`       // "guardia_1", "boss_dragon"
	TextureKey   string `json:"textureKey"`  // clave del atlas en Phaser
	DefaultFrame string `json:"defaultFrame"` // frame inicial

	// Stats de combate — alimentan la FSM
	HP             int     `json:"hp"`
	Speed          float64 `json:"speed"`          // px/s
	Damage         int     `json:"damage"`          // daño por ataque
	AttackRate     int     `json:"attackRate"`      // ms entre ataques
	AttackRange    float64 `json:"attackRange"`     // px de rango de ataque
	DetectRange    float64 `json:"detectRange"`     // px para activar chase
	KnockThreshold int     `json:"knockThreshold"`  // daño mínimo para knocked

	// Spawneo — dónde y cuándo aparece en el nivel
	Level   string  `json:"level"`
	SpawnX  float64 `json:"spawnX"`
	SpawnY  float64 `json:"spawnY"`
	WaveNum int     `json:"waveNum"` // en qué oleada aparece
	SpawnHP     *int     `json:"spawnHp,omitempty"`
	SpawnSpeed  *float64 `json:"spawnSpeed,omitempty"`
	SpawnDamage *int     `json:"spawnDamage,omitempty"`
	SpawnAttackRate *int `json:"spawnAttackRate,omitempty"`
}
// Real-time Combat Models (Websocket)

type ActiveEnemy struct {
	InstanceID uuid.UUID `json:"instance_id"`
	EnemyID    uuid.UUID `json:"enemy_id"`
	X          float64   `json:"x"`
	Y          float64   `json:"y"`
	HP         int       `json:"hp"`
	HPMax      int       `json:"hp_max"`
	FSMState   string    `json:"fsm_state"` // "idle", "chase", "attack", "hurt", "knocked", "dead", "ninja_card"
	TargetID   string    `json:"target_id"` // UserID of the targeted player
	HurtUntil  time.Time `json:"-"`         // mientras now < HurtUntil el enemigo está aturdido (no se mueve ni ataca)
	PendingNinjaCard string `json:"pending_ninja_card,omitempty"` // Player ID that triggered the ninja card
	// NinjaCardChallengeID es el reto que el servidor emitió para esta card (single player).
	// La respuesta se evalúa SIEMPRE contra este reto, nunca contra el challenge_id que
	// manda el cliente, para que no pueda sustituirlo por uno cuya respuesta ya conoce.
	NinjaCardChallengeID string `json:"-"`
	WaveNum    int       `json:"wave_num"`
	NPCID      string    `json:"npc_id"`    // From template config
	SpriteID   string    `json:"sprite_id"` // Asset ID ('1', '2', etc.)
	Damage     int       `json:"damage"`      // daño por ataque (del EnemySpawn)
	Speed      float64   `json:"speed"`       // px/s
	AttackRate int       `json:"attack_rate"` // ms entre ataques
	Type       string    `json:"type"`        // "melee" (default), "thrower", "fast", "boss"

	// Boss FSM (solo type=boss)
	NextAbilityAt time.Time `json:"-"` // próxima vez que puede usar una habilidad especial (skill/charge)
	BusyUntil     time.Time `json:"-"` // mientras now < BusyUntil mantiene la acción en curso (telegraph/dash)
	ChargeVX      float64   `json:"-"` // velocidad de embestida (px/tick) fijada al iniciar el charge
	ChargeVY      float64   `json:"-"`

	// Boss ninja card multijugador (solo type=boss): al golpe mortal, cada jugador
	// del room recibe una card; el boss muere solo si TODOS aciertan.
	BossCardRequired map[string]bool `json:"-"` // playerIDs que deben responder
	BossCardResults  map[string]bool `json:"-"` // playerID -> acertó (presencia = ya respondió)
	// BossCardChallenge mapea playerID -> challengeID emitido, para evaluar cada respuesta
	// contra el reto que el servidor envió a ese jugador (no contra el challenge_id del cliente).
	BossCardChallenge map[string]string `json:"-"`

	// Thrower: sprite del proyectil (icon_key); el cliente lo usa en _doThrow.
	ProjectileSprite string `json:"projectile_sprite"`

	// Boss: maná y regeneración (server-internal).
	ManaMax         int       `json:"-"`
	Mana            int       `json:"-"`
	ManaRegen       int       `json:"-"`
	HPRegen         int       `json:"-"`
	CardFailHealPct int       `json:"-"`
	LastRegenAt     time.Time `json:"-"`
}

type EnemyUpdateBroadcast struct {
	RoomID  string        `json:"room_id"`
	Enemies []ActiveEnemy `json:"enemies"`
}

type EnemyDiedBroadcast struct {
	InstanceID uuid.UUID `json:"instance_id"`
	RoomID     string    `json:"room_id"`
	KilledBy   string    `json:"killed_by"` // UserID
}
