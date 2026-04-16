package services

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

	"github.com/google/uuid"
)

type DialogueService struct {
	NPCRepo     *repository.NPCRepository
	MissionRepo *repository.MissionRepository
	MissionSvc  *MissionService
	AIClient    *DeepSeekClient
}

func NewDialogueService(
	npcRepo *repository.NPCRepository,
	missionRepo *repository.MissionRepository,
	missionSvc *MissionService,
	aiClient *DeepSeekClient,
) *DialogueService {
	return &DialogueService{
		NPCRepo:     npcRepo,
		MissionRepo: missionRepo,
		MissionSvc:  missionSvc,
		AIClient:    aiClient,
	}
}

type DialogueRequest struct {
	PlayerID              uuid.UUID              `json:"player_id"`
	RoomID                uuid.UUID              `json:"room_id"`
	NPCTemplateID         uint                   `json:"npc_template_id"`
	MissionID             *uint                  `json:"mission_id"`
	PlayerInput           string                 `json:"player_input"`
	PronunciationScore    float32                `json:"pronunciation_score"`
	PronunciationMetadata map[string]interface{} `json:"pronunciation_metadata"`
}

type DialogueResponse struct {
	NPCResponse          string                 `json:"npc_response"`
	NPCState             models.NPCState        `json:"npc_state"`
	PronunciationEval    models.PronunciationEval `json:"pronunciation_eval"`
	PronunciationMessage string                 `json:"pronunciation_message"`
	FeedbackSuggestion   string                 `json:"feedback_suggestion"`
	TaskCompleted        bool                   `json:"task_completed"`
	TaskProgress         string                 `json:"task_progress"`
	IsShop               bool                   `json:"is_shop"`
	ItemGift             *models.Item           `json:"item_gift"`
	GiftQuantity         int                    `json:"gift_quantity"`
}

func (s *DialogueService) ProcessInput(req DialogueRequest) (*DialogueResponse, error) {
	// 1. Resolve UserID to PlayerID (PlayerStats.ID)
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", req.PlayerID).Error; err != nil {
		return nil, fmt.Errorf("Player stats not found for user %s: %w", req.PlayerID, err)
	}
	actualPlayerID := stats.ID

	// 2. Get NPC and Room Context
	instance, err := s.NPCRepo.GetRoomInstance(req.RoomID, req.NPCTemplateID)
	if err != nil {
		return nil, fmt.Errorf("NPC instance not found: %w", err)
	}

	npcDef := instance.NPCTemplate.NPCDefinition
	isQuestGiver := npcDef.Type == models.NPCTypeQuest
	isMerchant := npcDef.Type == models.NPCTypeShop

	// 2. Mission Context
	var missionRole *models.NPCMissionRole
	var currentTask *models.MissionTask
	conditionMet := false
	conditionMsg := ""

	// Strict Role Enforcement: Only process missions if the NPC is a Quest Giver
	if req.MissionID != nil && isQuestGiver {
		missionRole, _ = s.MissionRepo.GetMissionRole(req.NPCTemplateID, *req.MissionID)
		
		tasks, _ := s.MissionSvc.GetTasks(*req.MissionID)
		progress, _ := s.MissionSvc.GetProgress(req.PlayerID, *req.MissionID)
		
		var completedTasks map[string]bool
		json.Unmarshal(progress.TasksCompleted, &completedTasks)

		// Find the first uncompleted task
		for i := range tasks {
			if !completedTasks[fmt.Sprint(tasks[i].ID)] {
				// Only if the NPC is the target for this task
				if tasks[i].TargetNPCTemplateID != nil && *tasks[i].TargetNPCTemplateID == req.NPCTemplateID {
					currentTask = &tasks[i]
					conditionMet, conditionMsg, _ = s.MissionSvc.CheckTaskCondition(req.PlayerID, currentTask, req.RoomID)
				}
				break
			}
		}
	}

	// 3. Conversation History
	conv, err := s.MissionRepo.GetConversation(actualPlayerID, instance.ID, req.MissionID)
	if err != nil {
		conv = &models.Conversation{
			PlayerID:      actualPlayerID,
			NPCInstanceID: instance.ID,
			MissionID:     req.MissionID,
		}
		s.MissionRepo.CreateConversation(conv)
	}

	history, _ := s.MissionRepo.GetMessages(conv.ID, 5)
	
	// 4. AIService Call
	systemPrompt := s.buildSystemPrompt(npcDef, missionRole, currentTask, conditionMet, conditionMsg, req.PronunciationMetadata)
	
	// Prepare history for prompt
	historyPrompt := ""
	for i := len(history) - 1; i >= 0; i-- {
		historyPrompt += fmt.Sprintf("Player: %s\nNPC: %s\n", history[i].PlayerInput, history[i].NPCResponse)
	}
	userPrompt := fmt.Sprintf("History:\n%s\nCurrent Input: %s\nPronunciation Score: %.0f", 
		historyPrompt, req.PlayerInput, req.PronunciationScore)

	aiRespRaw, err := s.AIClient.SendPrompt(systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI Error: %w", err)
	}

	fmt.Printf("[DialogueService] Raw AI Response: %s\n", aiRespRaw)
	var aiResp DialogueResponse
	if err := json.Unmarshal([]byte(aiRespRaw), &aiResp); err != nil {
		fmt.Printf("[DialogueService] JSON Unmarshal Error: %v\n", err)
		// Fallback for non-json
		aiResp = DialogueResponse{
			NPCResponse: aiRespRaw,
			NPCState:    models.NPCStateTalking,
		}
	}
	fmt.Printf("[DialogueService] Parsed AI Response: %+v\n", aiResp)

	// Set Shop Trigger - Only if the NPC is explicitly a Merchant
	if isMerchant && npcDef.ShopID != nil {
		aiResp.IsShop = true
	}

	// 5. Post-Process: Update Progress & State
	if aiResp.TaskCompleted && conditionMet && currentTask != nil {
		s.MissionSvc.UpdateTaskProgress(req.PlayerID, *req.MissionID, currentTask.ID, true)
		instance.TaskCompleted = true
	}

	if aiResp.NPCState != "" {
		instance.CurrentState = aiResp.NPCState
	}

	// 6. Handle NPC Gifts
	if npcDef.GiftItemID != nil && npcDef.GiftQuantity > 0 {
		// Check if already received
		var gift models.PlayerNPCGift
		err := database.DB.Where("player_id = ? AND npc_definition_id = ?", actualPlayerID, npcDef.ID).First(&gift).Error
		if err != nil { // Not found, give gift
			// 1. Record gift receipt
			newGift := models.PlayerNPCGift{
				PlayerID:        actualPlayerID,
				NPCDefinitionID: npcDef.ID,
			}
			database.DB.Create(&newGift)

			// 2. Add to inventory
			inv := &models.Inventory{
				PlayerID: stats.ID,
				ItemID:   *npcDef.GiftItemID,
				Quantity: npcDef.GiftQuantity,
			}
			var existing models.Inventory
			err := database.DB.Where("player_id = ? AND item_id = ?", inv.PlayerID, inv.ItemID).First(&existing).Error
			if err == nil {
				existing.Quantity += inv.Quantity
				database.DB.Save(&existing)
			} else {
				database.DB.Create(inv)
			}

			// 3. Include in response for UI notification
			var item models.Item
			if err := database.DB.First(&item, "id = ?", *npcDef.GiftItemID).Error; err == nil {
				aiResp.ItemGift = &item
				aiResp.GiftQuantity = npcDef.GiftQuantity
			}
		}
	}

	s.NPCRepo.UpdateRoomInstance(instance)

	// Save Message
	s.MissionRepo.AddMessage(&models.ConversationMessage{
		ConversationID:     conv.ID,
		PlayerInput:        req.PlayerInput,
		PronunciationScore: req.PronunciationScore,
		NPCResponse:        aiResp.NPCResponse,
		NPCState:           aiResp.NPCState,
		PronunciationEval:  aiResp.PronunciationEval,
		PronunciationMsg:   aiResp.PronunciationMessage,
		FeedbackSuggestion: aiResp.FeedbackSuggestion,
		TaskCompleted:      aiResp.TaskCompleted,
	})

	return &aiResp, nil
}

