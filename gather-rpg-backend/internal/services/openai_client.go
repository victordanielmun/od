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

func (c *OpenAIClient) SendPrompt(systemPrompt string, userPrompt string) (string, error) {
	if c.APIKey == "" || c.APIKey == "your-openai-api-key" {
		return "", fmt.Errorf("OpenAI API Key not configured correctly")
	}

	reqBody := ChatRequest{
		Model: c.Model,
		Messages: []ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.7,
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
