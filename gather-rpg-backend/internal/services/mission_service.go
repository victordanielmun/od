package services

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"time"

	"github.com/google/uuid"
)

type MissionService struct {
	Repo    *repository.MissionRepository
	InvRepo *repository.InventoryRepository
}

func NewMissionService(repo *repository.MissionRepository, invRepo *repository.InventoryRepository) *MissionService {
	return &MissionService{Repo: repo, InvRepo: invRepo}
}

func (s *MissionService) GetMissionsForScene(sceneKey string) ([]models.Mission, error) {
	return s.Repo.GetMissionsByScene(sceneKey)
}

func (s *MissionService) GetNPCMissions(tmplID uint) ([]models.Mission, error) {
	return s.Repo.GetMissionsByTemplate(tmplID)
}

func (s *MissionService) GetAllMissions() ([]models.Mission, error) {
	return s.Repo.GetAllMissions()
}

func (s *MissionService) CreateMission(mission *models.Mission) error {
	return s.Repo.CreateMission(mission)
}

func (s *MissionService) UpdateMission(mission *models.Mission) error {
	return s.Repo.UpdateMission(mission)
}

func (s *MissionService) DeleteMission(id uint) error {
	return s.Repo.DeleteMission(id)
}

func (s *MissionService) GetTasks(missionID uint) ([]models.MissionTask, error) {
	return s.Repo.GetTasksByMission(missionID)
}

func (s *MissionService) CreateTask(task *models.MissionTask) error {
	return s.Repo.CreateTask(task)
}

func (s *MissionService) UpdateTask(task *models.MissionTask) error {
	return s.Repo.UpdateTask(task)
}

func (s *MissionService) DeleteTask(id uint) error {
	return s.Repo.DeleteTask(id)
}

func (s *MissionService) GetRoles(missionID uint) ([]models.NPCMissionRole, error) {
	return s.Repo.GetRolesByMission(missionID)
}

func (s *MissionService) GetProgress(userID uuid.UUID, missionID uint) (*models.PlayerMissionProgress, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return nil, fmt.Errorf("Player stats not found: %w", err)
	}
	playerID := stats.ID

	progress, err := s.Repo.GetPlayerProgress(playerID, missionID)
	if err != nil {

		// If not found, create a new one
		newProgress := &models.PlayerMissionProgress{
			PlayerID:       playerID,
			MissionID:      missionID,
			Status:         models.StatusNotStarted,
			TasksCompleted: []byte("{}"),
			StartedAt:      time.Now(),
		}
		if err := s.Repo.CreateOrUpdateProgress(newProgress); err != nil {
			return nil, err
		}
		return newProgress, nil
	}

	return progress, nil
}

// resolvePlayerID maps an auth user UUID to the internal PlayerStats ID.
func (s *MissionService) resolvePlayerID(userID uuid.UUID) (uuid.UUID, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return uuid.Nil, fmt.Errorf("player stats not found: %w", err)
	}
	return stats.ID, nil
}

// GetProgressReadOnly returns the player's progress WITHOUT creating one.
// Returns (nil, nil) when no progress exists — i.e. the mission hasn't been
// accepted (in this room). Used by listings so that merely viewing missions
// no longer auto-starts them.
func (s *MissionService) GetProgressReadOnly(userID uuid.UUID, missionID uint, roomID *uuid.UUID) (*models.PlayerMissionProgress, error) {
	playerID, err := s.resolvePlayerID(userID)
	if err != nil {
		return nil, err
	}
	progress, err := s.Repo.GetPlayerProgressInRoom(playerID, missionID, roomID)
	if err != nil {
		return nil, nil // not found = not accepted (not an error)
	}
	return progress, nil
}

// AcceptMission explicitly starts a mission for the player in a given room
// instance. Idempotent: returns the existing progress if already accepted.
func (s *MissionService) AcceptMission(userID uuid.UUID, missionID uint, roomID *uuid.UUID) (*models.PlayerMissionProgress, error) {
	playerID, err := s.resolvePlayerID(userID)
	if err != nil {
		return nil, err
	}

	// Idempotent per (player, mission), NOT per room instance. Combat rooms are
	// ephemeral, so a room-scoped lookup created a fresh (reset) progress on every
	// re-entry. Looking up room-agnostically preserves progress across instances.
	if existing, err := s.Repo.GetPlayerProgress(playerID, missionID); err == nil && existing != nil {
		if existing.Status == models.StatusNotStarted {
			existing.Status = models.StatusInProgress
			if err := s.Repo.CreateOrUpdateProgress(existing); err != nil {
				return nil, fmt.Errorf("failed to persist mission progress: %w", err)
			}
		}
		return existing, nil
	}

	progress := &models.PlayerMissionProgress{
		PlayerID:       playerID,
		MissionID:      missionID,
		RoomID:         roomID,
		Status:         models.StatusInProgress,
		TasksCompleted: []byte("{}"),
		StartedAt:      time.Now(),
	}
	if err := s.Repo.CreateOrUpdateProgress(progress); err != nil {
		return nil, err
	}
	return progress, nil
}

