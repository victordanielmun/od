package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// -- Custom ENUMs mapped as string types --

type WAConversationStatus string

const (
	WAConversationStatusActive       WAConversationStatus = "active"
	WAConversationStatusWaitingReply WAConversationStatus = "waiting_reply"
	WAConversationStatusClosed       WAConversationStatus = "closed"
	WAConversationStatusPaused       WAConversationStatus = "paused"
)

type WAMessageRole string

const (
	WAMessageRoleUser      WAMessageRole = "user"
	WAMessageRoleAssistant WAMessageRole = "assistant"
	WAMessageRoleSystem    WAMessageRole = "system"
)

type WAMessageType string

const (
	WAMessageTypeText           WAMessageType = "text"
	WAMessageTypeMotivation     WAMessageType = "motivation"
	WAMessageTypePracticePrompt WAMessageType = "practice_prompt"
	WAMessageTypeReminder       WAMessageType = "reminder"
	WAMessageTypeFeedback       WAMessageType = "feedback"
	WAMessageTypeOnboarding     WAMessageType = "onboarding"
)

type WAReminderType string

const (
	WAReminderTypeStreakDanger       WAReminderType = "streak_danger"
	WAReminderTypeInactive1Day       WAReminderType = "inactive_1day"
	WAReminderTypeInactive3Days      WAReminderType = "inactive_3days"
	WAReminderTypeWeeklyGoal         WAReminderType = "weekly_goal"
	WAReminderTypePracticeSuggestion WAReminderType = "practice_suggestion"
	WAReminderTypeAchievementNearby   WAReminderType = "achievement_nearby"
	WAReminderTypeCustom             WAReminderType = "custom"
)

type WAReminderRecurrence string

const (
	WAReminderRecurrenceOnce   WAReminderRecurrence = "once"
	WAReminderRecurrenceDaily  WAReminderRecurrence = "daily"
	WAReminderRecurrenceWeekly WAReminderRecurrence = "weekly"
	WAReminderRecurrenceSmart  WAReminderRecurrence = "smart"
)

type WAMotivationTone string

const (
	WAMotivationToneEncouraging WAMotivationTone = "encouraging"
	WAMotivationToneCelebratory WAMotivationTone = "celebratory"
	WAMotivationToneEmpathetic  WAMotivationTone = "empathetic"
	WAMotivationToneChallenging WAMotivationTone = "challenging"
	WAMotivationToneFriendly    WAMotivationTone = "friendly"
	WAMotivationToneCurious     WAMotivationTone = "curious"
)

type WAMotivationCategory string

const (
	WAMotivationCategoryStreakKeep        WAMotivationCategory = "streak_keep"
	WAMotivationCategoryStreakLost        WAMotivationCategory = "streak_lost"
	WAMotivationCategoryAfterInactivity   WAMotivationCategory = "after_inactivity"
	WAMotivationCategoryAfterGoodPractice WAMotivationCategory = "after_good_practice"
	WAMotivationCategoryAfterBadPractice  WAMotivationCategory = "after_bad_practice"
	WAMotivationCategoryMilestoneNear     WAMotivationCategory = "milestone_near"
	WAMotivationCategoryGeneral           WAMotivationCategory = "general"
)

// -- Core GORM Structures --

// WhatsAppContact represents user WhatsApp contact details (1:1 with User)
type WhatsAppContact struct {
	ID                   uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID               uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_whatsapp_contacts_user_id" json:"user_id"`
	PhoneNumber          string     `gorm:"type:varchar(20);not null;uniqueIndex:idx_whatsapp_contacts_phone" json:"phone_number"`
	WhatsAppName         string     `gorm:"type:varchar(100)" json:"whatsapp_name"`
	NotificationsEnabled bool       `gorm:"not null;default:true;index:idx_whatsapp_contacts_notif,priority:1" json:"notifications_enabled"`
	TemporarilyDisabled  bool       `gorm:"not null;default:false;index:idx_whatsapp_contacts_notif,priority:2" json:"temporarily_disabled"`
	DisabledUntil        *time.Time `gorm:"type:timestamptz" json:"disabled_until,omitempty"`
	Timezone             string     `gorm:"type:varchar(50);not null;default:'America/Bogota'" json:"timezone"`
	PreferredHourStart   int16      `gorm:"type:int2;not null;default:8" json:"preferred_hour_start"`
	PreferredHourEnd     int16      `gorm:"type:int2;not null;default:21" json:"preferred_hour_end"`
	LastActiveAt         *time.Time `gorm:"type:timestamptz" json:"last_active_at,omitempty"`
	CreatedAt            time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt            time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`

	// Associations
	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`
}

func (WhatsAppContact) TableName() string {
	return "whatsapp_contacts"
}

