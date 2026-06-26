package repository

import (
	"testing"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
)

func TestResetWeeklyIfNeeded(t *testing.T) {
	current := utils.CurrentWeekStart()

	t.Run("stale week resets counters", func(t *testing.T) {
		p := &models.UserLearningProfile{
			WeekStart:      current.AddDate(0, 0, -7),
			WeeklyScore:    120,
			WeeklyCorrect:  8,
			WeeklyAttempts: 15,
			TotalXP:        500, // must be preserved
		}
		if !ResetWeeklyIfNeeded(p) {
			t.Fatal("expected reset to happen for a stale week")
		}
		if p.WeeklyScore != 0 || p.WeeklyCorrect != 0 || p.WeeklyAttempts != 0 {
			t.Errorf("weekly counters not zeroed: %+v", p)
		}
		if !p.WeekStart.Equal(current) {
			t.Errorf("WeekStart = %v, want %v", p.WeekStart, current)
		}
		if p.TotalXP != 500 {
			t.Errorf("TotalXP must be preserved, got %d", p.TotalXP)
		}
	})

	t.Run("same week leaves counters intact", func(t *testing.T) {
		p := &models.UserLearningProfile{
			WeekStart:      current,
			WeeklyScore:    50,
			WeeklyAttempts: 5,
		}
		if ResetWeeklyIfNeeded(p) {
			t.Fatal("did not expect a reset within the same week")
		}
		if p.WeeklyScore != 50 || p.WeeklyAttempts != 5 {
			t.Errorf("counters changed unexpectedly: %+v", p)
		}
	})

	t.Run("zero week stamps current and keeps zero counters", func(t *testing.T) {
		p := &models.UserLearningProfile{} // zero WeekStart, zero counters
		if !ResetWeeklyIfNeeded(p) {
			t.Fatal("expected reset for a zero (never-stamped) WeekStart")
		}
		if !p.WeekStart.Equal(current) {
			t.Errorf("WeekStart = %v, want %v", p.WeekStart, current)
		}
	})
}
