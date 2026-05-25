package handlers

import (
	"fmt"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
	"strconv"
)

type NPCHandler struct {
	Service  *services.NPCService
	AIClient services.LLMClient
}

func NewNPCHandler(service *services.NPCService, aiClient services.LLMClient) *NPCHandler {
	return &NPCHandler{Service: service, AIClient: aiClient}
}

func (h *NPCHandler) CreateNPCTemplate(c *fiber.Ctx) error {
	var tmpl models.NPCTemplate
	if err := c.BodyParser(&tmpl); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.Service.CreateNPCTemplate(&tmpl); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(tmpl)
}

func (h *NPCHandler) UpdateNPCTemplate(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var tmpl models.NPCTemplate
	if err := c.BodyParser(&tmpl); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	tmpl.ID = uint(id)

	if err := h.Service.UpdateNPCTemplate(&tmpl); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(tmpl)
}

func (h *NPCHandler) DeleteNPCTemplate(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if err := h.Service.DeleteNPCTemplate(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "NPC Template deleted successfully"})
}

func (h *NPCHandler) GetNPCDefinitions(c *fiber.Ctx) error {
	definitions, err := h.Service.GetNPCDefinitions()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(definitions)
}

func (h *NPCHandler) CreateNPCDefinition(c *fiber.Ctx) error {
	var def models.NPCDefinition
	if err := c.BodyParser(&def); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Normalize type
	if string(def.Type) == "quest" || string(def.Type) == "quest_giver" {
		def.Type = models.NPCTypeQuest
	}
	if string(def.Type) == "master" || string(def.Type) == "quest_master" {
		def.Type = models.NPCTypeMaster
	}
	if def.DefaultState == "" {
		def.DefaultState = models.NPCStateIdle
	}

	// Validation: Only merchants can have a shop
	if def.Type != models.NPCTypeShop {
		def.ShopID = nil
	} else if def.ShopID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merchants must have a Shop ID"})
	}

	if err := h.Service.CreateNPCDefinition(&def); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(def)
}

func (h *NPCHandler) UpdateNPCDefinition(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var def models.NPCDefinition
	if err := c.BodyParser(&def); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	def.ID = uint(id)

	// Normalize type
	if string(def.Type) == "quest" || string(def.Type) == "quest_giver" {
		def.Type = models.NPCTypeQuest
	}
	if string(def.Type) == "master" || string(def.Type) == "quest_master" {
		def.Type = models.NPCTypeMaster
	}
	// We don't force DefaultState here as Updates() will skip it if empty, 
	// preserving the existing value in the DB.

	// Validation: Only merchants can have a shop
	if def.Type != models.NPCTypeShop {
		def.ShopID = nil
	} else if def.ShopID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merchants must have a Shop ID"})
	}

	if err := h.Service.UpdateNPCDefinition(&def); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(def)
}

func (h *NPCHandler) DeleteNPCDefinition(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if err := h.Service.DeleteNPCDefinition(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "NPC Definition deleted successfully"})
}
func (h *NPCHandler) TestAI(c *fiber.Ctx) error {
	var req struct {
		SystemPrompt string `json:"system_prompt"`
		UserPrompt   string `json:"user_prompt"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	resp, err := h.AIClient.SendPrompt(req.SystemPrompt, req.UserPrompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"response": resp,
	})
}

func (h *NPCHandler) GetRoomNPCs(c *fiber.Ctx) error {
	roomIDStr := c.Params("id")
	sceneKey := c.Query("scene_key")

	fmt.Printf("[GetRoomNPCs TRACE] Received request. id: '%s', scene_key: '%s'\n", roomIDStr, sceneKey)

	roomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		fmt.Printf("[GetRoomNPCs TRACE] UUID Parse Error: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Room ID", "received": roomIDStr})
	}

	if sceneKey == "" {
		fmt.Println("[GetRoomNPCs TRACE] sceneKey is empty!")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scene_key is required"})
	}

	instances, err := h.Service.EnsureRoomInstances(roomID, sceneKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(instances)
}

func (h *NPCHandler) GetAllTemplates(c *fiber.Ctx) error {
	tmpls, err := h.Service.GetAllTemplates()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tmpls)
}

func (h *NPCHandler) GetTemplatesByScene(c *fiber.Ctx) error {
	sceneKey := c.Query("scene_key")
	if sceneKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scene_key is required"})
	}

	tmpls, err := h.Service.GetTemplatesByScene(sceneKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tmpls)
}

func (h *NPCHandler) GetTemplatesByDefinition(c *fiber.Ctx) error {
	defID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Definition ID"})
	}

	tmpls, err := h.Service.GetTemplatesByDefinition(uint(defID))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tmpls)
}

func (h *NPCHandler) UpdateTemplateMissions(c *fiber.Ctx) error {
	tmplID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Template ID"})
	}

	var req struct {
		MissionIDs     []uint `json:"mission_ids"`
		Role           string `json:"role"`
		Instructions   string `json:"instructions"`
		SuccessMessage string `json:"success_message"`
		Greeting       string `json:"greeting"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.Service.UpdateTemplateMissions(uint(tmplID), req.MissionIDs, req.Role, req.Instructions, req.SuccessMessage, req.Greeting); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Missions updated successfully"})
}

// PatchTemplateInstructions updates ONLY the AI instructions and success_message
// of an NPCTemplate without touching mission assignments.
// PATCH /admin/npc-templates/:id/instructions
func (h *NPCHandler) PatchTemplateInstructions(c *fiber.Ctx) error {
	tmplID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Template ID"})
	}

	var req struct {
		Instructions   string `json:"instructions"`
		SuccessMessage string `json:"success_message"`
		Greeting       string `json:"greeting"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.Service.PatchTemplateInstructions(uint(tmplID), req.Instructions, req.SuccessMessage, req.Greeting); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Instructions updated successfully"})
}

// GetGuides lists all NPC definitions with type 'guide'
func (h *NPCHandler) GetGuides(c *fiber.Ctx) error {
	definitions, err := h.Service.GetNPCDefinitions()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	guides := make([]models.NPCDefinition, 0)
	for _, def := range definitions {
		if def.Type == models.NPCTypeGuide {
			guides = append(guides, def)
		}
	}

	return c.JSON(guides)
}
