package services

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/utils"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DialogueService struct {
	NPCRepo     *repository.NPCRepository
	MissionRepo *repository.MissionRepository
	MissionSvc  *MissionService
	AIClient    LLMClient
}

func NewDialogueService(
	npcRepo *repository.NPCRepository,
	missionRepo *repository.MissionRepository,
	missionSvc *MissionService,
	aiClient LLMClient,
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
	NPCResponse           string                   `json:"npc_response"`
	NPCResponseNative     string                   `json:"npc_response_native"`
	NPCState              models.NPCState          `json:"npc_state"`
	PronunciationEval     models.PronunciationEval `json:"pronunciation_eval"`
	PronunciationMessage  string                   `json:"pronunciation_message"`
	FeedbackSuggestion    string                   `json:"feedback_suggestion"`
	TaskCompleted         bool                     `json:"task_completed"`
	TaskProgress          string                   `json:"task_progress"`
	IsShop                bool                     `json:"is_shop"`
	ItemGift              *models.Item             `json:"item_gift"`
	GiftQuantity          int                      `json:"gift_quantity"`
	MissionNewlyCompleted bool                     `json:"mission_newly_completed"`
	MissionDetails        *models.Mission          `json:"mission_details,omitempty"`
	BuyItemID             *string                  `json:"buy_item_id,omitempty"`
	BuyQuantity           int                      `json:"buy_quantity,omitempty"`
}

