package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

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