// CheckTaskCondition evaluates if the player meets the requirements for a specific task.
func (s *MissionService) CheckTaskCondition(userID uuid.UUID, task *models.MissionTask, roomID uuid.UUID) (bool, string, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return false, "Player stats not found", nil
	}
	playerID := stats.ID

	switch task.Type {
	case models.TaskTypeBringItem, models.TaskTypeFindItem, models.TaskTypeCollectItems:
		return s.checkBringItem(playerID, task.RequiredItem, task.RequiredQuantity)
	case models.TaskTypeDefeatEnemy, models.TaskTypeKillBoss, models.TaskTypeKillAll:
		return s.checkKillTaskDone(playerID, task.MissionID, task.ID)
	case models.TaskTypeTalkToNPC:
		return s.checkTalkToNPC(playerID, task.TargetNPCTemplateID, task.MissionID)
	case models.TaskTypeDeliverMsg, models.TaskTypePronunciation:
		// AI-validated tasks are always 'true' on the backend side, 
		// they depend on the AI response flag to actually trigger UpdateTaskProgress.
		return true, "", nil
	}
	return false, "Unknown task type", nil
}

func (s *MissionService) checkBringItem(playerID uuid.UUID, itemName string, requiredQty int) (bool, string, error) {
	if itemName == "" {
		return true, "", nil
	}
	if requiredQty < 1 {
		requiredQty = 1 // 0 = compat: exigir al menos 1
	}

	var total int64
	// Sum the quantity across all inventory rows that match the item name
	err := database.DB.Table("inventories").
		Joins("JOIN items ON items.id = inventories.item_id").
		Where("inventories.player_id = ? AND items.name ILIKE ?", playerID, itemName).
		Select("COALESCE(SUM(inventories.quantity), 0)").
		Scan(&total).Error

	if err != nil {
		return false, "", err
	}

	if total >= int64(requiredQty) {
		return true, "I see you have the items!", nil
	}
	return false, fmt.Sprintf("You still need %d more.", requiredQty-int(total)), nil
}

// checkKillTaskDone returns true if the WS kill handlers (UpdateKillProgress /
// UpdateKillAllProgress) already marked this kill/boss/clear task as completed
// in the player's mission progress. Replaces the old always-false placeholder.
func (s *MissionService) checkKillTaskDone(playerID uuid.UUID, missionID uint, taskID uint) (bool, string, error) {
	progress, err := s.Repo.GetPlayerProgress(playerID, missionID)
	if err != nil || progress == nil || progress.TasksCompleted == nil {
		return false, "The enemies are still lurking around.", nil
	}

	var completed map[string]bool
	if err := json.Unmarshal(progress.TasksCompleted, &completed); err != nil {
		return false, "The enemies are still lurking around.", nil
	}

	if completed[fmt.Sprint(taskID)] {
		return true, "Well done, the threat is gone!", nil
	}
	return false, "The enemies are still lurking around.", nil
}

func (s *MissionService) checkTalkToNPC(playerID uuid.UUID, targetTmplID *uint, missionID uint) (bool, string, error) {
	if targetTmplID == nil {
		return true, "", nil
	}

	var count int64
	// Check if there's any conversation with the target NPC for this mission
	err := database.DB.Table("conversations").
		Joins("JOIN npc_room_instances ON npc_room_instances.id = conversations.npc_instance_id").
		Where("conversations.player_id = ? AND npc_room_instances.npc_template_id = ? AND conversations.mission_id = ?", playerID, *targetTmplID, missionID).
		Count(&count).Error

	if err != nil {
		return false, "", err
	}

	if count > 0 {
		return true, "Ah, I see you've already spoken with them.", nil
	}
	return false, "You should go talk to our friend first.", nil
}

