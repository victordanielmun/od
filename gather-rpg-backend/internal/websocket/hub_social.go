package websocket

import (
	"errors"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

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

func (h *Hub) handleChatRequest(client *Client, payload models.ChatRequestPayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
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

	// 3. Check if A (client) already has a pending request to B (target)
	var existingPending models.FriendRequest
	err = database.DB.Where("requester_id = ? AND addressee_id = ? AND status = ?", client.ID, targetID, models.FriendRequestPending).First(&existingPending).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create a pending request
		req := &models.FriendRequest{
			RequesterID: client.ID,
			AddresseeID: targetID,
			Status:      models.FriendRequestPending,
		}
		if err := database.DB.Create(req).Error; err == nil {
			h.NotifyFriendUpdate(targetID.String())
			h.NotifyFriendUpdate(client.ID.String())

			// Send friend_request_received WS event to target
			targetClient := h.findClientByID(targetID.String())

			if targetClient != nil {
				targetClient.SendJSON(&models.WSMessage{
					Type: "friend_request_received",
					Payload: map[string]interface{}{
						"request_id":         req.ID,
						"requester_id":       client.ID,
						"requester_username": client.Username,
						"timestamp":          req.CreatedAt,
					},
				})
			}
		}
	}

	// 4. Send chat request popup/prompt to target if online
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
