package handlers

import (
	"errors"
	"fmt"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	gameWS "gather-rpg-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FriendHandler struct {
	Service *services.FriendService
	Hub     *gameWS.Hub
}

func NewFriendHandler(service *services.FriendService, hub *gameWS.Hub) *FriendHandler {
	return &FriendHandler{Service: service, Hub: hub}
}

func getCurrentUserID(c *fiber.Ctx) string {
	return fmt.Sprint(c.Locals("user_id"))
}

func (h *FriendHandler) ListFriends(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	friends, err := h.Service.ListFriends(currentUserID)
	if err != nil {
		if err.Error() == "guest users cannot use friends" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	type friendResponse struct {
		ID          uuid.UUID `json:"id"`
		Username    string    `json:"username"`
		IsGuest     bool      `json:"is_guest"`
		CharacterID string    `json:"character_id"`
		IsOnline    bool      `json:"is_online"`
	}

	resp := make([]friendResponse, 0, len(friends))
	for _, f := range friends {
		resp = append(resp, friendResponse{
			ID:          f.ID,
			Username:    f.Username,
			IsGuest:     f.IsGuest,
			CharacterID: f.CharacterID,
			IsOnline:    h.Hub.IsUserOnline(f.ID.String()),
		})
	}

	return c.JSON(fiber.Map{"friends": resp})
}

func (h *FriendHandler) ListRequests(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	result, err := h.Service.ListRequests(currentUserID)
	if err != nil {
		if err.Error() == "guest users cannot use friends" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

type sendFriendRequestBody struct {
	TargetUserID   string `json:"target_user_id"`
	TargetUsername string `json:"target_username"`
}

func (h *FriendHandler) SendRequest(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	var body sendFriendRequestBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var input services.SendFriendRequestInput
	if body.TargetUserID != "" {
		id, err := uuid.Parse(body.TargetUserID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid target_user_id"})
		}
		input.TargetUserID = &id
	} else if body.TargetUsername != "" {
		u := body.TargetUsername
		input.TargetUsername = &u
	}

	req, err := h.Service.SendRequest(currentUserID, input)
	if err != nil {
		switch err.Error() {
		case "guest users cannot use friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "target_user_id or target_username is required", "cannot add yourself", "cannot add guest users":
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		case "already friends", "friend request already pending":
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Notify Target User via WebSocket
	// We need the requester username
	requesterUser, _ := h.Service.UserRepo.FindByID(currentUserID)
	if requesterUser != nil {
		h.Hub.SendToUser(req.AddresseeID.String(), &models.WSMessage{
			Type: "friend_request_received",
			Payload: map[string]interface{}{
				"request_id":         req.ID,
				"requester_id":       req.RequesterID,
				"requester_username": requesterUser.Username,
				"timestamp":          req.CreatedAt,
			},
		})
	}

	h.Hub.NotifyFriendUpdate(req.RequesterID.String())
	h.Hub.NotifyFriendUpdate(req.AddresseeID.String())

	return c.Status(fiber.StatusCreated).JSON(req)
}

func (h *FriendHandler) AcceptRequest(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request id"})
	}

	req, err := h.Service.AcceptRequest(currentUserID, id)
	if err != nil {
		switch err.Error() {
		case "guest users cannot use friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "not allowed":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "request is not pending":
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Notify both users of friendship changes
	h.Hub.NotifyFriendUpdate(req.RequesterID.String())
	h.Hub.NotifyFriendUpdate(req.AddresseeID.String())

	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *FriendHandler) RejectRequest(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request id"})
	}

	req, err := h.Service.RejectRequest(currentUserID, id)
	if err != nil {
		switch err.Error() {
		case "guest users cannot use friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "not allowed":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "request is not pending":
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Notify both users of request status changes
	h.Hub.NotifyFriendUpdate(req.RequesterID.String())
	h.Hub.NotifyFriendUpdate(req.AddresseeID.String())

	return c.JSON(fiber.Map{"status": "ok"})
}

// GetConversation returns the persisted private message history with a friend.
func (h *FriendHandler) GetConversation(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	friendID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid friend id"})
	}

	messages, err := h.Service.GetConversation(currentUserID, friendID, c.QueryInt("limit", 100))
	if err != nil {
		switch err.Error() {
		case "guest users cannot use friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "not friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	return c.JSON(fiber.Map{"messages": messages})
}

func (h *FriendHandler) RemoveFriend(c *fiber.Ctx) error {
	currentUserID := getCurrentUserID(c)
	friendID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid friend id"})
	}

	if err := h.Service.RemoveFriend(currentUserID, friendID); err != nil {
		switch err.Error() {
		case "guest users cannot use friends":
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case "invalid friend":
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		case "not friends":
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Notify both users of friendship removal
	h.Hub.NotifyFriendUpdate(currentUserID)
	h.Hub.NotifyFriendUpdate(friendID.String())

	return c.JSON(fiber.Map{"status": "ok"})
}

