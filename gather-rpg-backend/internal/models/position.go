package models

// Position represents the in-memory structure for a user's position
type Position struct {
	UserID      string    `json:"user_id"`
	X           float64   `json:"x"`
	Y           float64   `json:"y"`
	Direction   string    `json:"direction"`
	Anim        string    `json:"anim"`
	IsMoving    bool      `json:"is_moving"`
	Username    string    `json:"username"` // Populated from other sources if needed
	CharacterID string    `json:"character_id"`
	Timestamp   int64     `json:"timestamp"`
}

// RedisPosition represents the JSON structure stored in Redis
type RedisPosition struct {
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Direction   string  `json:"direction"`
	IsMoving    bool    `json:"is_moving"`
	Anim        string  `json:"anim"` // Optional: animation state
	Username    string  `json:"username,omitempty"`
	CharacterID string  `json:"character_id,omitempty"`
	Timestamp   int64   `json:"timestamp,omitempty"`
}
