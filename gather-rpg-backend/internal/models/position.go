package models

import (
	"time"
)

// Position represents the in-memory structure for a user's position
type Position struct {
	UserID    string    `json:"user_id"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	Direction string    `json:"direction"` // "up", "down", "left", "right", "idle"
	IsMoving  bool      `json:"is_moving"`
	Anim      string    `json:"anim"`
	Username  string    `json:"username"` // Populated from other sources if needed
	Timestamp time.Time `json:"timestamp"`
}

// RedisPosition represents the JSON structure stored in Redis
type RedisPosition struct {
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Direction string  `json:"direction"`
	IsMoving  bool    `json:"is_moving"`
	Anim      string  `json:"anim"` // Optional: animation state
	Username  string  `json:"username,omitempty"`
}
