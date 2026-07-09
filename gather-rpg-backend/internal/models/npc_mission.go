package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// -- ENUMs as string types --

type NPCState string

const (
	NPCStateIdle      NPCState = "idle"
	NPCStateTalking   NPCState = "talking"
	NPCStateHappy     NPCState = "happy"
	NPCStateAngry     NPCState = "angry"
	NPCStateSad       NPCState = "sad"
	NPCStateSurprised NPCState = "surprised"
	NPCStateThinking  NPCState = "thinking"
	NPCStateGrateful  NPCState = "grateful"
	NPCStateWaiting   NPCState = "waiting"
	NPCStateWalking   NPCState = "walking"
	NPCStateDying     NPCState = "dying"
)

type NPCType string

const (
	NPCTypeQuest    NPCType = "quest_giver"
	NPCTypeMaster   NPCType = "quest_master"
	NPCTypeShop     NPCType = "merchant"
	NPCTypeGuide    NPCType = "guide"
	NPCTypeAmbient  NPCType = "other"
)

type NPCRole string

const (
	NPCRoleTask          NPCRole = "task_npc"
	NPCRoleInformational NPCRole = "informational_npc"
)

type MissionType string

const (
	MissionTypeFindItem      MissionType = "find_item"
	MissionTypeCollectItems  MissionType = "find_items"
	MissionTypeDefeatEnemy   MissionType = "defeat_enemy"
	MissionTypeKillAll       MissionType = "kill_all"
	MissionTypeKillBoss      MissionType = "kill_boss"
	MissionTypeTalkToNPC     MissionType = "talk_to_npc"
	MissionTypeDeliverMsg    MissionType = "deliver_message"
	MissionTypePronunciation MissionType = "pronunciation_challenge"
)

type TaskType string

const (
	TaskTypeBringItem     TaskType = "bring_item"
	TaskTypeFindItem      TaskType = "find_item"
	TaskTypeCollectItems  TaskType = "collect_items"
	TaskTypeDefeatEnemy   TaskType = "defeat_enemy"
	TaskTypeKillAll       TaskType = "kill_all"
	TaskTypeKillBoss      TaskType = "kill_boss"
	TaskTypeTalkToNPC     TaskType = "talk_to_npc"
	TaskTypeDeliverMsg    TaskType = "deliver_message"
	TaskTypePronunciation TaskType = "pronunciation_threshold"
	TaskTypeKaraoke       TaskType = "karaoke"
)

type ProgressStatus string

const (
	StatusNotStarted ProgressStatus = "not_started"
	StatusInProgress ProgressStatus = "in_progress"
	StatusCompleted  ProgressStatus = "completed"
)

type PronunciationEval string

const (
	EvalExcellent PronunciationEval = "excellent"
	EvalGood      PronunciationEval = "good"
	EvalNeedsWork PronunciationEval = "needs_work"
	EvalBad       PronunciationEval = "bad"
	EvalNone      PronunciationEval = "none"
)

type Shop struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `json:"description"`
	Items       []Item    `gorm:"many2many:shop_items;" json:"items"`
	CreatedAt   time.Time `json:"created_at"`
}

// -- Core Entities --

type NPCDefinition struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Name            string    `gorm:"size:100;not null" json:"name"`
	Sprite          string    `gorm:"size:100;not null" json:"sprite"`
	Greeting        string    `json:"greeting"`
	Type            NPCType   `gorm:"type:npc_type;default:'other'" json:"type"`
	DefaultState    NPCState  `gorm:"type:npc_state;default:'idle'" json:"default_state"`
	InteractionMode string    `gorm:"size:20;default:'hybrid'" json:"interaction_mode"` // "hybrid", "audio_only", "text_only"
	VoiceType       string    `gorm:"size:20;default:'male'" json:"voice_type"`        // "male", "female"
	ShopID          *uint     `json:"shop_id"`
	Shop            Shop      `gorm:"foreignKey:ShopID" json:"shop"`
	GiftItemID      *uuid.UUID `gorm:"type:uuid" json:"gift_item_id"`
	GiftQuantity    int       `gorm:"default:0" json:"gift_quantity"`
	CreatedAt       time.Time `json:"created_at"`
}

