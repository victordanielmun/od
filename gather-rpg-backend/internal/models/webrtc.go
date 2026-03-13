package models

import (
	"time"

	"github.com/google/uuid"
)

// WebRTC Signaling Payloads (Client -> Server)

type WebRTCOfferPayload struct {
	TargetUserID string `json:"target_user_id"`
	SDP          string `json:"sdp"`
	Type         string `json:"type"` // "offer"
	SessionID    string `json:"session_id"`
}

type WebRTCAnswerPayload struct {
	TargetUserID string `json:"target_user_id"`
	SDP          string `json:"sdp"`
	Type         string `json:"type"` // "answer"
	SessionID    string `json:"session_id"`
}

type WebRTCIceCandidatePayload struct {
	TargetUserID  string `json:"target_user_id"`
	Candidate     string `json:"candidate"`
	SDPMid        string `json:"sdp_mid"`
	SDPMLineIndex int    `json:"sdp_m_line_index"`
	SessionID     string `json:"session_id"`
}

type WebRTCDisconnectPayload struct {
	PeerUserID string `json:"peer_user_id"`
	SessionID  string `json:"session_id"`
}

// WebRTC Broadcast Payloads (Server -> Client)

type WebRTCOfferBroadcast struct {
	FromUserID uuid.UUID `json:"from_user_id"`
	Username   string    `json:"username"`
	SDP        string    `json:"sdp"`
	Type       string    `json:"type"`
	SessionID  string    `json:"session_id,omitempty"`
}

type WebRTCAnswerBroadcast struct {
	FromUserID uuid.UUID `json:"from_user_id"`
	SDP        string    `json:"sdp"`
	Type       string    `json:"type"`
	SessionID  string    `json:"session_id,omitempty"`
}

type WebRTCIceCandidateBroadcast struct {
	FromUserID    uuid.UUID `json:"from_user_id"`
	Candidate     string    `json:"candidate"`
	SDPMid        string    `json:"sdp_mid"`
	SDPMLineIndex int       `json:"sdp_m_line_index"`
	SessionID     string    `json:"session_id,omitempty"`
}

type StartPeerConnectionPayload struct {
	PeerUserID   uuid.UUID `json:"peer_user_id"`
	PeerUsername string    `json:"peer_username"`
	Distance     float64   `json:"distance"`
	Initiator    bool      `json:"initiator,omitempty"`
	SessionID    string    `json:"session_id,omitempty"`
}

type ClosePeerConnectionPayload struct {
	PeerUserID uuid.UUID `json:"peer_user_id"`
	Reason     string    `json:"reason"` // "out_of_range", "disconnected", "stale"
	SessionID  string    `json:"session_id,omitempty"`
}

type AudioVolumeUpdatePayload struct {
	PeerUserID uuid.UUID `json:"peer_user_id"`
	Volume     float64   `json:"volume"`
	Distance   float64   `json:"distance"`
	SessionID  string    `json:"session_id,omitempty"`
}

// Internal PeerConnection Model
type PeerConnection struct {
	UserID    string
	PeerID    string
	SessionID string
	RoomID    string
	State     string // "connecting", "connected", "disconnected"
	CreatedAt time.Time
	LastPing  time.Time
}
