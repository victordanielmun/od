package utils

import (
	"testing"
	"time"
)

func TestWeekStart(t *testing.T) {
	cases := []struct {
		name string
		in   time.Time
		want time.Time
	}{
		// 2024-01-01 was a Monday.
		{"monday", time.Date(2024, 1, 1, 10, 30, 0, 0, time.UTC), time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
		{"sunday same week", time.Date(2024, 1, 7, 23, 59, 0, 0, time.UTC), time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
		{"next monday", time.Date(2024, 1, 8, 0, 0, 0, 0, time.UTC), time.Date(2024, 1, 8, 0, 0, 0, 0, time.UTC)},
		{"wednesday", time.Date(2024, 1, 3, 6, 0, 0, 0, time.UTC), time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := WeekStart(c.in)
			if !got.Equal(c.want) {
				t.Errorf("WeekStart(%v) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}

func TestWeekStartIsMidnightMonday(t *testing.T) {
	ws := CurrentWeekStart()
	if ws.Weekday() != time.Monday {
		t.Errorf("CurrentWeekStart weekday = %v, want Monday", ws.Weekday())
	}
	if ws.Hour() != 0 || ws.Minute() != 0 || ws.Second() != 0 {
		t.Errorf("CurrentWeekStart not at midnight: %v", ws)
	}
}