type NPCTemplate struct {
	ID                uint          `gorm:"primaryKey" json:"id"`
	SceneKey          string        `gorm:"size:100;not null" json:"scene_key"`
	NPCDefinitionID   uint          `json:"npc_definition_id"`
	NPCDefinition     NPCDefinition `gorm:"foreignKey:NPCDefinitionID" json:"npc_definition"`
	PositionX         int           `json:"position_x"`
	PositionY         int           `json:"position_y"`
	FacingDirection   string        `gorm:"size:10;default:'south'" json:"facing_direction"`
	DefaultState      NPCState      `gorm:"type:npc_state;default:'idle'" json:"default_state"`
	InteractionRadius int           `gorm:"default:64" json:"interaction_radius"`
	MovementType      string          `gorm:"size:20;default:'static'" json:"movement_type"`
	MovementRange     int             `gorm:"default:0" json:"movement_range"`
	MovementSpeed     int             `gorm:"default:50" json:"movement_speed"`
	Waypoints         json.RawMessage `gorm:"type:jsonb" json:"waypoints"` // List of waypoints for lead_player behavior
	AutoDialogue      bool            `gorm:"default:false" json:"auto_dialogue"`
	AutoCloseDialogue bool            `gorm:"default:false" json:"auto_close_dialogue"`
	Instructions      string          `json:"instructions"`      // Custom AI instructions for this instance
	SuccessMessage    string          `json:"success_message"`  // Message shown when "purpose" is fulfilled
	Greeting          string          `json:"greeting"`         // Custom initial greeting for this instance
	CreatedAt         time.Time       `json:"created_at"`
}

type Mission struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	SceneKey      string          `gorm:"size:100;not null" json:"scene_key"`
	Title         string          `gorm:"size:200;not null" json:"title"`
	DescriptionEn string          `json:"description_en"`
	ObjectiveEn   string          `json:"objective_en"`
	Type          MissionType     `gorm:"type:mission_type" json:"type"`
	Status        string          `gorm:"size:20;default:'active'" json:"status"`
	Mode          string          `gorm:"size:20;default:'individual'" json:"mode"` // "cooperative", "individual", "competitive"
	ObjectiveTarget string        `gorm:"size:200" json:"objective_target"`
	RewardItemID   *uuid.UUID      `gorm:"type:uuid" json:"reward_item_id"`
	RewardQuantity int             `gorm:"default:0" json:"reward_quantity"`
	RewardGold     int             `gorm:"default:0" json:"reward_gold"`
	RewardXP       int             `gorm:"default:0" json:"reward_xp"`
	// AdvanceGold is an up-front gold stipend paid ONCE when the player first
	// accepts the mission, before any task is done. It solves the "buy at the
	// shop" chicken-and-egg problem (a fetch mission that requires purchasing
	// items, where RewardGold is only paid on completion). 0 = no advance.
	AdvanceGold    int             `gorm:"default:0" json:"advance_gold"`
	Difficulty    DifficultyLevel `gorm:"type:varchar(20);not null;default:'beginner'" json:"difficulty"`
	// IsPremium gates the mission behind an active membership. Free missions
	// (default) are available to everyone; premium missions can only be accepted
	// by users with an active subscription (see SubscriptionService.IsUserPremium).
	IsPremium     bool            `gorm:"not null;default:false" json:"is_premium"`
	CreatedAt     time.Time       `json:"created_at"`
}

type MissionTask struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	MissionID             uint      `json:"mission_id"`
	Type                  TaskType  `gorm:"type:task_type" json:"type"`
	Order                 int       `json:"order"`
	DescriptionEn         string    `json:"description_en"`
	TargetNPCTemplateID   *uint     `json:"target_npc_template_id"`
	RequiredItem         string    `gorm:"size:100" json:"required_item"`
	RequiredQuantity     int       `gorm:"default:0" json:"required_quantity"` // 0 = 1 (cantidad de ítem a entregar/recolectar)
	// RequiredItems holds a list of items to require: [{"item": "apple", "quantity": 2}, ...]
	RequiredItems         json.RawMessage `gorm:"type:jsonb" json:"required_items"`
	RequiredEnemy        string    `gorm:"size:100" json:"required_enemy"`
	RequiredKills        int       `gorm:"default:0" json:"required_kills"` // 0 = no aplica / matar cualquier cantidad
	PronunciationMinScore int       `gorm:"default:80" json:"pronunciation_min_score"`
	TargetPhraseEn        string    `json:"target_phrase_en"`
	MessageToDeliver      string    `json:"message_to_deliver"`
	// KaraokeLines holds the ordered lyric lines for a 'karaoke' task as JSON:
	// [{"order":1,"line":"Twinkle twinkle little star"}, ...]. Each line is scored
	// per-recording by the voice backend; the task completes when the average meets
	// PronunciationMinScore (see MissionService.CompleteKaraoke).
	KaraokeLines          json.RawMessage `gorm:"type:jsonb" json:"karaoke_lines"`
	CreatedAt             time.Time `json:"created_at"`
}

type NPCMissionRole struct {
	ID                uint        `gorm:"primaryKey" json:"id"`
	NPCTemplateID     uint        `json:"npc_template_id"`
	MissionID         uint        `json:"mission_id"`
	Role              NPCRole     `gorm:"type:npc_role" json:"role"`
	TaskDescription   string      `json:"task_description"`
	KnowledgeSummary  string      `json:"knowledge_summary"`
	CreatedAt         time.Time   `json:"created_at"`
}

