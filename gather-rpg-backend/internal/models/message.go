package models

import "github.com/google/uuid"

// WSMessage represents the standard WebSocket message format
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Payload structures for specific message types

type JoinRoomPayload struct {
	RoomID string `json:"room_id"`
	// Optional initial position
	X *float64 `json:"x,omitempty"`
	Y *float64 `json:"y,omitempty"`
}

type LeaveRoomPayload struct {
	RoomID string `json:"room_id"`
}

type ChatMessagePayload struct {
	RoomID  string `json:"room_id"`
	Message string `json:"message"`
}

type PlayerMovePayload struct {
	RoomID    string  `json:"room_id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"` // "up", "down", "left", "right"
	Anim      string  `json:"anim"`      // "idle", "walk"
	IsMoving  bool    `json:"is_moving"`
	Timestamp int64   `json:"timestamp,omitempty"`
}

type ChatRequestPayload struct {
	TargetID string `json:"target_id"`
}

type ChatResponsePayload struct {
	TargetID string `json:"target_id"`
	Accepted bool   `json:"accepted"`
}

type PrivateMessagePayload struct {
	TargetID string `json:"target_id"`
	Message  string `json:"message"`
}

// Broadcast payloads

type RoomJoinedPayload struct {
	RoomID       string                  `json:"room_id"`
	Users        []string                `json:"users"` // Deprecated
	Participants map[string]UserPosition `json:"participants,omitempty"`
}

// UserPosition is used in snapshots/participants list
type UserPosition struct {
	UserID      string  `json:"user_id"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Direction   string  `json:"direction"`
	Anim        string  `json:"anim"`
	Username    string  `json:"username"`
	CharacterID string  `json:"character_id"`
	Timestamp   int64   `json:"timestamp,omitempty"`
}

type ChatMessageBroadcast struct {
	UserID    uuid.UUID `json:"user_id"`
	Username  string    `json:"username"`
	Message   string    `json:"message"`
	Timestamp string    `json:"timestamp"`
	RoomID    string    `json:"room_id"`
}

type UserJoinedBroadcast struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	RoomID   string    `json:"room_id"`
	X        float64   `json:"x"`
	Y        float64   `json:"y"`
}

type UserLeftBroadcast struct {
	UserID uuid.UUID `json:"user_id"`
	RoomID string    `json:"room_id"`
}

type PlayerMovedBroadcast struct {
	UserID      uuid.UUID `json:"user_id"`
	RoomID      string    `json:"room_id"`
	X           float64   `json:"x"`
	Y           float64   `json:"y"`
	Direction   string    `json:"direction"`
	Anim        string    `json:"anim"`
	IsMoving    bool      `json:"is_moving"`
	Username    string    `json:"username"`
	CharacterID string    `json:"character_id"`
	// IsAI marca a los jugadores gobernados por el servidor (los del lobby). El
	// cliente lo necesita para no ofrecerles los flujos sociales de una persona
	// real (petición de amistad, invitación a sala, bloqueo).
	IsAI      bool  `json:"is_ai,omitempty"`
	Timestamp int64 `json:"timestamp,omitempty"`
}

type JoinChallengePayload struct {
	ChallengeID string `json:"challenge_id"`
}

type LeaveChallengePayload struct {
	ChallengeID string `json:"challenge_id"`
}

type ChallengeParticipant struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
}

type ChallengeJoinedPayload struct {
	ChallengeID  string                 `json:"challenge_id"`
	Participants []ChallengeParticipant `json:"participants"`
}

type ChallengeLeftPayload struct {
	ChallengeID string `json:"challenge_id"`
}

type ChallengeUserJoinedPayload struct {
	ChallengeID string    `json:"challenge_id"`
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
}

type ChallengeUserLeftPayload struct {
	ChallengeID string    `json:"challenge_id"`
	UserID      uuid.UUID `json:"user_id"`
}

type ChallengeChatMessagePayload struct {
	ChallengeID string `json:"challenge_id"`
	Message     string `json:"message"`
}

type ChallengeChatBroadcast struct {
	ChallengeID string    `json:"challenge_id"`
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	Message     string    `json:"message"`
	Timestamp   string    `json:"timestamp"`
}

type PlayerEmojiPayload struct {
	EmojiID string `json:"emoji_id"` // character portrait id (e.g. "1c")
	RoomID  string `json:"room_id"`
}

type EmojiBroadcast struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	EmojiID  string    `json:"emoji_id"`
	RoomID   string    `json:"room_id"`
}

type MissionCompletedBroadcast struct {
	MissionID     uint   `json:"mission_id"`
	Title         string `json:"title"`
	DescriptionEn string `json:"description_en"`
	RewardGold    int    `json:"reward_gold"`
	RoomID        string `json:"room_id"`
}
