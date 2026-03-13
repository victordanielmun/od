package services

import (
	"context"
	"sort"

	"gather-rpg-backend/internal/webrtc"
)

type PeerService struct {
	Manager         *webrtc.PeerManager
	MovementService *MovementService
}

func NewPeerService(movementService *MovementService) *PeerService {
	return &PeerService{
		Manager:         webrtc.NewPeerManager(),
		MovementService: movementService,
	}
}

type UserDistance struct {
	UserID   string
	Distance float64
}

// GetUsersInAudioRange calculates distances and returns users within range, sorted by distance
func (s *PeerService) GetUsersInAudioRange(ctx context.Context, roomID string, userID string, currentX, currentY float64, nearbyUsers []string) ([]UserDistance, error) {
	// 1. Fetch positions of nearby users
	// Optimization: MovementService.GetPositionsBatch uses Redis pipeline
	positions, err := s.MovementService.GetPositionsBatch(ctx, roomID, nearbyUsers)
	if err != nil {
		return nil, err
	}

	// 2. Calculate distances and filter
	var inRange []UserDistance
	for _, pos := range positions {
		if pos.UserID == userID {
			continue
		}

		dist := webrtc.CalculateDistance(currentX, currentY, pos.X, pos.Y)
		if webrtc.IsInAudioRange(dist) {
			inRange = append(inRange, UserDistance{
				UserID:   pos.UserID,
				Distance: dist,
			})
		}
	}

	// 3. Sort by distance (closest first)
	sort.Slice(inRange, func(i, j int) bool {
		return inRange[i].Distance < inRange[j].Distance
	})

	// 4. Limit to MaxPeerConnections (handled by caller logic usually, but we can helper here)
	// But the requirement says "Limit to MAX_PEER_CONNECTIONS closest users"
	if len(inRange) > webrtc.MaxPeerConnections {
		inRange = inRange[:webrtc.MaxPeerConnections]
	}

	return inRange, nil
}
