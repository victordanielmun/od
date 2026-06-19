package services

import (
	"gather-rpg-backend/internal/combat"
	"gather-rpg-backend/internal/models"

	"gorm.io/gorm"
)

type CombatService struct {
	Manager *combat.CombatManager
}

func NewCombatService(db *gorm.DB) *CombatService {
	return &CombatService{
		Manager: combat.NewCombatManager(db),
	}
}

func (s *CombatService) SetClass(playerID string, className string) (*models.PlayerStats, error) {
	return s.Manager.SetPlayerClass(playerID, className)
}
