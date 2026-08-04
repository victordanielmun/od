package websocket

import (
	"errors"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (h *Hub) NotifyFriendUpdate(userID string) {
	msg := &models.WSMessage{
		Type: "friend_list_update",
		Payload: map[string]string{
			"user_id": userID,
		},
	}
	h.SendToUser(userID, msg)
}

func (h *Hub) notifyFriendsOnlineStatus(userID string) {
	if database.DB == nil {
		return
	}
	go func() {
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			return
		}

		// Find friends in DB
		var friendships []models.Friendship
		err = database.DB.Where("user1_id = ? OR user2_id = ?", userUUID, userUUID).Find(&friendships).Error
		if err != nil {
			return
		}

		friendIDs := make([]string, 0, len(friendships))
		for _, f := range friendships {
			if f.User1ID == userUUID {
				friendIDs = append(friendIDs, f.User2ID.String())
			} else {
				friendIDs = append(friendIDs, f.User1ID.String())
			}
		}

		// Send "friend_list_update" to every online friend
		msg := &models.WSMessage{
			Type: "friend_list_update",
			Payload: map[string]string{
				"user_id": userID,
			},
		}

		for _, friendID := range friendIDs {
			h.SendToUser(friendID, msg)
		}
	}()
}

func canonicalPair(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if a.String() < b.String() {
		return a, b
	}
	return b, a
}

// areFriends reports whether two users have an established friendship.
// In no-DB (dev) mode it returns true so local testing isn't blocked.
func (h *Hub) areFriends(a, b uuid.UUID) bool {
	if database.DB == nil {
		return true
	}
	u1, u2 := canonicalPair(a, b)
	var friendship models.Friendship
	err := database.DB.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&friendship).Error
	return err == nil
}

func (h *Hub) handleChatRequest(client *Client, payload models.ChatRequestPayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	// Moderación: un par bloqueado (cualquier dirección) no puede iniciar chats.
	// Drop silencioso: no se revela al emisor que fue bloqueado.
	if h.blockedBetweenDB(client.ID, targetID) {
		return
	}

	// Jugadores con IA: la conversación se abre en el acto. No pueden pulsar
	// "aceptar" una solicitud, así que el trámite de amistad no aplica; y hacerles
	// pasar por él dejaría al jugador esperando una respuesta que no llega nunca.
	if h.isAIPlayer(targetID) {
		h.openAIPlayerChat(client, targetID)
		return
	}

	if database.DB == nil {
		targetClient := h.findClientByID(targetID.String())

		if targetClient != nil {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgChatRequestBcast,
				Payload: map[string]string{
					"requester_id":   client.ID.String(),
					"requester_name": client.Username,
				},
			})
		}
		return
	}

	// 1. Check if friendship already exists
	u1, u2 := canonicalPair(client.ID, targetID)
	var friendship models.Friendship
	err = database.DB.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&friendship).Error
	if err == nil {
		// Friendship exists, start session directly!
		var targetUser models.User
		if err := database.DB.Select("username").Where("id = ?", targetID).First(&targetUser).Error; err == nil {
			msgForClient := &models.WSMessage{
				Type: MsgChatSessionStart,
				Payload: map[string]string{
					"partner_id":   targetID.String(),
					"partner_name": targetUser.Username,
				},
			}
			client.SendJSON(msgForClient)

			targetClient := h.findClientByID(targetID.String())

			if targetClient != nil {
				msgForTarget := &models.WSMessage{
					Type: MsgChatSessionStart,
					Payload: map[string]string{
						"partner_id":   client.ID.String(),
						"partner_name": client.Username,
					},
				}
				targetClient.SendJSON(msgForTarget)
			}
		}
		return
	}

	// 2. Check if B (target) has a pending request to A (client)
	var pendingFromTarget models.FriendRequest
	err = database.DB.Where("requester_id = ? AND addressee_id = ? AND status = ?", targetID, client.ID, models.FriendRequestPending).First(&pendingFromTarget).Error
	if err == nil {
		// Auto-accept the request!
		err = database.DB.Transaction(func(tx *gorm.DB) error {
			f := &models.Friendship{User1ID: u1, User2ID: u2}
			if err := tx.Create(f).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.FriendRequest{}).Where("id = ?", pendingFromTarget.ID).Update("status", models.FriendRequestAccepted).Error; err != nil {
				return err
			}
			return nil
		})
		if err == nil {
			h.NotifyFriendUpdate(client.ID.String())
			h.NotifyFriendUpdate(targetID.String())

			var targetUser models.User
			if err := database.DB.Select("username").Where("id = ?", targetID).First(&targetUser).Error; err == nil {
				client.SendJSON(&models.WSMessage{
					Type: MsgChatSessionStart,
					Payload: map[string]string{
						"partner_id":   targetID.String(),
						"partner_name": targetUser.Username,
					},
				})

				targetClient := h.findClientByID(targetID.String())

				if targetClient != nil {
					targetClient.SendJSON(&models.WSMessage{
						Type: MsgChatSessionStart,
						Payload: map[string]string{
							"partner_id":   client.ID.String(),
							"partner_name": client.Username,
						},
					})
				}
			}
			return
		}
	}

	// 3. No friendship and no pending request from target → create a pending
	//    request and send ONE interactive prompt (the accept/reject popup).
	//    If a pending request already exists, do nothing so re-clicking a player
	//    doesn't spam them with popups; the request is still visible in their
	//    friends panel.
	var existingPending models.FriendRequest
	err = database.DB.Where("requester_id = ? AND addressee_id = ? AND status = ?", client.ID, targetID, models.FriendRequestPending).First(&existingPending).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		req := &models.FriendRequest{
			RequesterID: client.ID,
			AddresseeID: targetID,
			Status:      models.FriendRequestPending,
		}
		if err := database.DB.Create(req).Error; err == nil {
			// Refresh both friends panels (this also dispatches the pending-request
			// refresh on the client, so the request shows up even if the popup is missed).
			h.NotifyFriendUpdate(targetID.String())
			h.NotifyFriendUpdate(client.ID.String())

			// Single interactive prompt to the target.
			if targetClient := h.findClientByID(targetID.String()); targetClient != nil {
				targetClient.SendJSON(&models.WSMessage{
					Type: MsgChatRequestBcast,
					Payload: map[string]string{
						"requester_id":   client.ID.String(),
						"requester_name": client.Username,
					},
				})
			}
		}
	}
}

