package services

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// writeWav crea un .wav falso de `size` bytes con el mtime dado.
func writeWav(t *testing.T, dir, name string, size int, mod time.Time) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, make([]byte, size), 0644); err != nil {
		t.Fatalf("writeWav %s: %v", name, err)
	}
	if err := os.Chtimes(path, mod, mod); err != nil {
		t.Fatalf("chtimes %s: %v", name, err)
	}
	return path
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// TestCleanCache_TTL: los .wav más viejos que el TTL se borran; los recientes no.
func TestCleanCache_TTL(t *testing.T) {
	dir := t.TempDir()
	s := &TTSService{CacheDir: dir, cacheTTL: 24 * time.Hour, cacheMaxBytes: 0}

	old := writeWav(t, dir, "old.wav", 100, time.Now().Add(-48*time.Hour))
	fresh := writeWav(t, dir, "fresh.wav", 100, time.Now())
	// Archivos que no son .wav se ignoran aunque sean viejos.
	other := writeWav(t, dir, "keep.txt", 100, time.Now().Add(-48*time.Hour))

	s.CleanCache()

	if exists(old) {
		t.Error("old.wav should have been removed by TTL")
	}
	if !exists(fresh) {
		t.Error("fresh.wav should have survived")
	}
	if !exists(other) {
		t.Error("non-wav file should never be touched")
	}
}

// TestCleanCache_SizeCap: por encima del tope se borran los más viejos primero
// hasta quedar por debajo (orden LRU por mtime).
func TestCleanCache_SizeCap(t *testing.T) {
	dir := t.TempDir()
	s := &TTSService{CacheDir: dir, cacheTTL: 0, cacheMaxBytes: 2500}

	now := time.Now()
	oldest := writeWav(t, dir, "a.wav", 1000, now.Add(-3*time.Hour))
	middle := writeWav(t, dir, "b.wav", 1000, now.Add(-2*time.Hour))
	newest2 := writeWav(t, dir, "c.wav", 1000, now.Add(-1*time.Hour))
	newest1 := writeWav(t, dir, "d.wav", 1000, now)

	s.CleanCache() // total 4000 > cap 2500 → deben caer los 2 más viejos

	if exists(oldest) || exists(middle) {
		t.Error("the two oldest wavs should have been evicted by the size cap")
	}
	if !exists(newest2) || !exists(newest1) {
		t.Error("the two newest wavs should have survived")
	}
}

// TestCleanCache_Disabled: con TTL y tope en 0 no se borra nada.
func TestCleanCache_Disabled(t *testing.T) {
	dir := t.TempDir()
	s := &TTSService{CacheDir: dir, cacheTTL: 0, cacheMaxBytes: 0}

	old := writeWav(t, dir, "old.wav", 100, time.Now().Add(-1000*time.Hour))
	s.CleanCache()

	if !exists(old) {
		t.Error("nothing should be removed when both criteria are disabled")
	}
}
