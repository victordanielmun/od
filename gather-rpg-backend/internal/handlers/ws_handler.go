package handlers

import (
	"log"

	gameWS "gather-rpg-backend/internal/websocket"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
)

type WSHandler struct {
	Hub *gameWS.Hub
}

func NewWSHandler(hub *gameWS.Hub) *WSHandler {
	return &WSHandler{Hub: hub}
}

func (h *WSHandler) HandleWS(c *websocket.Conn) {
	// Token validation happens in middleware before upgrade usually.
	// Here we extract user info from locals (set by middleware)

	userIDStr := c.Locals("user_id").(string)
	username := c.Locals("username").(string)

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Println("Invalid UUID:", err)
		c.Close()
		return
	}

	client := gameWS.NewClient(h.Hub, c, userID, username)
	// Cargar el set de usuarios bloqueados ANTES de registrar: una vez en el hub,
	// el set lo leen los loops de proximidad y los handlers sociales.
	client.LoadBlocks()
	h.Hub.Register <- client

	go client.WritePump()
	client.ReadPump()
}
