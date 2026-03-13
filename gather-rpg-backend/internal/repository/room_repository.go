package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

type RoomRepository struct{}

func NewRoomRepository() *RoomRepository {
	return &RoomRepository{}
}

func (r *RoomRepository) Create(room *models.Room) error {
	return database.DB.Create(room).Error
}

func (r *RoomRepository) GetByID(id uuid.UUID) (*models.Room, error) {
	var room models.Room
	if err := database.DB.First(&room, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *RoomRepository) GetPublic() ([]models.Room, error) {
	var rooms []models.Room
	if err := database.DB.Where("is_public = ?", true).Find(&rooms).Error; err != nil {
		return nil, err
	}
	return rooms, nil
}

func (r *RoomRepository) Delete(id uuid.UUID) error {
	return database.DB.Delete(&models.Room{}, "id = ?", id).Error
}

func (r *RoomRepository) FindByScene(sceneKey string, roomType string) ([]models.Room, error) {
	var rooms []models.Room
	// Fetch rooms with matching scene and type, ordered by creation (oldest likely to be fuller)
	// Optionally we could filter "is not full" in SQL, but MaxUsers is in the row, so we can do it.
	// But `current_users` is NOT in the DB row usually (it's in memory).
	// So we just fetch candidates and filter in Service.
	if err := database.DB.Where("scene_key = ? AND type = ?", sceneKey, roomType).Find(&rooms).Error; err != nil {
		return nil, err
	}
	return rooms, nil
}

func (r *RoomRepository) GetMapConfig(sceneKey string) (*models.MapConfig, error) {
	var config models.MapConfig
	if err := database.DB.Where("scene_key = ?", sceneKey).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}
