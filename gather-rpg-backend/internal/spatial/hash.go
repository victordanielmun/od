package spatial

import (
	"fmt"
	"math"
)

const (
	CellSize = 500.0 // Pixels
)

// GetCellKey returns the unique string key for a given coordinate
func GetCellKey(x, y float64) string {
	col := int(math.Floor(x / CellSize))
	row := int(math.Floor(y / CellSize))
	return fmt.Sprintf("%d,%d", col, row)
}

// GetAdjacentCells returns the keys of the cell and its neighbors (3x3 grid)
func GetAdjacentCells(cellKey string) []string {
	var col, row int
	fmt.Sscanf(cellKey, "%d,%d", &col, &row)

	cells := make([]string, 0, 9)
	for dx := -1; dx <= 1; dx++ {
		for dy := -1; dy <= 1; dy++ {
			cells = append(cells, fmt.Sprintf("%d,%d", col+dx, row+dy))
		}
	}
	return cells
}
