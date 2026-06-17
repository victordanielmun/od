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
	"strings"
	"time"
)

type TTSService struct {
	ExePath   string
	ModelsDir string
	CacheDir  string
	semaphore chan struct{}
}

func NewTTSService(exePath, modelsDir, cacheDir string) *TTSService {
	// Create cache dir if not exists
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		log.Printf("[TTSService] Warning: failed to create cache dir: %v", err)
	}

	// Create models dir if not exists
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		log.Printf("[TTSService] Warning: failed to create models dir: %v", err)
	}

	return &TTSService{
		ExePath:   exePath,
		ModelsDir: modelsDir,
		CacheDir:  cacheDir,
		semaphore: make(chan struct{}, 2), // Limit parallel Piper processes to 2
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
