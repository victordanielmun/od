package spatial

import (
	"log"
	"sync"
)

type SpatialGrid struct {
	// cells maps "col,row" -> map[userID]bool
	cells map[string]map[string]bool
	// userCells maps userID -> "col,row" (for quick lookups/removals)
	userCells map[string]string
	mu        sync.RWMutex
}

func NewSpatialGrid() *SpatialGrid {
	return &SpatialGrid{
		cells:     make(map[string]map[string]bool),
		userCells: make(map[string]string),
	}
}

func (g *SpatialGrid) AddUser(userID string, x, y float64) {
	g.mu.Lock()
	defer g.mu.Unlock()

	cellKey := GetCellKey(x, y)
	g.addToCell(userID, cellKey)
}

func (g *SpatialGrid) RemoveUser(userID string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if cellKey, exists := g.userCells[userID]; exists {
		g.removeFromCell(userID, cellKey)
	}
}

func (g *SpatialGrid) UpdateUserPosition(userID string, x, y float64) {
	g.mu.Lock()
	defer g.mu.Unlock()

	newCellKey := GetCellKey(x, y)
	oldCellKey, exists := g.userCells[userID]

	if !exists {
		g.addToCell(userID, newCellKey)
		return
	}

	if oldCellKey != newCellKey {
		g.removeFromCell(userID, oldCellKey)
		g.addToCell(userID, newCellKey)
	}
}

func (g *SpatialGrid) GetNearbyUsers(x, y float64) []string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	centerKey := GetCellKey(x, y)
	nearbyCells := GetAdjacentCells(centerKey)

	users := make([]string, 0)
	for _, key := range nearbyCells {
		if cellUsers, ok := g.cells[key]; ok {
			for uid := range cellUsers {
				users = append(users, uid)
			}
		}
	}
	log.Printf("GetNearbyUsers: Checked %d cells around %s, found %d users", len(nearbyCells), centerKey, len(users))
	return users
}

func (g *SpatialGrid) GetAllUsers() []string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	users := make([]string, 0, len(g.userCells))
	for uid := range g.userCells {
		users = append(users, uid)
	}
	return users
}

// Internal helpers (must be called with lock held)
func (g *SpatialGrid) addToCell(userID, cellKey string) {
	if _, ok := g.cells[cellKey]; !ok {
		g.cells[cellKey] = make(map[string]bool)
	}
	g.cells[cellKey][userID] = true
	g.userCells[userID] = cellKey
}

func (g *SpatialGrid) removeFromCell(userID, cellKey string) {
	if users, ok := g.cells[cellKey]; ok {
		delete(users, userID)
		if len(users) == 0 {
			delete(g.cells, cellKey)
		}
	}
	delete(g.userCells, userID)
}
