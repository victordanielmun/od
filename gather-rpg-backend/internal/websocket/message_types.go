package websocket

const (
	MsgJoinRoom        = "join_room"
	MsgLeaveRoom       = "leave_room"
	MsgChatMessage     = "chat_message"
	MsgPlayerMove      = "update_position" // Changed from "player_move" to match spec
	MsgReqPositions    = "request_positions"
	MsgSelectClass     = "select_character"  // New
	MsgRequestMapJoin  = "request_map_join"  // New
	MsgMapJoinApproved = "map_join_approved" // New

	MsgRoomJoined        = "room_joined"
	MsgUserJoined        = "user_joined"
	MsgUserLeft          = "user_left"
	MsgChatBroadcast     = "chat_broadcast"
	MsgPlayerMoved       = "position_update" // Changed from "player_moved"
	MsgPositionsSnap     = "positions_snapshot"
	MsgUserOutOfRange    = "user_out_of_range"
	MsgCharacterSelected = "character_selected" // New

	// WebRTC Signaling
	MsgWebRTCOffer        = "webrtc_offer"
	MsgWebRTCAnswer       = "webrtc_answer"
	MsgWebRTCIceCandidate = "webrtc_ice_candidate"
	MsgWebRTCDisconnect   = "webrtc_disconnect"

	// WebRTC Control
	MsgStartPeerConnection = "start_peer_connection"
	MsgClosePeerConnection = "close_peer_connection"
	MsgAudioVolumeUpdate   = "audio_volume_update"

	// Combat
	MsgEncounterEnemy = "encounter_enemy"
	MsgCombatStarted  = "combat_started"
	MsgCombatAction   = "combat_action"
	MsgTurnResult     = "turn_result"
	MsgCombatEnded    = "combat_ended"

	// Proximity Chat
	MsgChatRequest      = "chat_request"
	MsgChatRequestBcast = "chat_request_broadcast" // Notify target
	MsgChatAccept       = "chat_accept"
	MsgChatReject       = "chat_reject"
	MsgChatSessionStart = "chat_session_start" // Notify both
	MsgPrivateMessage   = "private_message"

	// Challenge Sessions (group call + group chat)
	MsgJoinChallenge          = "join_challenge"
	MsgLeaveChallenge         = "leave_challenge"
	MsgChallengeJoined        = "challenge_joined"
	MsgChallengeLeft          = "challenge_left"
	MsgChallengeUserJoined    = "challenge_user_joined"
	MsgChallengeUserLeft      = "challenge_user_left"
	MsgChallengeChatMessage   = "challenge_chat_message"
	MsgChallengeChatBroadcast = "challenge_chat_broadcast"

	// Emojis
	MsgPlayerEmoji    = "player_emoji"
	MsgEmojiBroadcast = "emoji_broadcast"
)