// WhatsAppConversation represents a conversation session session (1:N with User)
type WhatsAppConversation struct {
	ID              uuid.UUID            `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID          uuid.UUID            `gorm:"type:uuid;not null;index:idx_whatsapp_conversations_user_id" json:"user_id"`
	Channel         string               `gorm:"type:varchar(30);not null;default:'whatsapp'" json:"channel"`
	Status          WAConversationStatus `gorm:"type:wa_conversation_status;not null;default:'active';index:idx_whatsapp_conversations_status" json:"status"`
	Intent          string               `gorm:"type:varchar(50)" json:"intent,omitempty"`
	ContextSnapshot json.RawMessage      `gorm:"type:jsonb" json:"context_snapshot,omitempty"`
	LastMessageAt   *time.Time           `gorm:"type:timestamptz;index:idx_whatsapp_conversations_last_message,sort:desc" json:"last_message_at,omitempty"`
	CreatedAt       time.Time            `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	ClosedAt        *time.Time           `gorm:"type:timestamptz" json:"closed_at,omitempty"`

	// Associations
	User     User              `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`
	Messages []WhatsAppMessage `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
}

func (WhatsAppConversation) TableName() string {
	return "whatsapp_conversations"
}

// WhatsAppMessage represents a single message in a WhatsApp conversation (1:N with WhatsAppConversation)
type WhatsAppMessage struct {
	ID             uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ConversationID uuid.UUID     `gorm:"type:uuid;not null;index:idx_whatsapp_messages_conversation_id" json:"conversation_id"`
	Role           WAMessageRole `gorm:"type:wa_message_role;not null;default:'assistant';index:idx_whatsapp_messages_role" json:"role"`
	MessageType    WAMessageType `gorm:"type:wa_message_type;not null;default:'text'" json:"message_type"`
	Content        string        `gorm:"type:text;not null" json:"content"`
	WAMessageID    string        `gorm:"type:varchar(100)" json:"wa_message_id,omitempty"`
	Metadata       json.RawMessage `gorm:"type:jsonb" json:"metadata,omitempty"`
	SentAt         time.Time     `gorm:"type:timestamptz;not null;default:now();index:idx_whatsapp_messages_sent_at,sort:desc" json:"sent_at"`

	// Associations
	Conversation WhatsAppConversation `gorm:"foreignKey:ConversationID;constraint:OnDelete:CASCADE;" json:"-"`
}

func (WhatsAppMessage) TableName() string {
	return "whatsapp_messages"
}

// WhatsAppReminder represents a scheduled automated reminder (1:N with User)
type WhatsAppReminder struct {
	ID           uuid.UUID            `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       uuid.UUID            `gorm:"type:uuid;not null;index:idx_whatsapp_reminders_user_id" json:"user_id"`
	ReminderType WAReminderType       `gorm:"type:reminder_type;not null;index:idx_whatsapp_reminders_type" json:"reminder_type"`
	Message      string               `gorm:"type:text;not null" json:"message"`
	// ChallengeID vincula el reminder con el reto de aprendizaje exacto que se envió,
	// para calificar respuestas por ID en vez de adivinar el reto por coincidencia de texto.
	ChallengeID  *uuid.UUID           `gorm:"type:uuid;index" json:"challenge_id,omitempty"`
	// AnsweredAt marca cuándo se calificó la respuesta a este reto. Evita que un mismo
	// reto se responda varias veces y otorgue XP repetida (farming).
	AnsweredAt   *time.Time           `gorm:"type:timestamptz" json:"answered_at,omitempty"`
	ScheduledAt  time.Time            `gorm:"type:timestamptz;not null;index:idx_whatsapp_reminders_scheduled,where:sent = false AND cancelled = false" json:"scheduled_at"`
	Recurrence   WAReminderRecurrence `gorm:"type:reminder_recurrence;not null;default:'once'" json:"recurrence"`
	Sent         bool                 `gorm:"not null;default:false" json:"sent"`
	SentAt       *time.Time           `gorm:"type:timestamptz" json:"sent_at,omitempty"`
	Cancelled    bool                 `gorm:"not null;default:false" json:"cancelled"`
	CreatedAt    time.Time            `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`

	// Associations
	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`
}

func (WhatsAppReminder) TableName() string {
	return "whatsapp_reminders"
}

// Motivation represents motivational catalog template
type Motivation struct {
	ID                     uuid.UUID            `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Category               WAMotivationCategory `gorm:"type:motivation_category;not null;default:'general';index:idx_motivations_category" json:"category"`
	EnglishLevel           string               `gorm:"type:varchar(20);not null;default:'all';index:idx_motivations_level" json:"english_level"`
	Tone                   WAMotivationTone     `gorm:"type:motivation_tone;not null;default:'friendly'" json:"tone"`
	MessageES              string               `gorm:"type:text;not null" json:"message_es"`
	MessageEN              string               `gorm:"type:text" json:"message_en,omitempty"`
	IncludesPracticePrompt bool                 `gorm:"not null;default:false" json:"includes_practice_prompt"`
	PracticePromptES       string               `gorm:"type:text" json:"practice_prompt_es,omitempty"`
	MinDaysInactive        *int16               `gorm:"type:int2" json:"min_days_inactive,omitempty"`
	MaxDaysInactive        *int16               `gorm:"type:int2" json:"max_days_inactive,omitempty"`
	IsActive               bool                 `gorm:"not null;default:true;index:idx_motivations_active" json:"is_active"`
	CreatedAt              time.Time            `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}

func (Motivation) TableName() string {
	return "motivations"
}

// UserMotivationHistory logs motivated interactions with users (N:N history)
type UserMotivationHistory struct {
	ID               uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID           uuid.UUID  `gorm:"type:uuid;not null;index:idx_umh_user_id" json:"user_id"`
	MotivationID     uuid.UUID  `gorm:"type:uuid;not null;index:idx_umh_motivation_id" json:"motivation_id"`
	ConversationID   *uuid.UUID `gorm:"type:uuid" json:"conversation_id,omitempty"`
	PracticeAccepted *bool      `json:"practice_accepted,omitempty"`
	SentAt           time.Time  `gorm:"type:timestamptz;not null;default:now();index:idx_umh_sent_at,sort:desc" json:"sent_at"`

	// Associations
	User         User                  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`
	Motivation   Motivation            `gorm:"foreignKey:MotivationID;constraint:OnDelete:RESTRICT;" json:"motivation,omitempty"`
	Conversation *WhatsAppConversation `gorm:"foreignKey:ConversationID;constraint:OnDelete:SET NULL;" json:"-"`
}

func (UserMotivationHistory) TableName() string {
	return "user_motivation_history"
}
