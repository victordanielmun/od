package websocket

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"log"
	"time"

	"github.com/google/uuid"
)

// blockedBetweenDB reporta si existe un bloqueo entre a y b EN CUALQUIER
// dirección, consultando la DB (cubre usuarios offline, cuyo set en memoria no
// está disponible). Para el hot path de proximidad se usan los sets en memoria
// de los clientes; esto es para acciones puntuales (mensajes, invites, teleport).
func (h *Hub) blockedBetweenDB(a, b uuid.UUID) bool {
	if database.DB == nil {
		return false
	}
	var count int64
	database.DB.Model(&models.UserBlock{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", a, b, b, a).
		Count(&count)
	return count > 0
}

// UpdateUserBlock actualiza en caliente el set de bloqueados del blocker si
// está online (lo llama el handler HTTP al crear/eliminar un bloqueo, para que
// el filtrado de proximidad/audio surta efecto sin reconectar).
func (h *Hub) UpdateUserBlock(blockerID, blockedID string, blocked bool) {
	if c := h.findClientByID(blockerID); c != nil {
		c.SetBlocked(blockedID, blocked)
	}
}

// DisconnectUser expulsa a un usuario conectado (cuenta desactivada por el
// admin). Envía el motivo y cierra la conexión tras un pequeño margen para que
// el mensaje alcance a salir por el WritePump; el cierre dispara el flujo
// normal de Unregister vía ReadPump. Devuelve true si el usuario estaba online.
func (h *Hub) DisconnectUser(userID, reason string) bool {
	client := h.findClientByID(userID)
	if client == nil {
		return false
	}
	client.SendError(reason)
	log.Printf("[Blocks] Disconnecting user %s (account deactivated)", userID)
	time.AfterFunc(500*time.Millisecond, func() {
		_ = client.Conn.Close()
	})
	return true
}

// NotifyUser envía un aviso administrativo (advertencia de moderación) al
// usuario si está online. Devuelve false si está offline (no se entrega).
func (h *Hub) NotifyUser(userID, message string) bool {
	client := h.findClientByID(userID)
	if client == nil {
		return false
	}
	client.SendJSON(&models.WSMessage{
		Type: MsgAdminNotice,
		Payload: map[string]string{
			"message": message,
		},
	})
	return true
}
