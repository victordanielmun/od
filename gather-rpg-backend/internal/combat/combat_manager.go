package combat

import (
	"errors"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CombatManager struct {
	DB *gorm.DB
}

func NewCombatManager(db *gorm.DB) *CombatManager {
	return &CombatManager{
		DB: db,
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
