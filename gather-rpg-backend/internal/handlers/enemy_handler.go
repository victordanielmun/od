package handlers

import (
	"encoding/json"
	"net/http"
	
	"gather-rpg-backend/internal/repository"
)

type EnemyHandler struct {
	repo repository.EnemyRepository
}

func NewEnemyHandler(repo repository.EnemyRepository) *EnemyHandler {
	return &EnemyHandler{repo: repo}
}

// GET /api/enemies/config?level=1
// Devuelve la configuración de todos los enemigos de un nivel
func (h *EnemyHandler) GetEnemyConfig(w http.ResponseWriter, r *http.Request) {
	levelID := r.URL.Query().Get("level")
	if levelID == "" {
		levelID = "1"
	}

	configs, err := h.repo.GetByLevel(r.Context(), levelID)
	if err != nil {
		http.Error(w, "error obteniendo configuración: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(configs)
}