// deliverRewards grants the mission's gold, XP and item reward to the player.
// Callers MUST invoke it exactly once, on the transition to "completed"
// (the kill handlers already filter out already-completed missions, and
// UpdateTaskProgress guards with wasCompleted), so this is not re-entrant-safe
// on its own — it just centralizes the previously-triplicated grant logic.
func (s *MissionService) deliverRewards(playerID uuid.UUID, missionID uint) {
	var mission models.Mission
	if err := database.DB.First(&mission, missionID).Error; err != nil {
		return
	}

	// 1. Gold + XP
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "id = ?", playerID).Error; err == nil {
		stats.Gold += mission.RewardGold
		stats.Experience += mission.RewardXP
		database.DB.Save(&stats)
		fmt.Printf("[MissionService] Delivered %d Gold and %d XP to player %s for mission %d\n", mission.RewardGold, mission.RewardXP, playerID, missionID)
	}

	// 2. Item
	if mission.RewardItemID != nil && mission.RewardQuantity > 0 {
		var existing models.Inventory
		if database.DB.Where("player_id = ? AND item_id = ?", playerID, *mission.RewardItemID).First(&existing).Error == nil {
			existing.Quantity += mission.RewardQuantity
			database.DB.Save(&existing)
		} else {
			database.DB.Create(&models.Inventory{PlayerID: playerID, ItemID: *mission.RewardItemID, Quantity: mission.RewardQuantity})
		}
		fmt.Printf("[MissionService] Delivered %d of item %s to player %s for mission %d\n", mission.RewardQuantity, mission.RewardItemID, playerID, missionID)
	}
}

// UpdateTaskProgress marks a specific task as completed in the player's progress.
// Returns (isNewlyCompleted, error)
func (s *MissionService) UpdateTaskProgress(userID uuid.UUID, missionID uint, taskID uint, isCompleted bool) (bool, error) {
	progress, err := s.GetProgress(userID, missionID)
	if err != nil {
		return false, err
	}
	wasCompleted := progress.Status == models.StatusCompleted
	playerID := progress.PlayerID

	var tasks map[string]bool
	if err := json.Unmarshal(progress.TasksCompleted, &tasks); err != nil {
		tasks = make(map[string]bool)
	}

	tasks[fmt.Sprint(taskID)] = isCompleted
	
	// Item Consumption: If the task requires an item and is being completed, consume it
	if isCompleted {
		var task models.MissionTask
		if err := database.DB.First(&task, taskID).Error; err == nil {
			if (task.Type == models.TaskTypeBringItem || task.Type == models.TaskTypeFindItem || task.Type == models.TaskTypeCollectItems) && task.RequiredItem != "" {
				item, err := s.InvRepo.GetItemByName(task.RequiredItem)
				if err == nil {
					qty := task.RequiredQuantity
					if qty < 1 {
						qty = 1
					}
					if err := s.InvRepo.RemoveItemFromInventory(playerID, item.ID, qty); err != nil {
						fmt.Printf("[MissionService] WARN: failed to consume %d of item '%s' for task %d: %v\n", qty, task.RequiredItem, taskID, err)
					} else {
						fmt.Printf("[MissionService] Consumed %d of item '%s' for task %d completion\n", qty, task.RequiredItem, taskID)
					}
				}
			}
		}
	}

	updatedJSON, _ := json.Marshal(tasks)
	progress.TasksCompleted = updatedJSON
	progress.Status = models.StatusInProgress

	// Check if all tasks are completed
	allTasks, _ := s.GetTasks(missionID)
	allDone := true
	for _, t := range allTasks {
		if !tasks[fmt.Sprint(t.ID)] {
			allDone = false
			break
		}
	}

	if allDone {
		progress.Status = models.StatusCompleted
		now := time.Now()
		progress.CompletedAt = &now

		// Deliver rewards only on the transition to completed, so re-running this
		// task update on an already-completed mission can't double-grant.
		if !wasCompleted {
			s.deliverRewards(playerID, missionID)
		}
	}

	isNewlyCompleted := !wasCompleted && allDone
	return isNewlyCompleted, s.Repo.CreateOrUpdateProgress(progress)
}

