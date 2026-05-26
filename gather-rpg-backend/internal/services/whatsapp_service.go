package services

import (
	"bytes"
	"encoding/base64"
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

// CheckWhatsAppNumber checks if a number exists on WhatsApp using a specific instance
func (s *WhatsAppService) CheckWhatsAppNumber(instanceName string, number string) (bool, error) {
	// Strip any leading '+' if present
	cleanNumber := number
	if len(cleanNumber) > 0 && cleanNumber[0] == '+' {
		cleanNumber = cleanNumber[1:]
	}

	url := fmt.Sprintf("%s/chat/whatsappNumbers/%s", s.apiURL, instanceName)

	payload := map[string]interface{}{
		"numbers": []string{cleanNumber},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return false, fmt.Errorf("failed to marshal payload: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return false, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return false, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	type CheckResult struct {
		Exists bool   `json:"exists"`
		Jid    string `json:"jid"`
		Number string `json:"number"`
	}

	var results []CheckResult
	if err := json.Unmarshal(respBytes, &results); err != nil {
		return false, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	if len(results) == 0 {
		return false, fmt.Errorf("empty results returned from evolution api")
	}

	return results[0].Exists, nil
}

// SendText dispatches a plain text message to a specific number via the Evolution API
func (s *WhatsAppService) SendText(instanceName string, number string, text string) (map[string]interface{}, error) {
	// Strip any leading '+' if present
	cleanNumber := number
	if len(cleanNumber) > 0 && cleanNumber[0] == '+' {
		cleanNumber = cleanNumber[1:]
	}

	url := fmt.Sprintf("%s/message/sendText/%s", s.apiURL, instanceName)

	payload := map[string]interface{}{
		"number": cleanNumber,
		"text":   text,
		"options": map[string]interface{}{
			"delay":       1200,
			"linkPreview": false,
		},
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

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %v", err)
	}

	return result, nil
}

// SendPresence sets the presence status of the WhatsApp bot (e.g. composing, available, unavailable)
func (s *WhatsAppService) SendPresence(instanceName string, number string, presenceState string) error {
	// Strip any leading '+' if present
	cleanNumber := number
	if len(cleanNumber) > 0 && cleanNumber[0] == '+' {
		cleanNumber = cleanNumber[1:]
	}

	url := fmt.Sprintf("%s/chat/sendPresence/%s", s.apiURL, instanceName)

	payload := map[string]interface{}{
		"number": cleanNumber,
		"options": map[string]interface{}{
			"presence": presenceState,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	return nil
}

// DownloadMedia retrieves a media file (like raw audio) from Evolution API using the message context
func (s *WhatsAppService) DownloadMedia(instanceName string, messageKey map[string]interface{}, message map[string]interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/message/downloadMedia/%s", s.apiURL, instanceName)

	payload := map[string]interface{}{
		"key":     messageKey,
		"message": message,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal download media payload: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create download media request: %v", err)
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

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("evolution api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	// Evolution API downloadMedia returns either base64 or raw binary.
	// If the response is JSON with a base64 field, decode it.
	var jsonRes struct {
		Base64 string `json:"base64"`
	}
	if err := json.Unmarshal(respBytes, &jsonRes); err == nil && jsonRes.Base64 != "" {
		// Strip metadata prefix e.g. "data:audio/ogg;base64," if present
		b64Str := jsonRes.Base64
		for i := 0; i < len(b64Str)-7; i++ {
			if b64Str[i:i+7] == "base64," {
				b64Str = b64Str[i+7:]
				break
			}
		}

		decoded, decodeErr := base64.StdEncoding.DecodeString(b64Str)
		if decodeErr == nil {
			return decoded, nil
		}
	}

	return respBytes, nil
}