func (h *Hub) handleChatResponse(client *Client, payload models.ChatResponsePayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	targetClient := h.findClientByID(targetID.String())

	if database.DB == nil {
		if targetClient != nil {
			if payload.Accepted {
				msg := &models.WSMessage{
					Type: MsgChatSessionStart,
					Payload: map[string]string{
						"partner_id":   client.ID.String(),
						"partner_name": client.Username,
					},
				}
				targetClient.SendJSON(msg)

				client.SendJSON(&models.WSMessage{
					Type: MsgChatSessionStart,
					Payload: map[string]string{
						"partner_id":   targetID.String(),
						"partner_name": targetClient.Username,
					},
				})
			} else {
				targetClient.SendJSON(&models.WSMessage{
					Type: MsgChatReject,
					Payload: map[string]string{
						"rejecter_id":   client.ID.String(),
						"rejecter_name": client.Username,
					},
				})
			}
		}
		return
	}

	if payload.Accepted {
		u1, u2 := canonicalPair(client.ID, targetID)

		var req models.FriendRequest
		_ = database.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("requester_id = ? AND addressee_id = ? AND status = ?", targetID, client.ID, models.FriendRequestPending).First(&req).Error; err != nil {
				var friendship models.Friendship
				if err2 := tx.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&friendship).Error; errors.Is(err2, gorm.ErrRecordNotFound) {
					f := &models.Friendship{User1ID: u1, User2ID: u2}
					if err3 := tx.Create(f).Error; err3 != nil {
						return err3
					}
				}
				return nil
			}

			var friendship models.Friendship
			if err2 := tx.Where("user1_id = ? AND user2_id = ?", u1, u2).First(&friendship).Error; errors.Is(err2, gorm.ErrRecordNotFound) {
				f := &models.Friendship{User1ID: u1, User2ID: u2}
				if err3 := tx.Create(f).Error; err3 != nil {
					return err3
				}
			}

			if err := tx.Model(&models.FriendRequest{}).Where("id = ?", req.ID).Update("status", models.FriendRequestAccepted).Error; err != nil {
				return err
			}
			return nil
		})

		h.NotifyFriendUpdate(client.ID.String())
		h.NotifyFriendUpdate(targetID.String())

		if targetClient != nil {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgChatSessionStart,
				Payload: map[string]string{
					"partner_id":   client.ID.String(),
					"partner_name": client.Username,
				},
			})
		}

		client.SendJSON(&models.WSMessage{
			Type: MsgChatSessionStart,
			Payload: map[string]string{
				"partner_id": targetID.String(),
				"partner_name": func() string {
					if targetClient != nil {
						return targetClient.Username
					}
					var user models.User
					if err := database.DB.Select("username").Where("id = ?", targetID).First(&user).Error; err == nil {
						return user.Username
					}
					return ""
				}(),
			},
		})
	} else {
		database.DB.Model(&models.FriendRequest{}).
			Where("requester_id = ? AND addressee_id = ? AND status = ?", targetID, client.ID, models.FriendRequestPending).
			Update("status", models.FriendRequestRejected)

		h.NotifyFriendUpdate(client.ID.String())
		h.NotifyFriendUpdate(targetID.String())

		if targetClient != nil {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgChatReject,
				Payload: map[string]string{
					"rejecter_id":   client.ID.String(),
					"rejecter_name": client.Username,
				},
			})
		}
	}
}