type NPCRoomInstance struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	RoomID         uuid.UUID `gorm:"type:uuid;not null" json:"room_id"`
	NPCTemplateID  uint      `json:"npc_template_id"`
	NPCTemplate    NPCTemplate `gorm:"foreignKey:NPCTemplateID" json:"npc_template"`
	CurrentState   NPCState  `gorm:"type:npc_state;default:'idle'" json:"current_state"`
	TaskCompleted  bool      `gorm:"default:false" json:"task_completed"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Conversation struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	PlayerID      uuid.UUID `gorm:"type:uuid;not null" json:"player_id"`
	NPCInstanceID uint      `json:"npc_instance_id"`
	MissionID     *uint     `json:"mission_id"`
	SessionID     string    `gorm:"size:100" json:"session_id"`
	CreatedAt     time.Time `json:"created_at"`
}

type ConversationMessage struct {
	ID               uint              `gorm:"primaryKey" json:"id"`
	ConversationID   uint              `json:"conversation_id"`
	PlayerInput      string            `json:"player_input"`
	PronunciationScore float32         `json:"pronunciation_score"`
	NPCResponse      string            `json:"npc_response"`
	NPCResponseES    string            `json:"npc_response_es"`
	NPCState         NPCState          `gorm:"type:npc_state;default:'talking'" json:"npc_state"`
	PronunciationEval PronunciationEval `gorm:"type:pronunciation_eval;default:'none'" json:"pronunciation_eval"`
	PronunciationMsg string            `json:"pronunciation_message"`
	FeedbackSuggestion string          `json:"feedback_suggestion"`
	TaskCompleted    bool              `gorm:"default:false" json:"task_completed"`
	CreatedAt        time.Time         `json:"created_at"`
}

type PlayerMissionProgress struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	PlayerID       uuid.UUID      `gorm:"type:uuid;not null" json:"player_id"`
	MissionID      uint           `json:"mission_id"`
	RoomID         *uuid.UUID     `gorm:"type:uuid" json:"room_id"`
	Status         ProgressStatus `gorm:"type:progress_status;default:'not_started'" json:"status"`
	TasksCompleted json.RawMessage `gorm:"type:jsonb" json:"tasks_completed"`
	// KillCounts: map[taskIdStr]int — conteo acumulativo de kills por tarea.
	// Separado de TasksCompleted para no romper el esquema booleano existente.
	KillCounts    json.RawMessage `gorm:"type:jsonb" json:"kill_counts"`
	StartedAt      time.Time      `json:"started_at"`
	CompletedAt    *time.Time     `json:"completed_at"`
}

type PlayerLearningStats struct {
	ID                    uint           `gorm:"primaryKey" json:"id"`
	PlayerID              uuid.UUID      `gorm:"type:uuid;not null;unique" json:"player_id"`
	AvgPronunciationScore float32        `gorm:"default:0" json:"avg_pronunciation_score"`
	TotalConversations    int            `gorm:"default:0" json:"total_conversations"`
	WeakPhonemes         json.RawMessage `gorm:"type:jsonb" json:"weak_phonemes"`
	UpdatedAt             time.Time      `json:"updated_at"`
}

type MapPickup struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SceneKey  string    `gorm:"size:100;not null" json:"scene_key"`
	ItemID    uuid.UUID `gorm:"type:uuid;not null" json:"item_id"`
	Item      Item      `gorm:"foreignKey:ItemID" json:"item"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	Quantity  int       `gorm:"default:1" json:"quantity"`
	IsPickedUp bool     `gorm:"default:false" json:"is_picked_up"` // DEPRECATED: legacy global flag, no longer the authority for combat pickups
	CreatedAt time.Time `json:"created_at"`
}

// MapPickupClaim records that a specific player has consumed a specific pickup
// template within their CURRENT attempt at a scene. Claims are per-player (so
// each user gets their own copy of the map items) and are cleared on (re)entry
// to the scene, which makes the items reappear on retry. Replaces the single
// global MapPickup.IsPickedUp flag for combat/mission maps.
type MapPickupClaim struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PlayerID  uuid.UUID `gorm:"type:uuid;not null;index:idx_pickup_claim_player_scene" json:"player_id"`
	SceneKey  string    `gorm:"size:100;not null;index:idx_pickup_claim_player_scene" json:"scene_key"`
	PickupID  uuid.UUID `gorm:"type:uuid;not null;index" json:"pickup_id"`
	ClaimedAt time.Time `json:"claimed_at"`
}

type PlayerNPCGift struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PlayerID        uuid.UUID `gorm:"type:uuid;not null;index:idx_player_npc_gift" json:"player_id"`
	NPCDefinitionID uint      `gorm:"not null;index:idx_player_npc_gift" json:"npc_definition_id"`
	ReceivedAt      time.Time `json:"received_at"`
}
