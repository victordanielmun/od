package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
		// Native JSON mode. Requires the word "JSON" in the prompt, which the
		// system prompt already contains ("RESPOND ONLY IN JSON").
		ResponseFormat: &openAIResponseFormat{Type: "json_object"},
	}

	jsonBody, _ := json.Marshal(reqBody)
	fmt.Printf("[OpenAIClient] Sending Request to %s (Model: %s)\n", c.URL, c.Model)
	
	req, err := http.NewRequest("POST", c.URL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", err
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("OpenAI API returned no choices")
	}

	fmt.Printf("[OpenAIClient] Received Response: %s\n", chatResp.Choices[0].Message.Content)
	return chatResp.Choices[0].Message.Content, nil
}
