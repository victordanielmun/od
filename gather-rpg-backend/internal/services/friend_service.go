package services

import (
	"errors"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FriendService struct {
	UserRepo *repository.UserRepository
}

func NewFriendService(userRepo *repository.UserRepository) *FriendService {
	return &FriendService{UserRepo: userRepo}
}

func canonicalPair(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if a.String() < b.String() {
		return a, b
	}
	return b, a
}

func (s *FriendService) ensureNonGuest(userID string) (*models.User, error) {
	user, err := s.UserRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	if user.IsGuest {
		return nil, errors.New("guest users cannot use friends")
	}
	return user, nil
}

func (s *FriendService) FindUserByUsername(username string) (*models.User, error) {
	var user models.User
	if err := database.DB.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *FriendService) ListFriends(currentUserID string) ([]models.User, error) {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return nil, err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return nil, err
	}

	var rows []models.Friendship
	if err := database.DB.
		Where("user1_id = ? OR user2_id = ?", currentUserUUID, currentUserUUID).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	friendIDs := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		if r.User1ID == currentUserUUID {
			friendIDs = append(friendIDs, r.User2ID)
		} else {
			friendIDs = append(friendIDs, r.User1ID)
		}
	}

	if len(friendIDs) == 0 {
		return []models.User{}, nil
	}

	var friends []models.User
	if err := database.DB.
		Select("id", "username", "email", "is_guest", "created_at", "updated_at").
		Where("id IN ?", friendIDs).
		Find(&friends).Error; err != nil {
		return nil, err
	}

	return friends, nil
}

type FriendRequestsResult struct {
	Incoming []FriendRequestView `json:"incoming"`
	Outgoing []FriendRequestView `json:"outgoing"`
}

func (s *FriendService) ListRequests(currentUserID string) (*FriendRequestsResult, error) {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return nil, err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return nil, err
	}

	var incomingRows []models.FriendRequest
	if err := database.DB.
		Where("addressee_id = ? AND status = ?", currentUserUUID, models.FriendRequestPending).
		Order("created_at DESC").
		Find(&incomingRows).Error; err != nil {
		return nil, err
	}

	var outgoingRows []models.FriendRequest
	if err := database.DB.
		Where("requester_id = ? AND status = ?", currentUserUUID, models.FriendRequestPending).
		Order("created_at DESC").
		Find(&outgoingRows).Error; err != nil {
		return nil, err
	}

	requesterIDs := make([]uuid.UUID, 0, len(incomingRows)+len(outgoingRows))
	addresseeIDs := make([]uuid.UUID, 0, len(incomingRows)+len(outgoingRows))
	for _, r := range incomingRows {
		requesterIDs = append(requesterIDs, r.RequesterID)
		addresseeIDs = append(addresseeIDs, r.AddresseeID)
	}
	for _, r := range outgoingRows {
		requesterIDs = append(requesterIDs, r.RequesterID)
		addresseeIDs = append(addresseeIDs, r.AddresseeID)
	}

	userIDs := make([]uuid.UUID, 0, len(requesterIDs)+len(addresseeIDs))
	userIDs = append(userIDs, requesterIDs...)
	userIDs = append(userIDs, addresseeIDs...)
	userByID := map[uuid.UUID]models.User{}
	if len(userIDs) > 0 {
		var users []models.User
		if err := database.DB.Select("id", "username").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, u := range users {
			userByID[u.ID] = u
		}
	}

	incoming := make([]FriendRequestView, 0, len(incomingRows))
	for _, r := range incomingRows {
		incoming = append(incoming, FriendRequestView{
			ID:                r.ID,
			RequesterID:       r.RequesterID,
			RequesterUsername: userByID[r.RequesterID].Username,
			AddresseeID:       r.AddresseeID,
			AddresseeUsername: userByID[r.AddresseeID].Username,
			Status:            r.Status,
			CreatedAt:         r.CreatedAt,
		})
	}

	outgoing := make([]FriendRequestView, 0, len(outgoingRows))
	for _, r := range outgoingRows {
		outgoing = append(outgoing, FriendRequestView{
			ID:                r.ID,
			RequesterID:       r.RequesterID,
			RequesterUsername: userByID[r.RequesterID].Username,
			AddresseeID:       r.AddresseeID,
			AddresseeUsername: userByID[r.AddresseeID].Username,
			Status:            r.Status,
			CreatedAt:         r.CreatedAt,
		})
	}

	return &FriendRequestsResult{Incoming: incoming, Outgoing: outgoing}, nil
}

type FriendRequestView struct {
	ID                uuid.UUID                 `json:"id"`
	RequesterID       uuid.UUID                 `json:"requester_id"`
	RequesterUsername string                    `json:"requester_username"`
	AddresseeID       uuid.UUID                 `json:"addressee_id"`
	AddresseeUsername string                    `json:"addressee_username"`
	Status            models.FriendRequestStatus `json:"status"`
	CreatedAt         time.Time                 `json:"created_at"`
}

type SendFriendRequestInput struct {
	TargetUserID   *uuid.UUID
	TargetUsername *string
}

