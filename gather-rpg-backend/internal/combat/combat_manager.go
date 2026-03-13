package combat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type CombatManager struct {
	DB         *gorm.DB
	Redis      *redis.Client
	Repo       *repository.RoomRepository // Reuse existing repo or create new ones
	Calculator *DamageCalculator
}

func NewCombatManager(db *gorm.DB, rdb *redis.Client) *CombatManager {
	return &CombatManager{
		DB:         db,
		Redis:      rdb,
		Calculator: NewDamageCalculator(),
	}
}

func (cm *CombatManager) SetPlayerClass(playerID string, className string) (*models.PlayerStats, error) {
	var pStats models.PlayerStats
	err := cm.DB.Where("user_id = ?", playerID).First(&pStats).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create new
		pStats = models.PlayerStats{
			UserID: uuid.MustParse(playerID),
		}
	} else if err != nil {
		return nil, err
	}

	// Set stats based on class
	pStats.Class = className
	pStats.Level = 1
	pStats.Experience = 0

	switch className {
	case "warrior":
		pStats.HPMax = 150
		pStats.HPCurrent = 150
		pStats.MPMax = 20
		pStats.MPCurrent = 20
		pStats.Attack = 20
		pStats.Defense = 10
		pStats.Speed = 100
	case "mage":
		pStats.HPMax = 80
		pStats.HPCurrent = 80
		pStats.MPMax = 100
		pStats.MPCurrent = 100
		pStats.Attack = 30
		pStats.Defense = 3
		pStats.Speed = 90
	case "archer":
		pStats.HPMax = 100
		pStats.HPCurrent = 100
		pStats.MPMax = 40
		pStats.MPCurrent = 40
		pStats.Attack = 25
		pStats.Defense = 6
		pStats.Speed = 120
	default:
		// Default Warrior
		pStats.Class = "warrior"
		pStats.HPMax = 150
		pStats.HPCurrent = 150
		pStats.MPMax = 20
		pStats.MPCurrent = 20
		pStats.Attack = 20
		pStats.Defense = 10
		pStats.Speed = 100
	}

	if pStats.ID == uuid.Nil {
		if err := cm.DB.Create(&pStats).Error; err != nil {
			return nil, err
		}
	} else {
		if err := cm.DB.Save(&pStats).Error; err != nil {
			return nil, err
		}
	}

	return &pStats, nil
}