func (s *DialogueService) ProcessInput(req DialogueRequest) (*DialogueResponse, error) {
	startTotal := time.Now()
	fmt.Printf("\n[Performance] === Go Backend: ProcessInput Start ===\n")
	fmt.Printf("[Performance] Go Backend: PlayerInput='%s'\n", req.PlayerInput)

	// 1. Resolve UserID to PlayerID (PlayerStats.ID)
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", req.PlayerID).Error; err != nil {
		return nil, fmt.Errorf("Player stats not found for user %s: %w", req.PlayerID, err)
	}
	actualPlayerID := stats.ID

	// Resolve the player's native language so the NPC's helper translation and the
	// dialogue cache are scoped per language (a Spanish-cached reply must not be served
	// to a Portuguese learner).
	nativeLang := "en"
	var langUser models.User
	if err := database.DB.Select("native_language").First(&langUser, "id = ?", req.PlayerID).Error; err == nil {
		nativeLang = utils.NormalizeLang(langUser.NativeLanguage)
	}

	// 2. Get NPC and Room Context
	instance, err := s.NPCRepo.GetRoomInstance(req.RoomID, req.NPCTemplateID)
	if err != nil {
		return nil, fmt.Errorf("NPC instance not found: %w", err)
	}

	npcDef := instance.NPCTemplate.NPCDefinition
	isMerchant := npcDef.Type == models.NPCTypeShop

	if isMerchant && npcDef.ShopID != nil {
		if err := database.DB.Preload("Shop.Items").First(&npcDef, "id = ?", npcDef.ID).Error; err != nil {
			fmt.Printf("[DialogueService] Warning: Failed to preload shop items: %v\n", err)
		}
	}

	// Conversation row must exist BEFORE we evaluate task conditions. Some
	// conditions (e.g. "talk to NPC") count this player's conversations with the
	// target NPC; if it's created afterwards, the very act of talking wouldn't be
	// registered on the turn it happens, leaving the task perpetually unmet while
	// the AI still reports task_completed.
	conv, err := s.MissionRepo.GetConversation(actualPlayerID, instance.ID, req.MissionID)
	if err != nil {
		conv = &models.Conversation{
			PlayerID:      actualPlayerID,
			NPCInstanceID: instance.ID,
			MissionID:     req.MissionID,
		}
		if err := s.MissionRepo.CreateConversation(conv); err != nil {
			fmt.Printf("[DialogueService] WARN: failed to create conversation: %v\n", err)
		}
	}

	// 2. Mission Context
	var missionRole *models.NPCMissionRole
	var currentTask *models.MissionTask
	conditionMet := false
	conditionMsg := ""

	// Process mission tasks for ANY NPC type that has a mission_id.
	// Security: the target check on line 95 ensures only the correct NPC
	// can complete each specific task (TargetNPCTemplateID == req.NPCTemplateID).
	// The isQuestGiver restriction was removed to support the "One Map, One Mission"
	// architecture where regular NPCs (type 'other', 'guide', etc.) act as task targets.
	if req.MissionID != nil {
		missionRole, _ = s.MissionRepo.GetMissionRole(req.NPCTemplateID, *req.MissionID)

		tasks, _ := s.MissionSvc.GetTasks(*req.MissionID)
		progress, _ := s.MissionSvc.GetProgress(req.PlayerID, *req.MissionID)

		var completedTasks map[string]bool
		json.Unmarshal(progress.TasksCompleted, &completedTasks)

		// Find the first uncompleted task targeting this NPC
		for i := range tasks {
			if !completedTasks[fmt.Sprint(tasks[i].ID)] {
				// Only if the NPC is the target for this task
				if tasks[i].TargetNPCTemplateID != nil && *tasks[i].TargetNPCTemplateID == req.NPCTemplateID {
					currentTask = &tasks[i]
					conditionMet, conditionMsg, _ = s.MissionSvc.CheckTaskCondition(req.PlayerID, currentTask, req.RoomID)
					break
				}
			}
		}
	}

	// 3. Short-circuit: If purpose already fulfilled, skip AI
	isTaskCompletedForPlayer := false
	if req.MissionID != nil {
		progress, _ := s.MissionSvc.GetProgress(req.PlayerID, *req.MissionID)
		if progress != nil {
			if progress.Status == models.StatusCompleted {
				isTaskCompletedForPlayer = true
			} else {
				tasks, _ := s.MissionSvc.GetTasks(*req.MissionID)
				var completedTasks map[string]bool
				json.Unmarshal(progress.TasksCompleted, &completedTasks)

				hasNPCActiveTasks := false
				allNPCActiveTasksCompleted := true
				for _, t := range tasks {
					if t.TargetNPCTemplateID != nil && *t.TargetNPCTemplateID == req.NPCTemplateID {
						hasNPCActiveTasks = true
						if completedTasks == nil || !completedTasks[fmt.Sprint(t.ID)] {
							allNPCActiveTasksCompleted = false
						}
					}
				}
				if hasNPCActiveTasks && allNPCActiveTasksCompleted {
					isTaskCompletedForPlayer = true
				}
			}
		}
	}

	if isTaskCompletedForPlayer && instance.NPCTemplate.SuccessMessage != "" {
		return &DialogueResponse{
			NPCResponse:   instance.NPCTemplate.SuccessMessage,
			NPCState:      models.NPCStateHappy,
			TaskCompleted: true,
		}, nil
	}

	history, _ := s.MissionRepo.GetMessages(conv.ID, 5)

	// 4. Cache Check (Only for good pronunciation to avoid caching error corrections)
	var aiRespRaw string
	var aiResp DialogueResponse
	var fromCache bool

	normalizedInput := normalizeInput(req.PlayerInput)
	// Scope the cache key by native language so the cached npc_response_native is never
	// served to a learner who speaks a different language.
	cacheInput := nativeLang + "|" + normalizedInput
	var taskID *uint
	if currentTask != nil {
		taskID = &currentTask.ID
	}

	if req.PronunciationScore >= 80 {
		cached, err := s.NPCRepo.GetCachedDialogue(req.NPCTemplateID, req.MissionID, taskID, cacheInput, conditionMet)
		if err == nil && cached != nil {
			fmt.Printf("[DialogueService] Cache Hit! Skipping AI call for '%s'\n", normalizedInput)
			aiRespRaw = cached.ResponseJSON
			fromCache = true
		}
	}

	// 5. AIService Call (if Cache Miss)
	if !fromCache {
		systemPrompt := s.buildSystemPrompt(npcDef, instance.NPCTemplate, missionRole, currentTask, conditionMet, conditionMsg, req.PronunciationMetadata, nativeLang)

		historyPrompt := ""
		for i := len(history) - 1; i >= 0; i-- {
			historyPrompt += fmt.Sprintf("Player: %s\nNPC: %s\n", history[i].PlayerInput, history[i].NPCResponse)
		}
		userPrompt := fmt.Sprintf("History:\n%s\nCurrent Input: %s\nPronunciation Score: %.0f",
			historyPrompt, req.PlayerInput, req.PronunciationScore)

		startLLM := time.Now()
		aiRespRaw, err = s.AIClient.SendPrompt(systemPrompt, userPrompt)
		if err != nil {
			return nil, fmt.Errorf("AI Error: %w", err)
		}
		llmTime := time.Since(startLLM).Milliseconds()
		fmt.Printf("[Performance] Go Backend: LLM request complete. Took %d ms\n", llmTime)
		fmt.Printf("[DialogueService] Raw AI Response: %s\n", aiRespRaw)
	}

	cleanedJSON := sanitizeJSON(aiRespRaw)
	if err := json.Unmarshal([]byte(cleanedJSON), &aiResp); err != nil {
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

	// Process conversational shop purchase
	if isMerchant && aiResp.BuyItemID != nil && *aiResp.BuyItemID != "" {
		itemID, err := uuid.Parse(*aiResp.BuyItemID)
		if err == nil {
			// Get quantity, default to 1 if <= 0
			qty := aiResp.BuyQuantity
			if qty <= 0 {
				qty = 1
			}

			// 1. Get Item details
			var item models.Item
			if err := database.DB.First(&item, "id = ?", itemID).Error; err == nil {
				totalCost := item.Price * qty

				// 2. Check Gold
				if stats.Gold >= totalCost {
					// 3. Update Gold and Add to Inventory in Transaction
					dbErr := database.DB.Transaction(func(tx *gorm.DB) error {
						stats.Gold -= totalCost
						if err := tx.Save(&stats).Error; err != nil {
							return err
						}

						inv := &models.Inventory{
							PlayerID: stats.ID,
							ItemID:   item.ID,
							Quantity: qty,
						}
						var existing models.Inventory
						err := tx.Where("player_id = ? AND item_id = ?", inv.PlayerID, inv.ItemID).First(&existing).Error
						if err == nil {
							existing.Quantity += inv.Quantity
							return tx.Save(&existing).Error
						}
						return tx.Create(inv).Error
					})

					if dbErr == nil {
						// Purchase successful! Set ItemGift so the UI notifies the player
						aiResp.ItemGift = &item
						aiResp.GiftQuantity = qty
						fmt.Printf("[DialogueService] Conversational Purchase success: %dx %s for %d gold. Remaining gold: %d\n", qty, item.Name, totalCost, stats.Gold)
					} else {
						fmt.Printf("[DialogueService] Conversational Purchase DB error: %v\n", dbErr)
					}
				} else {
					// Overwrite NPC response conversational message to state not enough gold
					aiResp.NPCResponse = fmt.Sprintf("Sorry, you need %d gold to buy %d %s, but you only have %d gold.", totalCost, qty, item.Name, stats.Gold)
					// Native helper omitted here: this is a fixed system message and the
					// English line above already conveys it without a per-language translation.
					aiResp.NPCResponseNative = ""
					aiResp.ItemGift = nil
					aiResp.GiftQuantity = 0
				}
			} else {
				fmt.Printf("[DialogueService] Conversational Purchase error: Item ID %s not found\n", *aiResp.BuyItemID)
			}
		} else {
			fmt.Printf("[DialogueService] Conversational Purchase error parsing UUID %s: %v\n", *aiResp.BuyItemID, err)
		}
	}

	// Save to Cache if it was a Cache Miss and the score was good
	if !fromCache && req.PronunciationScore >= 80 {
		// Convert the clean response struct back to JSON to strip formatting issues
		cleanJSON, _ := json.Marshal(aiResp)
		newCache := &models.NPCDialogueCache{
			NPCTemplateID:   req.NPCTemplateID,
			MissionID:       req.MissionID,
			TaskID:          taskID,
			NormalizedInput: cacheInput,
			ConditionMet:    conditionMet,
			ResponseJSON:    string(cleanJSON),
		}
		if err := s.NPCRepo.SaveCachedDialogue(newCache); err != nil {
			fmt.Printf("[DialogueService] WARN: failed to save cached dialogue for '%s': %v\n", normalizedInput, err)
		} else {
			fmt.Printf("[DialogueService] Saved response to DB Cache for '%s'\n", normalizedInput)
		}
	}

	// 5. Post-Process: Update Progress & State
	// The frontend paints its "task completed" UI from the task_completed flag we
	// return, so that flag must mirror what we actually persist. Otherwise the AI
	// can claim completion (green banner) while progress silently fails to advance.
	// We only report success when UpdateTaskProgress actually runs and succeeds.
	taskActuallyCompleted := false
	if aiResp.TaskCompleted && currentTask != nil && req.MissionID != nil {
		if conditionMet {
			newlyDone, err := s.MissionSvc.UpdateTaskProgress(req.PlayerID, *req.MissionID, currentTask.ID, true)
			if err != nil {
				fmt.Printf("[DialogueService] ERROR persisting task %d for mission %d: %v\n", currentTask.ID, *req.MissionID, err)
			} else {
				taskActuallyCompleted = true
				aiResp.MissionNewlyCompleted = newlyDone
				if newlyDone {
					mission, _ := s.MissionRepo.GetMissionByID(*req.MissionID)
					aiResp.MissionDetails = mission
				}
			}
		} else {
			fmt.Printf("[DialogueService] AI flagged task %d complete but its condition is not met (%s); not persisting.\n", currentTask.ID, conditionMsg)
		}
		// Per-player progress (MissionProgress, updated just above) is the source of
		// truth. We intentionally do NOT set the shared room-instance TaskCompleted flag
		// so other players sharing the room aren't affected during an individual mission.

		// We no longer override the NPCResponse here because we want the AI's natural completion message.
		// The SuccessMessage is already provided to the AI as context in the system prompt.
	}
	// Keep the returned flag in lockstep with what we actually saved so the client
	// never shows a "completed" state we didn't persist.
	aiResp.TaskCompleted = taskActuallyCompleted

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

	if err := s.NPCRepo.UpdateRoomInstance(instance); err != nil {
		fmt.Printf("[DialogueService] WARN: failed to update room instance %d: %v\n", instance.ID, err)
	}

	// Save Message
	if err := s.MissionRepo.AddMessage(&models.ConversationMessage{
		ConversationID:     conv.ID,
		PlayerInput:        req.PlayerInput,
		PronunciationScore: req.PronunciationScore,
		NPCResponse:        aiResp.NPCResponse,
		NPCResponseES:      aiResp.NPCResponseNative, // column kept for compat; now holds native-language text
		NPCState:           aiResp.NPCState,
		PronunciationEval:  aiResp.PronunciationEval,
		PronunciationMsg:   aiResp.PronunciationMessage,
		FeedbackSuggestion: aiResp.FeedbackSuggestion,
		TaskCompleted:      aiResp.TaskCompleted,
	}); err != nil {
		fmt.Printf("[DialogueService] WARN: failed to save conversation message: %v\n", err)
	}

	totalTime := time.Since(startTotal).Milliseconds()
	fmt.Printf("[Performance] Go Backend: ProcessInput complete. Total time: %d ms\n\n", totalTime)

	return &aiResp, nil
}

