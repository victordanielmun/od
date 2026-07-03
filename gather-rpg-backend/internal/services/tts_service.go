package services

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// janitorInterval es cada cuánto corre la limpieza del caché de audios.
const janitorInterval = 6 * time.Hour

type TTSService struct {
	ExePath   string
	ModelsDir string
	CacheDir  string
	semaphore chan struct{}
	// Política de limpieza del caché (0 = criterio desactivado):
	cacheTTL      time.Duration // expiran los .wav sin uso hace más de esto
	cacheMaxBytes int64         // tope de tamaño total; se borran los más viejos
}

func NewTTSService(exePath, modelsDir, cacheDir string, cacheTTLDays int, cacheMaxMB int64) *TTSService {
	// Create cache dir if not exists
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		log.Printf("[TTSService] Warning: failed to create cache dir: %v", err)
	}

	// Create models dir if not exists
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		log.Printf("[TTSService] Warning: failed to create models dir: %v", err)
	}

	s := &TTSService{
		ExePath:       exePath,
		ModelsDir:     modelsDir,
		CacheDir:      cacheDir,
		semaphore:     make(chan struct{}, 2), // Limit parallel Piper processes to 2
		cacheTTL:      time.Duration(cacheTTLDays) * 24 * time.Hour,
		cacheMaxBytes: cacheMaxMB * 1024 * 1024,
	}

	// Janitor del caché: sin él los .wav se acumulan para siempre (las respuestas
	// libres del LLM son únicas por conversación y nunca vuelven a tener hit).
	if s.cacheTTL > 0 || s.cacheMaxBytes > 0 {
		go s.cacheJanitor()
	}

	return s
}

// cacheJanitor corre la limpieza al arrancar y luego cada janitorInterval.
func (s *TTSService) cacheJanitor() {
	s.CleanCache()
	ticker := time.NewTicker(janitorInterval)
	defer ticker.Stop()
	for range ticker.C {
		s.CleanCache()
	}
}

// CleanCache aplica la política de retención sobre CacheDir en dos pasos:
//  1. TTL: borra los .wav cuyo mtime es más viejo que cacheTTL. Los cache-hits
//     renuevan el mtime (ver Generate), así que esto es un LRU de facto: los
//     textos repetidos (saludos, misiones) sobreviven y las respuestas únicas
//     del LLM expiran solas.
//  2. Tope de tamaño: si el total sigue por encima de cacheMaxBytes, borra los
//     más viejos primero hasta quedar por debajo.
//
// Borrar es siempre seguro: un audio que vuelva a pedirse se regenera con Piper
// en el próximo request (el os.Stat de Generate falla y sigue el flujo normal).
func (s *TTSService) CleanCache() {
	type cacheFile struct {
		path string
		size int64
		mod  time.Time
	}

	entries, err := os.ReadDir(s.CacheDir)
	if err != nil {
		log.Printf("[TTSService] Cache janitor: cannot read cache dir: %v", err)
		return
	}

	var files []cacheFile
	var total int64
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".wav") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, cacheFile{
			path: filepath.Join(s.CacheDir, e.Name()),
			size: info.Size(),
			mod:  info.ModTime(),
		})
		total += info.Size()
	}

	removed := 0
	var freed int64

	// 1. TTL por antigüedad (mtime renovado en cada hit).
	if s.cacheTTL > 0 {
		cutoff := time.Now().Add(-s.cacheTTL)
		kept := files[:0]
		for _, f := range files {
			if f.mod.Before(cutoff) {
				if os.Remove(f.path) == nil {
					removed++
					freed += f.size
					total -= f.size
					continue
				}
			}
			kept = append(kept, f)
		}
		files = kept
	}

	// 2. Tope de tamaño total: borrar los más viejos hasta caber.
	if s.cacheMaxBytes > 0 && total > s.cacheMaxBytes {
		sort.Slice(files, func(i, j int) bool { return files[i].mod.Before(files[j].mod) })
		for _, f := range files {
			if total <= s.cacheMaxBytes {
				break
			}
			if os.Remove(f.path) == nil {
				removed++
				freed += f.size
				total -= f.size
			}
		}
	}

	if removed > 0 {
		log.Printf("[TTSService] Cache janitor: removed %d wav(s), freed %.1f MB, cache now %.1f MB",
			removed, float64(freed)/(1024*1024), float64(total)/(1024*1024))
	}
}