func (cm *CombatManager) StartCombat(playerID, enemyID, roomID string) (*models.CombatState, error) {
	// 1. Fetch Player Stats
	var pStats models.PlayerStats
	if err := cm.DB.Where("user_id = ?", playerID).First(&pStats).Error; err != nil {
		// Auto-create if missing (default warrior)
		stats, err := cm.SetPlayerClass(playerID, "warrior")
		if err != nil {
			return nil, err
		}
		pStats = *stats
	}

	// 2. Fetch Enemy Stats
	var enemy models.Enemy
	if err := cm.DB.Where("id = ?", enemyID).First(&enemy).Error; err != nil {
		// Fallback for test if no DB seed
		enemy = models.Enemy{
			ID:         uuid.MustParse(enemyID),
			Name:       "Goblin",
			Level:      1,
			HPMax:      30,
			MPMax:      0,
			Attack:     8,
			Defense:    2,
			Speed:      5,
			EXPReward:  10,
			GoldReward: 5,
		}
	}

	combatID := uuid.New().String()

	// 3. Create State
	state := &models.CombatState{
		CombatID:    combatID,
		PlayerID:    playerID,
		EnemyID:     enemyID,
		RoomID:      roomID,
		Status:      "active",
		CurrentTurn: "player", // Speed check could go here
		TurnNumber:  1,
		PlayerState: models.CombatEntityState{
			HPCurrent: pStats.HPCurrent,
			HPMax:     pStats.HPMax,
			MPCurrent: pStats.MPCurrent,
			MPMax:     pStats.MPMax,
		},
		EnemyState: models.CombatEntityState{
			HPCurrent: enemy.HPMax,
			HPMax:     enemy.HPMax,
			MPCurrent: enemy.MPMax,
			MPMax:     enemy.MPMax,
		},
		StartedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if pStats.Speed < enemy.Speed {
		state.CurrentTurn = "enemy"
	}

	// 4. Save to Redis
	if err := cm.saveCombatState(state); err != nil {
		return nil, err
	}

	return state, nil
}

func (cm *CombatManager) ProcessPlayerAction(combatID string, actionType string, skillID string) (*models.CombatState, *models.CombatLogEntry, error) {
	state, err := cm.GetCombatState(combatID)
	if err != nil {
		return nil, nil, err
	}

	if state.Status != "active" || state.CurrentTurn != "player" {
		return nil, nil, errors.New("not your turn or combat ended")
	}

	// Execute Action
	logEntry := models.CombatLogEntry{
		Turn:   state.TurnNumber,
		Actor:  "player",
		Action: actionType,
		Target: "enemy",
	}

	// Get stats (simplified: assuming base stats don't change mid-combat for calculation basis)
	// In real impl, we should fetch base stats again or store them in state
	// For now, use hardcoded base stats or fetch from DB
	var pStats models.PlayerStats
	cm.DB.Where("user_id = ?", state.PlayerID).First(&pStats)

	var enemy models.Enemy
	cm.DB.Where("id = ?", state.EnemyID).First(&enemy)

	switch actionType {
	case "attack":
		dmg, crit := cm.Calculator.CalculatePhysicalDamage(pStats.Attack, enemy.Defense)
		state.EnemyState.HPCurrent -= dmg
		logEntry.Damage = dmg
		logEntry.Critical = crit
		if state.EnemyState.HPCurrent < 0 {
			state.EnemyState.HPCurrent = 0
		}

	case "skill":
		// Fetch skill
		// dmg := cm.Calculator.CalculateSkillDamage(...)
		// Implement skill logic

	case "flee":
		// 50% chance
		if rand.Float64() < 0.5 {
			state.Status = "fled"
			logEntry.Action = "fled"
			logEntry.Damage = 0
		} else {
			logEntry.Action = "failed_flee"
		}
	}

	state.CombatLog = append(state.CombatLog, logEntry)

	// Check Victory
	if state.EnemyState.HPCurrent <= 0 {
		state.Status = "victory"
	} else if state.Status == "active" {
		state.CurrentTurn = "enemy"
	}

	state.UpdatedAt = time.Now()
	cm.saveCombatState(state)

	return state, &logEntry, nil
}

func (cm *CombatManager) ProcessEnemyTurn(combatID string) (*models.CombatState, *models.CombatLogEntry, error) {
	state, err := cm.GetCombatState(combatID)
	if err != nil {
		return nil, nil, err
	}

	if state.Status != "active" || state.CurrentTurn != "enemy" {
		return nil, nil, errors.New("not enemy turn")
	}

	// Simple AI: Attack
	// Need Enemy Stats
	var enemy models.Enemy
	cm.DB.Where("id = ?", state.EnemyID).First(&enemy)

	// Need Player Defense
	var pStats models.PlayerStats
	cm.DB.Where("user_id = ?", state.PlayerID).First(&pStats)

	dmg, crit := cm.Calculator.CalculatePhysicalDamage(enemy.Attack, pStats.Defense)

	state.PlayerState.HPCurrent -= dmg
	if state.PlayerState.HPCurrent < 0 {
		state.PlayerState.HPCurrent = 0
	}

	logEntry := models.CombatLogEntry{
		Turn:     state.TurnNumber,
		Actor:    "enemy",
		Action:   "attack",
		Damage:   dmg,
		Target:   "player",
		Critical: crit,
	}

	state.CombatLog = append(state.CombatLog, logEntry)

	// Check Defeat
	if state.PlayerState.HPCurrent <= 0 {
		state.Status = "defeat"
	} else {
		state.CurrentTurn = "player"
		state.TurnNumber++
	}

	state.UpdatedAt = time.Now()
	cm.saveCombatState(state)

	return state, &logEntry, nil
}

func (cm *CombatManager) GetCombatState(combatID string) (*models.CombatState, error) {
	key := fmt.Sprintf("combat:%s", combatID)
	val, err := cm.Redis.Get(context.Background(), key).Result()
	if err != nil {
		return nil, err
	}

	var state models.CombatState
	if err := json.Unmarshal([]byte(val), &state); err != nil {
		return nil, err
	}

	return &state, nil
}

func (cm *CombatManager) saveCombatState(state *models.CombatState) error {
	key := fmt.Sprintf("combat:%s", state.CombatID)
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	// TTL 1 hour
	return cm.Redis.Set(context.Background(), key, data, time.Hour).Err()
}
