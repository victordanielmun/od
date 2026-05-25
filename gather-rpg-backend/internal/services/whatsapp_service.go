package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"gather-rpg-backend/internal/config"
)

type WhatsAppService struct {
	apiURL string
	apiKey string
	client *http.Client
}

func NewWhatsAppService(cfg *config.Config) *WhatsAppService {
	return &WhatsAppService{
		apiURL: cfg.EvolutionAPIURL,
		apiKey: cfg.EvolutionAPIKey,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// CreateInstance creates a WhatsApp instance in the Evolution API
func (s *WhatsAppService) CreateInstance(instanceName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/instance/create", s.apiURL)

	payload := map[string]interface{}{
		"instanceName": instanceName,
		"qrcode":       true,
		"integration":  "WHATSAPP-BAILEYS",
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		// Log response for easier debugging
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return result, nil
}

// GetConnectQR fetches the connection status / QR code for the instance
func (s *WhatsAppService) GetConnectQR(instanceName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/instance/connect/%s", s.apiURL, instanceName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return result, nil
}

// GetConnectionState gets the connection state of the WhatsApp instance
func (s *WhatsAppService) GetConnectionState(instanceName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/instance/connectionState/%s", s.apiURL, instanceName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return result, nil
}

// FetchInstances lists all instances in the Evolution API
func (s *WhatsAppService) FetchInstances() ([]interface{}, error) {
	url := fmt.Sprintf("%s/instance/fetchInstances", s.apiURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var rawResult []interface{}
	if err := json.Unmarshal(respBytes, &rawResult); err != nil {
		// Try parsing as object if it's not a list (sometimes error responses or empty statuses are objects)
		var objResult map[string]interface{}
		if err2 := json.Unmarshal(respBytes, &objResult); err2 == nil {
			return []interface{}{objResult}, nil
		}
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return rawResult, nil
}

// DeleteInstance removes an instance from Evolution API
func (s *WhatsAppService) DeleteInstance(instanceName string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/instance/delete/%s", s.apiURL, instanceName)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return result, nil
}