// MapVoiceToModel maps edge-tts voice names to local Piper English models
func MapVoiceToModel(voice string) string {
	voice = strings.ToLower(voice)
	switch {
	// Female English models
	case strings.Contains(voice, "amy"), strings.Contains(voice, "ana"), strings.Contains(voice, "aria"), strings.Contains(voice, "natasha"), strings.Contains(voice, "maisie"):
		return "en_US-amy-medium.onnx"
	case strings.Contains(voice, "lessac"), strings.Contains(voice, "sonia"), strings.Contains(voice, "emily"), strings.Contains(voice, "jenny"):
		return "en_US-lessac-medium.onnx"
	case strings.Contains(voice, "kristin"):
		return "en_US-kristin-medium.onnx"

	// Male English models
	case strings.Contains(voice, "joe"), strings.Contains(voice, "brian"), strings.Contains(voice, "william"), strings.Contains(voice, "roger"), strings.Contains(voice, "christopher"):
		return "en_US-joe-medium.onnx"
	case strings.Contains(voice, "ryan"), strings.Contains(voice, "connor"), strings.Contains(voice, "luke"), strings.Contains(voice, "thomas"):
		return "en_US-ryan-medium.onnx"
	case strings.Contains(voice, "norman"):
		return "en_US-norman-medium.onnx"
	case strings.Contains(voice, "sam"):
		return "en_US-sam-medium.onnx"
	case strings.Contains(voice, "danny"):
		return "en_US-danny-low.onnx"

	// Multi-speaker / other models
	case strings.Contains(voice, "libritts"), strings.Contains(voice, "librits"):
		return "en_US-libritts_r-medium.onnx"

	default:
		// Default fallback model
		return "en_US-joe-medium.onnx"
	}
}

// Generate synthesizes text to speech using Piper and returns the cache key
func (s *TTSService) Generate(text, voice string) (string, error) {
	startTime := time.Now()
	fmt.Printf("\n[Performance] === Go Backend: TTS Generation (Piper) Start ===\n")
	fmt.Printf("[Performance] Text: '%s' | Mapped Voice: %s\n", text, voice)

	// Clean text and calculate cache key based on text and voice
	cleanText := strings.TrimSpace(text)
	if cleanText == "" {
		return "", fmt.Errorf("text cannot be empty")
	}

	hashInput := fmt.Sprintf("%s_%s", cleanText, voice)
	hasher := md5.New()
	hasher.Write([]byte(hashInput))
	cacheKey := hex.EncodeToString(hasher.Sum(nil))

	outputFile := filepath.Join(s.CacheDir, fmt.Sprintf("%s.wav", cacheKey))

	// Check if already in cache
	if _, err := os.Stat(outputFile); err == nil {
		// Renovar el mtime en cada hit: el janitor expira por antigüedad, así que
		// esto convierte el TTL en un LRU (los audios que sí se reutilizan viven).
		now := time.Now()
		_ = os.Chtimes(outputFile, now, now)
		fmt.Printf("[Performance] Go Backend: TTS Cache Hit! Output file already exists.\n")
		fmt.Printf("[Performance] Go Backend: TTS total process complete. Took %d ms\n\n", time.Since(startTime).Milliseconds())
		return cacheKey, nil
	}

	// Resolve the correct model file
	modelName := MapVoiceToModel(voice)
	modelPath := filepath.Join(s.ModelsDir, modelName)

	// Robust model fallback check
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		log.Printf("[TTSService] Mapped model %s does not exist in %s. Finding fallback...", modelName, s.ModelsDir)
		// Scan directory for any .onnx model file
		files, err := os.ReadDir(s.ModelsDir)
		if err == nil {
			for _, f := range files {
				if !f.IsDir() && strings.HasSuffix(f.Name(), ".onnx") {
					modelPath = filepath.Join(s.ModelsDir, f.Name())
					log.Printf("[TTSService] Found fallback model: %s", modelPath)
					break
				}
			}
		}
	}

	// If no model path can be found, return error
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		return "", fmt.Errorf("no voice model (.onnx) found in directory: %s", s.ModelsDir)
	}

	// Acquire semaphore (limit concurrency)
	fmt.Printf("[Performance] Go Backend: Waiting for Piper semaphore...\n")
	s.semaphore <- struct{}{}
	defer func() { <-s.semaphore }()
	fmt.Printf("[Performance] Go Backend: Semaphore acquired. Running Piper process...\n")

	startPiper := time.Now()

	// Run command: piper --model <modelPath> --output_file <outputFile>
	cmd := exec.Command(s.ExePath, "--model", modelPath, "--output_file", outputFile)
	cmd.Stdin = bytes.NewBufferString(cleanText)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("piper execution failed: %v | stderr: %s", err, stderr.String())
	}

	piperDuration := time.Since(startPiper).Milliseconds()
	fmt.Printf("[Performance] Go Backend: Piper execution complete. Synthesis took %d ms\n", piperDuration)
	fmt.Printf("[Performance] Go Backend: TTS total process complete. Total took %d ms\n\n", time.Since(startTime).Milliseconds())

	return cacheKey, nil
}
