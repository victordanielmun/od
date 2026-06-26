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
	MsgPlayerJoined      = "player_joined"
	MsgUserLeft          = "user_left"
	MsgChatBroadcast     = "chat_broadcast"
	MsgPlayerMoved       = "position_update" // Changed from "player_moved"
	MsgPositionsUpdate   = "positions_update" // Plural for batching
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
	MsgAudioMuteState      = "audio_mute_state" // Broadcast: user toggled self-mute in a session


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

	// Missions
	MsgMissionCompleted   = "mission_completed"
	MsgEnemyKillProgress  = "enemy_kill_progress" // Progreso de kills enviado al jugador atacante

	// Real-time Combat
	MsgEnemyUpdate      = "enemy_update"
	MsgEnemyDied        = "enemy_died"
	MsgPlayerAttack     = "player_attack"
	MsgWaveStarted      = "wave_started"
	MsgPlayerHit        = "player_hit"    // c→s: el jugador reporta que un enemigo lo golpeó
	MsgPlayerHP         = "player_hp"     // s→c: HP autoritativo del jugador
	MsgPlayerDied       = "player_died"   // s→c: el jugador murió (HP a 0)
	MsgPlayerRespawn    = "player_respawn" // c→s: el jugador solicita revivir (reset HP)
	MsgPlayerHeal       = "player_heal"   // c→s: el jugador usó una poción de vida (cura server-side)
	MsgPlayerMP         = "player_mp"     // s→c: maná autoritativo del jugador
	MsgSpendMana        = "spend_mana"    // c→s: gastar maná (hechizo/arrojadizo); el server valida y persiste
	MsgRefreshMana      = "refresh_mana"  // c→s: recargar maná desde BD (tras usar poción de maná en inventario)

	// Ninja Cards
	MsgNinjaCardTriggered = "ninja_card_triggered"
	MsgNinjaCardAnswer    = "ninja_card_answer"
	MsgNinjaCardResult    = "ninja_card_result"

	// Friend Teleportation & Room Invitations
	MsgTeleportToFriend   = "teleport_to_friend"
	MsgSendRoomInvite     = "send_room_invite"
	MsgRoomInviteReceived = "room_invite_received"
)