func (s *FriendService) SendRequest(currentUserID string, input SendFriendRequestInput) (*models.FriendRequest, error) {
	requester, err := s.ensureNonGuest(currentUserID)
	if err != nil {
		return nil, err
	}

	var target *models.User
	if input.TargetUserID != nil {
		u, err := s.UserRepo.FindByID(input.TargetUserID.String())
		if err != nil {
			return nil, err
		}
		target = u
	} else if input.TargetUsername != nil && *input.TargetUsername != "" {
		u, err := s.FindUserByUsername(*input.TargetUsername)
		if err != nil {
			return nil, err
		}
		target = u
	} else {
		return nil, errors.New("target_user_id or target_username is required")
	}

	if target.ID == requester.ID {
		return nil, errors.New("cannot add yourself")
	}
	if target.IsGuest {
		return nil, errors.New("cannot add guest users")
	}

	user1, user2 := canonicalPair(requester.ID, target.ID)
	var existingFriendship models.Friendship
	if err := database.DB.
		Where("user1_id = ? AND user2_id = ?", user1, user2).
		First(&existingFriendship).Error; err == nil {
		return nil, errors.New("already friends")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var existingPending models.FriendRequest
	err = database.DB.
		Where(
			"status = ? AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))",
			models.FriendRequestPending,
			requester.ID, target.ID,
			target.ID, requester.ID,
		).
		First(&existingPending).Error
	if err == nil {
		return nil, errors.New("friend request already pending")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	req := &models.FriendRequest{
		RequesterID: requester.ID,
		AddresseeID: target.ID,
		Status:      models.FriendRequestPending,
	}
	if err := database.DB.Create(req).Error; err != nil {
		return nil, err
	}
	return req, nil
}

func (s *FriendService) AcceptRequest(currentUserID string, requestID uuid.UUID) (*models.FriendRequest, error) {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return nil, err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return nil, err
	}

	var req models.FriendRequest
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", requestID).First(&req).Error; err != nil {
			return err
		}
		if req.AddresseeID != currentUserUUID {
			return errors.New("not allowed")
		}
		if req.Status != models.FriendRequestPending {
			return errors.New("request is not pending")
		}

		requester, err := s.UserRepo.FindByID(req.RequesterID.String())
		if err != nil {
			return err
		}
		addressee, err := s.UserRepo.FindByID(req.AddresseeID.String())
		if err != nil {
			return err
		}
		if requester.IsGuest || addressee.IsGuest {
			return errors.New("guest users cannot use friends")
		}

		user1, user2 := canonicalPair(req.RequesterID, req.AddresseeID)
		friendship := &models.Friendship{User1ID: user1, User2ID: user2}
		if err := tx.Create(friendship).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.FriendRequest{}).
			Where("id = ?", requestID).
			Update("status", models.FriendRequestAccepted).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (s *FriendService) RejectRequest(currentUserID string, requestID uuid.UUID) (*models.FriendRequest, error) {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return nil, err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return nil, err
	}

	var req models.FriendRequest
	if err := database.DB.Where("id = ?", requestID).First(&req).Error; err != nil {
		return nil, err
	}
	if req.AddresseeID != currentUserUUID {
		return nil, errors.New("not allowed")
	}
	if req.Status != models.FriendRequestPending {
		return nil, errors.New("request is not pending")
	}

	if err := database.DB.Model(&models.FriendRequest{}).
		Where("id = ?", requestID).
		Update("status", models.FriendRequestRejected).Error; err != nil {
		return nil, err
	}

	return &req, nil
}

// AreFriends reports whether two users have an established friendship.
func (s *FriendService) AreFriends(a, b uuid.UUID) bool {
	user1, user2 := canonicalPair(a, b)
	var friendship models.Friendship
	err := database.DB.Where("user1_id = ? AND user2_id = ?", user1, user2).First(&friendship).Error
	return err == nil
}

// GetConversation returns the message history between the current user and a
// friend, oldest first, limited to the most recent `limit` messages.
func (s *FriendService) GetConversation(currentUserID string, friendID uuid.UUID, limit int) ([]models.DirectMessage, error) {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return nil, err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return nil, err
	}
	if !s.AreFriends(currentUserUUID, friendID) {
		return nil, errors.New("not friends")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	// Fetch the most recent `limit` messages, then return them oldest-first.
	var rows []models.DirectMessage
	if err := database.DB.
		Where(
			"(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
			currentUserUUID, friendID, friendID, currentUserUUID,
		).
		Order("created_at DESC").
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, nil
}

func (s *FriendService) RemoveFriend(currentUserID string, friendID uuid.UUID) error {
	if _, err := s.ensureNonGuest(currentUserID); err != nil {
		return err
	}
	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return err
	}
	if friendID.String() == currentUserID {
		return errors.New("invalid friend")
	}

	user1, user2 := canonicalPair(currentUserUUID, friendID)
	res := database.DB.Where("user1_id = ? AND user2_id = ?", user1, user2).Delete(&models.Friendship{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("not friends")
	}
	return nil
}