func (s *MissionService) IsMissionFullyCompleted(userID uuid.UUID, missionID uint) (bool, *models.Mission, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return false, nil, fmt.Errorf("Player stats not found: %w", err)
	}
	playerID := stats.ID

	progress, err := s.Repo.GetPlayerProgress(playerID, missionID)
	if err != nil {
		return false, nil, err
	}

	if progress.Status != models.StatusCompleted {
		return false, nil, nil
	}

	mission, err := s.Repo.GetMissionByID(missionID)
	if err != nil {
		return true, nil, err
	}

	return true, mission, nil
}
// KillProgressResult contiene el resultado de UpdateKillProgress para que
// el hub pueda emitir el evento WS enemy_kill_progress al cliente.
type KillProgressResult struct {
	MissionID      uint
	TaskID         uint
	KillsDone      int
	RequiredKills  int
	TaskCompleted  bool
	MissionDone    bool
}

// activeMissionProgresses returns the player's ACCEPTED (in_progress) missions,
// scoped to the given SCENE (not a room instance). Combat rooms are ephemeral —
// they're recreated on each entry and destroyed when empty — so scoping by room
// UUID orphaned progress on re-entry. Scoping by the mission's scene_key keeps
// progress stable across instances of the same map while still preventing kills
// in one scene from counting toward missions of another scene.
func (s *MissionService) activeMissionProgresses(playerID uuid.UUID, sceneKey string) []models.PlayerMissionProgress {
	q := database.DB.
		Where("player_mission_progresses.player_id = ? AND player_mission_progresses.status = ?",
			playerID, string(models.StatusInProgress))
	if sceneKey != "" {
		q = q.Joins("JOIN missions ON missions.id = player_mission_progresses.mission_id").
			Where("missions.scene_key = ?", sceneKey).
			Select("player_mission_progresses.*")
	}
	var progresses []models.PlayerMissionProgress
	q.Find(&progresses)
	return progresses
}

