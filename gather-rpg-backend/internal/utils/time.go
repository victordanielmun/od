package utils

import "time"

// CurrentWeekStart returns the UTC midnight of the most recent Monday (ISO week
// start). It's the canonical boundary used to reset weekly counters: two timestamps
// belong to the same week iff they share the same CurrentWeekStart value.
func CurrentWeekStart() time.Time {
	return WeekStart(time.Now().UTC())
}

// WeekStart returns the UTC midnight of the Monday that begins t's ISO week.
func WeekStart(t time.Time) time.Time {
	t = t.UTC()
	// time.Weekday: Sunday=0..Saturday=6. Shift so Monday=0..Sunday=6.
	offset := (int(t.Weekday()) + 6) % 7
	y, m, d := t.AddDate(0, 0, -offset).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
