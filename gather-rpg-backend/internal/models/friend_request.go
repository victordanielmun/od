package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FriendRequestStatus string

const (
	FriendRequestPending  FriendRequestStatus = "pending"
	FriendRequestAccepted FriendRequestStatus = "accepted"
	FriendRequestRejected FriendRequestStatus = "rejected"
	FriendRequestCanceled FriendRequestStatus = "canceled"
)

type FriendRequest struct {
	ID          uuid.UUID           `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	RequesterID uuid.UUID           `gorm:"type:uuid;not null;index:idx_friend_request_pair,unique" json:"requester_id"`
	AddresseeID uuid.UUID           `gorm:"type:uuid;not null;index:idx_friend_request_pair,unique" json:"addressee_id"`
	Status      FriendRequestStatus `gorm:"type:varchar(16);not null;default:'pending';index" json:"status"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
	DeletedAt   gorm.DeletedAt      `gorm:"index" json:"-"`
}