func (h *Hub) handlePrivateMessage(client *Client, payload models.PrivateMessagePayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	if payload.Message == "" {
		return
	}

	// Only allow private messages between friends. Los jugadores con IA quedan
	// exentos: no tienen (ni pueden aceptar) solicitudes de amistad, y el sentido
	// de que estén en el lobby es justamente poder escribirles sin trámite.
	if !h.isAIPlayer(targetID) && !h.areFriends(client.ID, targetID) {
		client.SendError("Solo puedes enviar mensajes a tus amigos")
		return
	}

	// Moderación: si hay bloqueo en cualquier dirección, el mensaje no se
	// persiste ni se entrega. Drop silencioso (no revelar el bloqueo).
	if h.blockedBetweenDB(client.ID, targetID) {
		return
	}

	// Persist the message so it survives reconnects and is delivered as history
	// even when the recipient is currently offline.
	if database.DB != nil {
		dm := &models.DirectMessage{
			SenderID:    client.ID,
			RecipientID: targetID,
			Content:     payload.Message,
		}
		if err := database.DB.Create(dm).Error; err != nil {
			// Log and continue: a failed persist shouldn't block live delivery.
			log.Printf("[Social] Failed to persist private message: %v", err)
		}
	}

	targetClient := h.findClientByID(targetID.String())

	if targetClient != nil {
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgPrivateMessage,
			Payload: map[string]string{
				"sender_id":   client.ID.String(),
				"sender_name": client.Username,
				"message":     payload.Message,
			},
		})
	}
}

func (h *Hub) handleTeleportToFriend(client *Client, targetUserID string) {
	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		client.SendError("Invalid target user ID")
		return
	}

	if !h.areFriends(client.ID, targetUUID) {
		client.SendError("Solo puedes teletransportarte hacia tus amigos")
		return
	}

	// Moderación: no permitir teletransportarse hacia alguien con quien hay
	// bloqueo. Mensaje opaco para no revelar el bloqueo.
	if h.blockedBetweenDB(client.ID, targetUUID) {
		client.SendError("El amigo no está conectado")
		return
	}

	friendClient := h.findClientByID(targetUUID.String())

	if friendClient == nil {
		client.SendError("El amigo no está conectado")
		return
	}

	if friendClient.RoomID == "" {
		client.SendError("El amigo no se encuentra en ninguna sala activa")
		return
	}

	h.mu.RLock()
	targetRoom, exists := h.Rooms[friendClient.RoomID]
	h.mu.RUnlock()

	if !exists {
		client.SendError("No se pudo localizar la sala del amigo")
		return
	}

	// Approve map join for the target room with direct x, y coordinates of the friend
	client.SendJSON(&models.WSMessage{
		Type: MsgMapJoinApproved,
		Payload: map[string]interface{}{
			"room_id":     targetRoom.ID,
			"scene_key":   targetRoom.SceneKey,
			"type":        targetRoom.Type,
			"invite_code": targetRoom.InviteCode,
			"x":           friendClient.X,
			"y":           friendClient.Y,
		},
	})
}

func (h *Hub) handleSendRoomInvite(client *Client, targetUserID string) {
	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		client.SendError("Invalid target user ID")
		return
	}

	if client.RoomID == "" {
		client.SendError("Debes estar en una sala para poder enviar invitaciones")
		return
	}

	h.mu.RLock()
	room, exists := h.Rooms[client.RoomID]
	h.mu.RUnlock()

	if !exists {
		client.SendError("No se pudo localizar tu sala actual")
		return
	}

	if !h.areFriends(client.ID, targetUUID) {
		client.SendError("Solo puedes invitar a tus amigos")
		return
	}

	// Moderación: invitaciones entre usuarios bloqueados se descartan en silencio.
	if h.blockedBetweenDB(client.ID, targetUUID) {
		return
	}

	targetClient := h.findClientByID(targetUUID.String())

	if targetClient == nil {
		client.SendError("El amigo no está conectado")
		return
	}

	targetClient.SendJSON(&models.WSMessage{
		Type: MsgRoomInviteReceived,
		Payload: map[string]interface{}{
			"inviter_id":   client.ID.String(),
			"inviter_name": client.Username,
			"room_id":      room.ID,
			"scene_key":    room.SceneKey,
			"invite_code":  room.InviteCode,
		},
	})
}