func (s *DialogueService) buildSystemPrompt(
	npc models.NPCDefinition,
	tmpl models.NPCTemplate,
	role *models.NPCMissionRole,
	task *models.MissionTask,
	conditionMet bool,
	conditionMsg string,
	pronMetadata map[string]interface{},
	nativeLang string,
) string {
	// The language the player understands; English is always the language being learned.
	nativeLangName := utils.LanguageName(nativeLang)
	englishOnly := utils.IsEnglish(nativeLang)
	missionCtx := "No active mission context of the current selected mission."
	npcTask := "Engage in friendly conversation."
	knowledge := "General world knowledge."

	if tmpl.Instructions != "" {
		knowledge = tmpl.Instructions
	}

	if role != nil {
		missionCtx = role.KnowledgeSummary
		npcTask = role.TaskDescription
		knowledge = role.KnowledgeSummary
	}

	// If there's an active task targeting this NPC, override with its specific instruction
	taskCtx := "No specific task assigned to you."
	if task != nil {
		taskCtx = fmt.Sprintf(
			"Task ID %d: '%s' (type: %s). The player must complete this with you. "+
				"When you are satisfied the player has done it correctly, set task_completed to true.",
			task.ID, task.DescriptionEn, task.Type,
		)
		if task.TargetPhraseEn != "" {
			taskCtx += fmt.Sprintf(" Expected phrase or content: \"%s\".", task.TargetPhraseEn)
		}
		if task.MessageToDeliver != "" {
			taskCtx += fmt.Sprintf(" The player should deliver this message to you: \"%s\".", task.MessageToDeliver)
		}
	}

	// Extra Context for multi-role NPCs
	extraInfo := ""
	if npc.Type == models.NPCTypeQuest {
		extraInfo += "- You are a Quest Giver. If the player hasn't selected a mission, invite them to check your available tasks.\n"
	}
	if npc.ShopID != nil {
		extraInfo += "- You own a Shop. Here is the catalog of items you sell:\n"
		for _, item := range npc.Shop.Items {
			extraInfo += fmt.Sprintf("  * Item ID: \"%s\", Name: \"%s\", Price: %d Gold, Description: \"%s\"\n", item.ID.String(), item.Name, item.Price, item.Description)
		}
		extraInfo += `- RULES FOR SELLING ITEMS:
1. You MUST operate as a voice/chat-based shopkeeper. The user CANNOT buy items with a mouse click.
2. If the user asks to buy or expresses interest in an item (e.g. "I want a health potion"), check if you sell it. Respond in character, correct any English or pronunciation errors, state the price, and ask the user to confirm the purchase (e.g. "A health potion costs 50 gold. Would you like to buy it?").
3. DO NOT set "buy_item_id" or "buy_quantity" yet in this stage. Keep them null or empty.
4. If the user confirms (e.g. "Yes", "I confirm", "Yes please"), respond amigablemente and set "buy_item_id" to the corresponding item's ID string and "buy_quantity" to the quantity (default to 1) in your JSON output.
5. If the user asks for something you do not sell, politely decline.
6. The user has to speak/write in English. If they speak another language, politely remind them they need to ask in English.
`
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

	// Native-language helper instruction + JSON field, parameterized by the player's
	// language. When the player's native language IS English we skip the translation.
	rule1Text := fmt.Sprintf("Use English only for the 'npc_response' field, but ALWAYS provide a %s translation in the 'npc_response_native' field.", nativeLangName)
	jsonNativeLine := fmt.Sprintf(`"npc_response_native": "string translation in %s",`, nativeLangName)
	if englishOnly {
		rule1Text = "Use English only for the 'npc_response' field. Leave 'npc_response_native' as an empty string."
		jsonNativeLine = `"npc_response_native": "",`
	}

	prompt := fmt.Sprintf(`You are %s, a character in an English learning RPG.

CONTEXT:
%s
- Current Mission Knowledge: %s
- Your Specific Task for CURRENT mission: %s
- ACTIVE TASK ASSIGNED TO YOU: %s
- Additional Knowledge / Your Personality: %s
- Mission Condition Met? (Items/Enemies/Talk): %t
- Condition Info: %s (Note: For 'talk_to_npc' tasks, this is true if you are talking, but you must judge if the conversation was sufficient based on your Instructions).
- PRONUNCIATION ANALYSIS:
%s
- SUCCESS MESSAGE (Use this ONLY if task_completed becomes true): %s

BEHAVIOR RULES:
1. Stay in character. %s
2. The player is learning English. To fulfill any task (like a greeting or a specific phrase), they MUST provide it in English. If they respond in another language, acknowledge it but do NOT mark the task as completed.
3. CRITICAL: Only set "task_completed": true if the player has explicitly and correctly fulfilled the requirements described in your "Instructions" or "Active Task". Do NOT complete it just for a general greeting or greeting in the wrong language.
4. If "task_completed" is true, congratulate the player and you may incorporate the "SUCCESS MESSAGE" naturally into your response.
5. If Condition Met is true AND the task requires an item or enemy kill, acknowledge it and complete the task.
6. Use the Pronunciation Analysis to give helpful, pedagogical feedback. If they made specific mistakes, point them out kindly.
7. If the player is just chatting and not doing a mission, be friendly.
8. RESPOND ONLY IN JSON.

JSON FORMAT:
{
  "npc_response": "string in English",
  %s
  "npc_state": "idle|talking|happy|angry|sad|surprised|thinking|grateful|waiting",
  "pronunciation_eval": "excellent|good|needs_work|bad",
  "pronunciation_message": "string",
  "feedback_suggestion": "string",
  "task_completed": boolean,
  "task_progress": "string",
  "buy_item_id": "string (UUID) or null",
  "buy_quantity": number
}`, npc.Name, extraInfo, missionCtx, npcTask, taskCtx, knowledge, conditionMet, conditionMsg, errorList, tmpl.SuccessMessage, rule1Text, jsonNativeLine)

	return prompt
}

func normalizeInput(input string) string {
	// Lowercase
	s := strings.ToLower(input)

	// Remove punctuation
	reg := regexp.MustCompile(`[^a-z0-9\s]+`)
	s = reg.ReplaceAllString(s, "")

	// Trim extra spaces
	s = strings.Join(strings.Fields(s), " ")

	return s
}

func sanitizeJSON(input string) string {
	cleaned := strings.TrimSpace(input)

	// 1. Strip markdown wrappers (```json ... ``` or ``` ... ```)
	if strings.HasPrefix(cleaned, "```") {
		firstLineEnd := strings.Index(cleaned, "\n")
		if firstLineEnd != -1 {
			cleaned = cleaned[firstLineEnd+1:]
		}
		if strings.HasSuffix(cleaned, "```") {
			cleaned = cleaned[:len(cleaned)-3]
		}
		cleaned = strings.TrimSpace(cleaned)
	}

	// 2. Remove trailing commas before closing braces/brackets to avoid strictly unmarshaling errors in standard library
	reTrailingComma := regexp.MustCompile(`,(\s*[}\]])`)
	cleaned = reTrailingComma.ReplaceAllString(cleaned, "$1")

	return cleaned
}
