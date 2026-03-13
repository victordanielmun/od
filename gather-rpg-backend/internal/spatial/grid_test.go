package spatial

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSpatialGrid_Isolation(t *testing.T) {
	grid := NewSpatialGrid()

	// User A at (100, 100) -> Cell 0,0
	grid.AddUser("userA", 100, 100)

	// User B at (200, 200) -> Cell 0,0 (Same cell)
	grid.AddUser("userB", 200, 200)

	// User C at (600, 100) -> Cell 1,0 (Adjacent right)
	grid.AddUser("userC", 600, 100)

	// User D at (2000, 2000) -> Cell 4,4 (Far away)
	grid.AddUser("userD", 2000, 2000)

	// Check neighbors for A
	nearbyA := grid.GetNearbyUsers(100, 100)
	assert.Contains(t, nearbyA, "userA", "Should contain self")
	assert.Contains(t, nearbyA, "userB", "Should contain same cell user")
	assert.Contains(t, nearbyA, "userC", "Should contain adjacent cell user")
	assert.NotContains(t, nearbyA, "userD", "Should NOT contain far user")

	// Check neighbors for D
	nearbyD := grid.GetNearbyUsers(2000, 2000)
	assert.Contains(t, nearbyD, "userD")
	assert.NotContains(t, nearbyD, "userA")
	assert.NotContains(t, nearbyD, "userB")
	assert.NotContains(t, nearbyD, "userC")
}

func TestSpatialGrid_Movement(t *testing.T) {
	grid := NewSpatialGrid()
	grid.AddUser("userA", 100, 100)

	// Move A to far away
	grid.UpdateUserPosition("userA", 2000, 2000)

	// Check old location
	nearbyOld := grid.GetNearbyUsers(100, 100)
	assert.NotContains(t, nearbyOld, "userA", "Should be gone from old cell")

	// Check new location
	nearbyNew := grid.GetNearbyUsers(2000, 2000)
	assert.Contains(t, nearbyNew, "userA", "Should be in new cell")
}