func (s *DialogueService) buildSystemPrompt(
	npc models.NPCDefinition, 
	role *models.NPCMissionRole, 
	task *models.MissionTask, 
	conditionMet bool,
	conditionMsg string,
	pronMetadata map[string]interface{},
) string {
	missionCtx := "No active mission context."
	npcTask := "Engage in friendly conversation."
	knowledge := "General world knowledge."
	
	if role != nil {
		missionCtx = role.KnowledgeSummary
		npcTask = role.TaskDescription
		knowledge = role.KnowledgeSummary
	}

	// Extract detailed errors if any
	errorList := "None."
	if pronMetadata != nil {
		if tips, ok := pronMetadata["tips"].([]interface{}); ok && len(tips) > 0 {
			errorList = ""
			for _, t := range tips {
				errorList += fmt.Sprintf("- %v\n", t)
			}
		}
		if diffs, ok := pronMetadata["word_differences"].([]interface{}); ok && len(diffs) > 0 {
			errorList += "Specific word errors:\n"
			for _, d := range diffs {
				if dm, ok := d.(map[string]interface{}); ok {
					errorList += fmt.Sprintf("  * Expected '%v', heard '%v'\n", dm["expected"], dm["heard"])
				}
			}
		}
	}

	prompt := fmt.Sprintf(`You are %s, a character in an English learning RPG.

CONTEXT:
- Mission Knowledge: %s
- Your Task with player: %s
- Knowledge: %s
- Condition Met? (Items/Enemies): %t
- Condition Info: %s
- PRONUNCIATION ANALYSIS: 
%s

BEHAVIOR RULES:
1. Stay in character. Use English only.
2. If Condition Met is true, you MUST acknowledge it and complete your task if they give/tell you what you needed.
3. If Condition Met is false, gently explain what is missing if they claim they are done.
4. Use the Pronunciation Analysis to give helpful, pedagogical feedback. If they made specific mistakes, point them out kindly.
5. RESPOND ONLY IN JSON.

JSON FORMAT:
{
  "npc_response": "string",
  "npc_state": "idle|talking|happy|angry|sad|surprised|thinking|grateful|waiting",
  "pronunciation_eval": "excellent|good|needs_work|bad",
  "pronunciation_message": "string",
  "feedback_suggestion": "string",
  "task_completed": boolean,
  "task_progress": "string"
}`, npc.Name, missionCtx, npcTask, knowledge, conditionMet, conditionMsg, errorList)

	return prompt
}
