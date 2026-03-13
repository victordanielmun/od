package services

import (
	"fmt"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

	"github.com/google/uuid"
)

type RoomService struct {
	Repo *repository.RoomRepository
}

func NewRoomService(repo *repository.RoomRepository) *RoomService {
	return &RoomService{Repo: repo}
}

func (s *RoomService) CreateRoom(room *models.Room) error {
	return s.Repo.Create(room)
}

func (s *RoomService) GetRoom(id uuid.UUID) (*models.Room, error) {
	return s.Repo.GetByID(id)
}

func (s *RoomService) GetCandidates(sceneKey, roomType string) ([]models.Room, error) {
	return s.Repo.FindByScene(sceneKey, roomType)
}

func (s *RoomService) CreateInstance(sceneKey, roomType string) (*models.Room, error) {
	maxUsers := 50
	if roomType == "mission" {
		maxUsers = 4
	}

	newRoom := &models.Room{
		Name:      fmt.Sprintf("%s %s", sceneKey, uuid.New().String()[:4]),
		SceneKey:  sceneKey,
		Type:      roomType,
		MaxUsers:  maxUsers,
		IsPublic:  roomType == "public",
		CreatedBy: uuid.Nil, // System created
	}
	// We need a dummy UUID for 'CreatedBy' or handle it nullable.
	// Model says `not null`. Ideally we have a 'system' user UUID or we pass it in.
	// Let's assume uuid.Nil might fail specific constraints if FK exists.
	// For now, let's generate a random one or leave it empty if GORM allows (it won't if `not null`).
	// We'll set a placeholder UUID.
	newRoom.CreatedBy = uuid.MustParse("00000000-0000-0000-0000-000000000000") // System User

	if err := s.Repo.Create(newRoom); err != nil {
		return nil, err
	}
	return newRoom, nil
}

func (s *RoomService) GetPublicRooms() ([]models.Room, error) {
	return s.Repo.GetPublic()
}

func (s *RoomService) DeleteRoom(id uuid.UUID) error {
	return s.Repo.Delete(id)
}

func (s *RoomService) GetMapConfig(sceneKey string) (*models.MapConfig, error) {
	return s.Repo.GetMapConfig(sceneKey)
}