func (s *MissionService) UpdateKillProgress(userID uuid.UUID, enemyTemplateID uuid.UUID, sceneKey string) ([]KillProgressResult, error) {
	fmt.Printf("\n[KillProgress] ============ INICIO UpdateKillProgress ============\n")
	fmt.Printf("[KillProgress] userID=%s | enemyTemplateID=%s | sceneKey=%s\n", userID, enemyTemplateID, sceneKey)

	// 1. Obtener playerStats (playerID interno)
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		fmt.Printf("[KillProgress] ERROR: No se encontró PlayerStats para userID=%s: %v\n", userID, err)
		return nil, err
	}
	playerID := stats.ID
	fmt.Printf("[KillProgress] playerID interno = %s\n", playerID)

	// 2. Misiones aceptadas (in_progress) del jugador EN ESTA ESCENA
	progresses := s.activeMissionProgresses(playerID, sceneKey)
	fmt.Printf("[KillProgress] Misiones activas encontradas: %d\n", len(progresses))
	for _, p := range progresses {
		fmt.Printf("[KillProgress]   → missionID=%d | status=%s\n", p.MissionID, p.Status)
	}
	if len(progresses) == 0 {
		fmt.Printf("[KillProgress] ⚠️  Sin misiones activas — no hay nada que actualizar\n")
		fmt.Printf("[KillProgress] ============ FIN (sin misiones) ============\n\n")
		return nil, nil
	}

	// 3. Resolver nombre del enemigo muerto
	var killedEnemy models.Enemy
	enemyName := ""
	if err := database.DB.First(&killedEnemy, "id = ?", enemyTemplateID).Error; err != nil {
		fmt.Printf("[KillProgress] ⚠️  No se encontró Enemy con templateID=%s en la DB: %v\n", enemyTemplateID, err)
		fmt.Printf("[KillProgress]    El kill igual continuará (RequiredEnemy vacío lo aceptará)\n")
	} else {
		enemyName = killedEnemy.Name
		fmt.Printf("[KillProgress] Enemigo muerto: '%s' (id=%s)\n", enemyName, enemyTemplateID)
	}

	var results []KillProgressResult

	for _, p := range progresses {
		fmt.Printf("[KillProgress] --- Procesando missionID=%d (status=%s) ---\n", p.MissionID, p.Status)

		tasks, err := s.GetTasks(p.MissionID)
		if err != nil {
			fmt.Printf("[KillProgress]   ERROR al obtener tareas: %v\n", err)
			continue
		}
		fmt.Printf("[KillProgress]   Tareas encontradas: %d\n", len(tasks))
		for _, t := range tasks {
			fmt.Printf("[KillProgress]   Tarea id=%d | type='%s' | required_enemy='%s' | required_kills=%d\n",
				t.ID, t.Type, t.RequiredEnemy, t.RequiredKills)
		}

		// Deserializar TasksCompleted
		var tasksCompleted map[string]bool
		if err := json.Unmarshal(p.TasksCompleted, &tasksCompleted); err != nil {
			tasksCompleted = make(map[string]bool)
		}

		// Deserializar KillCounts
		var killCounts map[string]int
		if p.KillCounts != nil {
			if err := json.Unmarshal(p.KillCounts, &killCounts); err != nil {
				killCounts = make(map[string]int)
			}
		} else {
			killCounts = make(map[string]int)
		}

		changed := false

		for _, t := range tasks {
			taskKey := fmt.Sprint(t.ID)

			// ¿Ya está completada?
			if tasksCompleted[taskKey] {
				fmt.Printf("[KillProgress]   Task %d: SKIP (ya completada)\n", t.ID)
				continue
			}

			// ¿Es un tipo de kill individual?
			if t.Type != models.TaskTypeDefeatEnemy && t.Type != models.TaskTypeKillBoss {
				fmt.Printf("[KillProgress]   Task %d: SKIP (tipo '%s' no es defeat_enemy ni kill_boss)\n", t.ID, t.Type)
				continue
			}

			// ¿Coincide el enemigo?
			if t.RequiredEnemy != "" && t.RequiredEnemy != enemyName {
				fmt.Printf("[KillProgress]   Task %d: SKIP (required_enemy='%s' ≠ enemigo_muerto='%s')\n",
					t.ID, t.RequiredEnemy, enemyName)
				continue
			}

			// ✅ Esta tarea aplica — incrementar kill count
			killCounts[taskKey]++
			currentKills := killCounts[taskKey]
			requiredKills := t.RequiredKills
			if requiredKills <= 0 {
				requiredKills = 1
			}

			taskDone := currentKills >= requiredKills
			fmt.Printf("[KillProgress]   Task %d: ✅ MATCH — kills %d/%d | completada=%v\n",
				t.ID, currentKills, requiredKills, taskDone)

			if taskDone {
				tasksCompleted[taskKey] = true
				fmt.Printf("[KillProgress]   Task %d: 🏁 COMPLETADA\n", t.ID)
			}

			results = append(results, KillProgressResult{
				MissionID:     p.MissionID,
				TaskID:        t.ID,
				KillsDone:     currentKills,
				RequiredKills: requiredKills,
				TaskCompleted: taskDone,
			})

			changed = true
		}

		if !changed {
			fmt.Printf("[KillProgress]   Misión %d: ninguna tarea cambió\n", p.MissionID)
			continue
		}

		// Guardar progreso
		updatedTasksJSON, _ := json.Marshal(tasksCompleted)
		updatedKillsJSON, _ := json.Marshal(killCounts)
		p.TasksCompleted = updatedTasksJSON
		p.KillCounts = updatedKillsJSON

		// Verificar si la misión está completa
		allDone := true
		for _, t := range tasks {
			if !tasksCompleted[fmt.Sprint(t.ID)] {
				allDone = false
				break
			}
		}

		if allDone {
			p.Status = models.StatusCompleted
			now := time.Now()
			p.CompletedAt = &now

			fmt.Printf("[KillProgress]   Misión %d: 🎉 COMPLETADA TOTALMENTE\n", p.MissionID)

			// Entregar recompensas. La query de arriba filtra misiones ya
			// completadas, así que esta rama solo corre en la transición.
			s.deliverRewards(playerID, p.MissionID)

			for i := range results {
				if results[i].MissionID == p.MissionID {
					results[i].MissionDone = true
				}
			}
		} else {
			p.Status = models.StatusInProgress
			fmt.Printf("[KillProgress]   Misión %d: en progreso\n", p.MissionID)
		}

		if err := s.Repo.CreateOrUpdateProgress(&p); err != nil {
			fmt.Printf("[KillProgress]   ERROR al guardar progreso: %v\n", err)
		} else {
			fmt.Printf("[KillProgress]   Progreso guardado OK\n")
		}
	}

	fmt.Printf("[KillProgress] ============ FIN UpdateKillProgress — resultados: %d ============\n\n", len(results))
	return results, nil
}




