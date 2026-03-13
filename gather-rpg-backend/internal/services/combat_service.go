package services

import (
	"gather-rpg-backend/internal/combat"
	"gather-rpg-backend/internal/models"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type CombatService struct {
	Manager *combat.CombatManager
}

func NewCombatService(db *gorm.DB, rdb *redis.Client) *CombatService {
	return &CombatService{
		Manager: combat.NewCombatManager(db, rdb),
	}
}

func (s *CombatService) SetClass(playerID string, className string) (*models.PlayerStats, error) {
	return s.Manager.SetPlayerClass(playerID, className)
}

func (s *CombatService) StartCombat(playerID, enemyID, roomID string) (*models.CombatState, error) {
	return s.Manager.StartCombat(playerID, enemyID, roomID)
}

func (s *CombatService) ProcessAction(combatID, actionType, skillID string) (*models.CombatState, *models.CombatLogEntry, error) {
	return s.Manager.ProcessPlayerAction(combatID, actionType, skillID)
}

func (s *CombatService) ProcessEnemyTurn(combatID string) (*models.CombatState, *models.CombatLogEntry, error) {
	return s.Manager.ProcessEnemyTurn(combatID)
}

func (s *CombatService) GetState(combatID string) (*models.CombatState, error) {
	return s.Manager.GetCombatState(combatID)
}
