package handlers

import (
	"errors"
	"sort"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	gameWS "gather-rpg-backend/internal/websocket"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BlockHandler implementa el sistema de moderación por bloqueos:
//   - Usuario: bloquear/desbloquear a otro usuario con un motivo, listar sus bloqueos.
//   - Admin: vista agregada de quién ha sido bloqueado, por qué y cuántas veces,
//     con acciones de desactivar cuenta y notificar (advertir) al usuario.
type BlockHandler struct {
	Hub *gameWS.Hub
}

func NewBlockHandler(hub *gameWS.Hub) *BlockHandler {
	return &BlockHandler{Hub: hub}
}

type createBlockBody struct {
	BlockedID string `json:"blocked_id"`
	Reason    string `json:"reason"`
	Details   string `json:"details"`
}

// CreateBlock — POST /blocks. Upsert por par (blocker, blocked): re-bloquear
// actualiza el motivo, no duplica filas (el conteo del admin = usuarios
// distintos que lo bloquearon).
func (h *BlockHandler) CreateBlock(c *fiber.Ctx) error {
	blockerID, err := uuid.Parse(getCurrentUserID(c))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user"})
	}

	var body createBlockBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	blockedID, err := uuid.Parse(body.BlockedID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid blocked_id"})
	}
	if blockedID == blockerID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot block yourself"})
	}
	if !models.ValidBlockReasons[models.BlockReason(body.Reason)] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid reason"})
	}

	// El usuario objetivo debe existir.
	var target models.User
	if err := database.DB.Select("id").First(&target, "id = ?", blockedID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}

	var block models.UserBlock
	err = database.DB.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).First(&block).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		block = models.UserBlock{
			BlockerID: blockerID,
			BlockedID: blockedID,
			Reason:    body.Reason,
			Details:   body.Details,
		}
		if err := database.DB.Create(&block).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create block"})
		}
	} else if err == nil {
		block.Reason = body.Reason
		block.Details = body.Details
		if err := database.DB.Save(&block).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update block"})
		}
	} else {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to query block"})
	}

	// Actualización en caliente del set en memoria del cliente WS (proximidad,
	// audio, invitaciones) sin esperar a una reconexión.
	if h.Hub != nil {
		h.Hub.UpdateUserBlock(blockerID.String(), blockedID.String(), true)
	}

	return c.JSON(block)
}

