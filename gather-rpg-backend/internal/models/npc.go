package models

// Real-time NPC Models (Websocket)
type ActiveNPC struct {
	TemplateID    uint    `json:"template_id"`
	X             float64 `json:"x"`
	Y             float64 `json:"y"`
	State         string  `json:"state"` // "idle", "talking", "walking"
	SpawnX        float64 `json:"spawn_x"`
	SpawnY        float64 `json:"spawn_y"`
	TargetX       float64 `json:"target_x"`
	TargetY       float64 `json:"target_y"`
	MoveTimer     int64   `json:"-"`
	Speed         float64 `json:"speed"`
	Range         float64 `json:"range"`
	MovementType  string  `json:"movement_type"`
	IsTalking     bool    `json:"is_talking"`
	TalkingWith   string  `json:"talking_with,omitempty"`
	TalkingExpire int64   `json:"-"`
}

type NPCUpdateBroadcast struct {
	RoomID string      `json:"room_id"`
	NPCs   []ActiveNPC `json:"npcs"`
}
