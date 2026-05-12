package services

import (
	"fmt"
)

// Shared models for Chat API (OpenAI compatible)
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature"`
}

type ChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// LLMClient defines the interface for all AI providers
type LLMClient interface {
	SendPrompt(systemPrompt, userPrompt string) (string, error)
}

// NewLLMClient is the Factory function to create the appropriate AI client
func NewLLMClient(provider, apiKey, model string) (LLMClient, error) {
	fmt.Printf("[LLMFactory] Initializing provider: %s with model: %s\n", provider, model)
	
	switch provider {
	case "deepseek":
		return NewDeepSeekClient(apiKey, model), nil
	case "openai":
		return NewOpenAIClient(apiKey, model), nil
	case "mistral":
		return NewMistralClient(apiKey, model), nil
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", provider)
	}
}
