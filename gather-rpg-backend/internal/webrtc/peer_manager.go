package webrtc

import (
	"sync"
	"time"

	"gather-rpg-backend/internal/models"
)

type PeerManager struct {
	// peers maps userID -> map[sessionID]map[peerID]*models.PeerConnection
	peers map[string]map[string]map[string]*models.PeerConnection
	mu    sync.RWMutex
}

func NewPeerManager() *PeerManager {
	return &PeerManager{
		peers: make(map[string]map[string]map[string]*models.PeerConnection),
	}
}

func (pm *PeerManager) AddPeerConnection(userID, peerID, sessionID, roomID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if _, ok := pm.peers[userID]; !ok {
		pm.peers[userID] = make(map[string]map[string]*models.PeerConnection)
	}
	if _, ok := pm.peers[userID][sessionID]; !ok {
		pm.peers[userID][sessionID] = make(map[string]*models.PeerConnection)
	}

	pm.peers[userID][sessionID][peerID] = &models.PeerConnection{
		UserID:    userID,
		PeerID:    peerID,
		SessionID: sessionID,
		RoomID:    roomID,
		State:     "connecting",
		CreatedAt: time.Now(),
		LastPing:  time.Now(),
	}
}

func (pm *PeerManager) RemovePeerConnection(userID, peerID, sessionID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if userPeers, ok := pm.peers[userID]; ok {
		if sessionPeers, ok := userPeers[sessionID]; ok {
			delete(sessionPeers, peerID)
			if len(sessionPeers) == 0 {
				delete(userPeers, sessionID)
			}
		}
		if len(userPeers) == 0 {
			delete(pm.peers, userID)
		}
	}
}

func (pm *PeerManager) RemoveAllPeerConnections(userID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	delete(pm.peers, userID)
}

func (pm *PeerManager) GetPeerConnectionsForSession(userID, sessionID string) []*models.PeerConnection {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var conns []*models.PeerConnection
	if userPeers, ok := pm.peers[userID]; ok {
		if sessionPeers, ok := userPeers[sessionID]; ok {
			for _, conn := range sessionPeers {
				conns = append(conns, conn)
			}
		}
	}
	return conns
}

func (pm *PeerManager) GetConnectionState(userID, peerID, sessionID string) string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if userPeers, ok := pm.peers[userID]; ok {
		if sessionPeers, ok := userPeers[sessionID]; ok {
			if conn, ok := sessionPeers[peerID]; ok {
				return conn.State
			}
		}
	}
	return ""
}

func (pm *PeerManager) IsConnected(userID, peerID, sessionID string) bool {
	state := pm.GetConnectionState(userID, peerID, sessionID)
	return state != ""
}

func (pm *PeerManager) UpdateLastPing(userID, peerID, sessionID string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if userPeers, ok := pm.peers[userID]; ok {
		if sessionPeers, ok := userPeers[sessionID]; ok {
			if conn, ok := sessionPeers[peerID]; ok {
				conn.LastPing = time.Now()
				if conn.State == "connecting" {
					conn.State = "connected"
				}
			}
		}
	}
}

func (pm *PeerManager) CleanupStaleConnections(timeout time.Duration) []models.PeerConnection {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	var removed []models.PeerConnection
	now := time.Now()

	for userID, userPeers := range pm.peers {
		for sessionID, sessionPeers := range userPeers {
			for peerID, conn := range sessionPeers {
				if now.Sub(conn.LastPing) > timeout {
					removed = append(removed, *conn)
					delete(sessionPeers, peerID)
				}
			}
			if len(sessionPeers) == 0 {
				delete(userPeers, sessionID)
			}
		}
		if len(userPeers) == 0 {
			delete(pm.peers, userID)
		}
	}
	return removed
}