// DeleteBlock — DELETE /blocks/:userId (desbloquear).
func (h *BlockHandler) DeleteBlock(c *fiber.Ctx) error {
	blockerID, err := uuid.Parse(getCurrentUserID(c))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user"})
	}
	blockedID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}

	if err := database.DB.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Delete(&models.UserBlock{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete block"})
	}

	if h.Hub != nil {
		h.Hub.UpdateUserBlock(blockerID.String(), blockedID.String(), false)
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ListMyBlocks — GET /blocks. Lista de usuarios que YO bloqueé (para que el
// frontend filtre jugadores y pinte el estado en la UI).
func (h *BlockHandler) ListMyBlocks(c *fiber.Ctx) error {
	blockerID, err := uuid.Parse(getCurrentUserID(c))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user"})
	}

	type myBlock struct {
		BlockedID uuid.UUID `json:"blocked_id"`
		Username  string    `json:"username"`
		Reason    string    `json:"reason"`
		CreatedAt time.Time `json:"created_at"`
	}
	var rows []myBlock
	if err := database.DB.Table("user_blocks").
		Joins("JOIN users ON users.id = user_blocks.blocked_id").
		Where("user_blocks.blocker_id = ?", blockerID).
		Select("user_blocks.blocked_id, users.username, user_blocks.reason, user_blocks.created_at").
		Scan(&rows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list blocks"})
	}

	return c.JSON(fiber.Map{"blocks": rows})
}

// ── Admin ────────────────────────────────────────────────────────────────────

// AdminListBlocks — GET /admin/blocks. Agregado por usuario bloqueado:
// cuántas veces (usuarios distintos), desglose de motivos, registros
// individuales y estado de la cuenta, ordenado por más bloqueado primero.
func (h *BlockHandler) AdminListBlocks(c *fiber.Ctx) error {
	type blockRow struct {
		BlockedID       uuid.UUID `json:"blocked_id"`
		BlockedUsername string    `json:"blocked_username"`
		BlockedEmail    string    `json:"blocked_email"`
		IsActive        bool      `json:"is_active"`
		BlockerUsername string    `json:"blocker_username"`
		Reason          string    `json:"reason"`
		Details         string    `json:"details"`
		CreatedAt       time.Time `json:"created_at"`
	}
	var rows []blockRow
	if err := database.DB.Table("user_blocks").
		Joins("JOIN users AS blocked ON blocked.id = user_blocks.blocked_id").
		Joins("JOIN users AS blocker ON blocker.id = user_blocks.blocker_id").
		Select(`user_blocks.blocked_id,
			blocked.username AS blocked_username,
			blocked.email    AS blocked_email,
			blocked.is_active,
			blocker.username AS blocker_username,
			user_blocks.reason, user_blocks.details, user_blocks.created_at`).
		Order("user_blocks.created_at DESC").
		Scan(&rows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list blocks"})
	}

	type blockRecord struct {
		BlockerUsername string    `json:"blocker_username"`
		Reason          string    `json:"reason"`
		Details         string    `json:"details"`
		CreatedAt       time.Time `json:"created_at"`
	}
	type blockedUserSummary struct {
		UserID      uuid.UUID      `json:"user_id"`
		Username    string         `json:"username"`
		Email       string         `json:"email"`
		IsActive    bool           `json:"is_active"`
		IsOnline    bool           `json:"is_online"`
		TotalBlocks int            `json:"total_blocks"`
		Reasons     map[string]int `json:"reasons"`
		Records     []blockRecord  `json:"records"`
	}

	byUser := make(map[uuid.UUID]*blockedUserSummary)
	order := []uuid.UUID{}
	for _, r := range rows {
		s, ok := byUser[r.BlockedID]
		if !ok {
			s = &blockedUserSummary{
				UserID:   r.BlockedID,
				Username: r.BlockedUsername,
				Email:    r.BlockedEmail,
				IsActive: r.IsActive,
				IsOnline: h.Hub != nil && h.Hub.IsUserOnline(r.BlockedID.String()),
				Reasons:  make(map[string]int),
			}
			byUser[r.BlockedID] = s
			order = append(order, r.BlockedID)
		}
		s.TotalBlocks++
		s.Reasons[r.Reason]++
		s.Records = append(s.Records, blockRecord{
			BlockerUsername: r.BlockerUsername,
			Reason:          r.Reason,
			Details:         r.Details,
			CreatedAt:       r.CreatedAt,
		})
	}

	result := make([]*blockedUserSummary, 0, len(byUser))
	for _, id := range order {
		result = append(result, byUser[id])
	}
	sort.SliceStable(result, func(i, j int) bool {
		return result[i].TotalBlocks > result[j].TotalBlocks
	})

	return c.JSON(fiber.Map{"blocked_users": result})
}

type setActiveBody struct {
	IsActive bool `json:"is_active"`
}

// AdminSetUserActive — PUT /admin/users/:id/active. Activa/desactiva la cuenta.
// Al desactivar, el usuario es expulsado del WS si está online y no podrá
// volver a iniciar sesión (check en AuthService.Login).
func (h *BlockHandler) AdminSetUserActive(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}
	var body setActiveBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	// No permitir que un admin se desactive a sí mismo por accidente.
	if !body.IsActive && userID.String() == getCurrentUserID(c) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot deactivate your own account"})
	}

	res := database.DB.Model(&models.User{}).Where("id = ?", userID).Update("is_active", body.IsActive)
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update user"})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}

	kicked := false
	if !body.IsActive && h.Hub != nil {
		kicked = h.Hub.DisconnectUser(userID.String(), "Tu cuenta ha sido desactivada por un moderador.")
	}

	return c.JSON(fiber.Map{"ok": true, "is_active": body.IsActive, "kicked": kicked})
}

type notifyBody struct {
	Message string `json:"message"`
}

// AdminNotifyUser — POST /admin/users/:id/notify. Envía una advertencia de
// moderación al usuario (WS). delivered=false si está offline.
func (h *BlockHandler) AdminNotifyUser(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}
	var body notifyBody
	if err := c.BodyParser(&body); err != nil || body.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "message is required"})
	}

	delivered := false
	if h.Hub != nil {
		delivered = h.Hub.NotifyUser(userID.String(), body.Message)
	}
	return c.JSON(fiber.Map{"ok": true, "delivered": delivered})
}