func (s *MissionService) UpdateKillAllProgress(userID uuid.UUID, sceneKey string) ([]KillProgressResult, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return nil, err
	}
	playerID := stats.ID

	fmt.Printf("\n[KillAllProgress] ============ INICIO UpdateKillAllProgress ============\n")
	fmt.Printf("[KillAllProgress] userID=%s | sceneKey=%s | playerID=%s\n", userID, sceneKey, playerID)

	// Misiones aceptadas (in_progress) del jugador EN ESTA ESCENA
	progresses := s.activeMissionProgresses(playerID, sceneKey)
	fmt.Printf("[KillAllProgress] Misiones activas encontradas: %d\n", len(progresses))
	for _, p := range progresses {
		fmt.Printf("[KillAllProgress]   → missionID=%d | status=%s\n", p.MissionID, p.Status)
	}
	if len(progresses) == 0 {
		fmt.Printf("[KillAllProgress] ⚠️  Sin misiones activas para kill_all — revisar si la misión tiene PlayerMissionProgress creado\n")
		fmt.Printf("[KillAllProgress] ============ FIN (sin misiones) ============\n\n")
		return nil, nil
	}

	var results []KillProgressResult

	for _, p := range progresses {
		tasks, _ := s.GetTasks(p.MissionID)
		changed := false

		var tasksCompleted map[string]bool
		if err := json.Unmarshal(p.TasksCompleted, &tasksCompleted); err != nil {
			tasksCompleted = make(map[string]bool)
		}

		for _, t := range tasks {
			taskKey := fmt.Sprint(t.ID)
			if tasksCompleted[taskKey] {
				fmt.Printf("[KillAllProgress]   Task %d: SKIP (ya completada)\n", t.ID)
				continue
			}

			if t.Type == models.TaskTypeKillAll {
				tasksCompleted[taskKey] = true
				changed = true
				fmt.Printf("[KillAllProgress]   Task %d (kill_all): ✅ COMPLETADA — sala despejada\n", t.ID)

				results = append(results, KillProgressResult{
					MissionID:     p.MissionID,
					TaskID:        t.ID,
					KillsDone:     1,
					RequiredKills: 1,
					TaskCompleted: true,
				})
			} else {
				fmt.Printf("[KillAllProgress]   Task %d: SKIP (tipo '%s' no es kill_all)\n", t.ID, t.Type)
			}
		}

		if changed {
			updatedJSON, _ := json.Marshal(tasksCompleted)
			p.TasksCompleted = updatedJSON

			// Verificar si la misión entera está completa
			allDone := true
			for _, t := range tasks {
				if !tasksCompleted[fmt.Sprint(t.ID)] {
					allDone = false
					break
				}
			}

			if allDone {
				p.Status = models.StatusCompleted
				now := time.Now()
				p.CompletedAt = &now

				// Entregar recompensas. La query filtra misiones ya completadas,
				// así que esta rama solo corre en la transición.
				s.deliverRewards(playerID, p.MissionID)

				// Marcar todos los resultados de esta misión como completados
				for i := range results {
					if results[i].MissionID == p.MissionID {
						results[i].MissionDone = true
					}
				}

				fmt.Printf("[MissionService] Mission %d COMPLETED (KillAll) for player %s\n", p.MissionID, playerID)
			} else {
				p.Status = models.StatusInProgress
			}

			if err := s.Repo.CreateOrUpdateProgress(&p); err != nil {
				fmt.Printf("[KillAllProgress]   ERROR al guardar progreso: %v\n", err)
			} else {
				fmt.Printf("[KillAllProgress]   Progreso guardado OK\n")
			}
		}
	}

	fmt.Printf("[KillAllProgress] ============ FIN — resultados: %d ============\n\n", len(results))
	return results, nil
}

// GetKillAllProgress retorna las tareas kill_all activas del jugador (sin modificar nada).
// Se usa para emitir progreso incremental al HUD cuando muere un enemigo.
func (s *MissionService) GetKillAllProgress(userID uuid.UUID, sceneKey string) ([]KillProgressResult, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return nil, err
	}
	playerID := stats.ID

	progresses := s.activeMissionProgresses(playerID, sceneKey)

	var results []KillProgressResult
	for _, p := range progresses {
		tasks, _ := s.GetTasks(p.MissionID)
		var tasksCompleted map[string]bool
		if err := json.Unmarshal(p.TasksCompleted, &tasksCompleted); err != nil {
			tasksCompleted = make(map[string]bool)
		}
		for _, t := range tasks {
			if t.Type == models.TaskTypeKillAll && !tasksCompleted[fmt.Sprint(t.ID)] {
				results = append(results, KillProgressResult{
					MissionID: p.MissionID,
					TaskID:    t.ID,
				})
			}
		}
	}
	return results, nil
}
