package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// normalizeDifficulty coerces a raw difficulty string into a valid enum value,
// defaulting to beginner when empty or unrecognized. Difficulty is an informative
// label shown to players (not a gate); this just keeps the stored value clean since
// the admin form may omit or mistype the field.
func normalizeDifficulty(raw models.DifficultyLevel) models.DifficultyLevel {
	switch models.DifficultyLevel(strings.ToLower(strings.TrimSpace(string(raw)))) {
	case models.DifficultyIntermediate:
		return models.DifficultyIntermediate
	case models.DifficultyAdvanced:
		return models.DifficultyAdvanced
	default:
		return models.DifficultyBeginner
	}
}

type MissionAdminHandler struct {
	Service *services.MissionService
}

func NewMissionAdminHandler(service *services.MissionService) *MissionAdminHandler {
	return &MissionAdminHandler{Service: service}
}

func (h *MissionAdminHandler) ListMissions(c *fiber.Ctx) error {
	missions, err := h.Service.GetAllMissions()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(missions)
}

func (h *MissionAdminHandler) CreateMission(c *fiber.Ctx) error {
	var mission models.Mission
	if err := c.BodyParser(&mission); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	mission.Difficulty = normalizeDifficulty(mission.Difficulty)

	if err := h.Service.CreateMission(&mission); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(mission)
}

func (h *MissionAdminHandler) UpdateMission(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var mission models.Mission
	if err := c.BodyParser(&mission); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	mission.ID = uint(id)
	mission.Difficulty = normalizeDifficulty(mission.Difficulty)

	if err := h.Service.UpdateMission(&mission); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(mission)
}

func (h *MissionAdminHandler) DeleteMission(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if err := h.Service.DeleteMission(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *MissionAdminHandler) ListTasks(c *fiber.Ctx) error {
	missionID, _ := strconv.Atoi(c.Params("id"))
	tasks, err := h.Service.GetTasks(uint(missionID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tasks)
}

func (h *MissionAdminHandler) CreateTask(c *fiber.Ctx) error {
	missionID, _ := strconv.Atoi(c.Params("id"))
	var task models.MissionTask
	if err := c.BodyParser(&task); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	task.MissionID = uint(missionID)

	if err := h.Service.CreateTask(&task); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(task)
}

func (h *MissionAdminHandler) UpdateTask(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var task models.MissionTask
	if err := c.BodyParser(&task); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	task.ID = uint(id)

	if err := h.Service.UpdateTask(&task); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(task)
}

func (h *MissionAdminHandler) DeleteTask(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if err := h.Service.DeleteTask(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *MissionAdminHandler) ListRoles(c *fiber.Ctx) error {
	missionID, _ := strconv.Atoi(c.Params("id"))
	roles, err := h.Service.GetRoles(uint(missionID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(roles)
}
