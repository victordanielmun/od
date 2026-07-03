package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OpenAIClient struct {
	APIKey string
	URL    string
	Model  string
}

func NewOpenAIClient(apiKey string, model string) *OpenAIClient {
	return &OpenAIClient{
		APIKey: apiKey,
		URL:    "https://api.openai.com/v1/chat/completions",
		Model:  model,
	}
}

// openAIResponseFormat forces structured JSON output so we don't depend on the
// model wrapping its answer in markdown fences (sanitizeJSON in dialogue_service
// becomes a safety net rather than the primary parser).
type openAIResponseFormat struct {
	Type string `json:"type"`
}

// openAIChatRequest is OpenAI-specific (not the shared ChatRequest) because the
// gpt-5.x family uses max_completion_tokens (max_tokens is rejected) and supports
// response_format. Keeping it local avoids leaking these fields into the DeepSeek
// and Mistral clients that share ChatRequest.
type openAIChatRequest struct {
	Model               string                `json:"model"`
	Messages            []ChatMessage         `json:"messages"`
	Temperature         float32               `json:"temperature"`
	MaxCompletionTokens int                   `json:"max_completion_tokens,omitempty"`
	ResponseFormat      *openAIResponseFormat `json:"response_format,omitempty"`
}

func (c *OpenAIClient) SendPrompt(systemPrompt string, userPrompt string) (string, error) {
	if c.APIKey == "" || c.APIKey == "your-openai-api-key" {
		return "", fmt.Errorf("OpenAI API Key not configured correctly")
	}

	reqBody := openAIChatRequest{
		Model: c.Model,
		Messages: []ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		// Lower temperature: the response is a constrained JSON contract, not
		// creative writing. Less variance -> shorter, more deterministic output
		// (faster) and far better dialogue-cache hit rates.
		Temperature: 0.3,
		// Safety ceiling so a runaway generation can't stall the turn. The
		// bilingual JSON fits comfortably under this; it only caps pathological cases.
		MaxCompletionTokens: 1000,
	}

	// Native JSON mode, but ONLY when the prompt actually asks for JSON. OpenAI
	// rejects response_format=json_object (status 400) unless the word "json" appears
	// in the messages. The dialogue prompt contains "RESPOND ONLY IN JSON", but plain
	// callers like the translation service do not — forcing JSON mode there made every
	// translation fail (so nothing got cached and missions re-translated on every open).
	if strings.Contains(strings.ToLower(systemPrompt+" "+userPrompt), "json") {
		reqBody.ResponseFormat = &openAIResponseFormat{Type: "json_object"}
	}

	jsonBody, _ := json.Marshal(reqBody)

	// Retry transient failures. Every dialogue turn is an LLM call, so a single
	// network blip or an OpenAI-side 429/5xx (which their edge returns in tens of
	// milliseconds, long before the model runs) must not hard-fail the turn and
	// strand the player mid-mission. We retry only transient errors — a 4xx like
	// 400 (bad request) is deterministic and retrying it just wastes time.
	const maxAttempts = 3
	client := &http.Client{Timeout: 60 * time.Second}
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Printf("[OpenAIClient] Sending Request to %s (Model: %s) [attempt %d/%d]\n", c.URL, c.Model, attempt, maxAttempts)

		content, retryable, err := c.doRequest(client, jsonBody)
		if err == nil {
			fmt.Printf("[OpenAIClient] Received Response: %s\n", content)
			return content, nil
		}

		lastErr = err
		if !retryable {
			return "", err
		}

		fmt.Printf("[OpenAIClient] Transient error on attempt %d/%d: %v\n", attempt, maxAttempts, err)
		if attempt < maxAttempts {
			// Linear backoff: 300ms, then 600ms. Short enough to keep the turn
			// responsive, long enough to ride out a brief rate-limit spike.
			time.Sleep(time.Duration(attempt) * 300 * time.Millisecond)
		}
	}

	return "", fmt.Errorf("OpenAI request failed after %d attempts: %w", maxAttempts, lastErr)
}

// doRequest performs a single OpenAI call. It returns (content, retryable, err):
// retryable is true when the failure looks transient (network error, HTTP 429, or
// 5xx) and the caller should try again, false for deterministic errors (4xx).
func (c *OpenAIClient) doRequest(client *http.Client, jsonBody []byte) (string, bool, error) {
	req, err := http.NewRequest("POST", c.URL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", false, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := client.Do(req)
	if err != nil {
		// Transport-level failure (connection reset, timeout, DNS/TLS): transient.
		return "", true, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		retryable := resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
		return "", retryable, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", false, err
	}

	if len(chatResp.Choices) == 0 {
		return "", false, fmt.Errorf("OpenAI API returned no choices")
	}

	return chatResp.Choices[0].Message.Content, false, nil
}
