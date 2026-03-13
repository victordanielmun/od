package websocket

import (
	"sync"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/spatial"
)

type Room struct {
	ID         string
	Clients    map[*Client]bool
	Grid       *spatial.SpatialGrid
	MapData    *models.MapData
	SceneKey   string
	Type       string
	InviteCode string
	MaxUsers   int
	Broadcast  chan *models.WSMessage // Local broadcast channel if needed, or Hub handles it
	mu         sync.RWMutex
}

func NewRoom(id string, mapData *models.MapData) *Room {
	return &Room{
		ID:       id,
		Clients:  make(map[*Client]bool),
		Grid:     spatial.NewSpatialGrid(),
		MapData:  mapData,
		MaxUsers: 50, // Default
	}
}

func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client] = true
}

func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, client)
	// Also remove from Grid
	r.Grid.RemoveUser(client.ID.String())
}

func (r *Room) GetClientsCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}
