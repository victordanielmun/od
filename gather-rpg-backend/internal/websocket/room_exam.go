package websocket

import (
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

// Estado de la "sesión de retos" de una sala: qué preguntas ya vio cada jugador
// (para no repetirlas) y, cuando el mapa es el examen final de un mundo, cómo le
// está yendo por tema. Todo vive en memoria mientras exista la sala — las salas
// de combate son efímeras, así que una estancia = un intento de examen.
//
// Todos los métodos toman r.mu por su cuenta: el motor de combate los llama con
// el lock LIBERADO (justo después de soltarlo para emitir la card).

// AskedChallenges devuelve los retos ya emitidos a este jugador en esta sala.
func (r *Room) AskedChallenges(playerID string) []uuid.UUID {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.askedChallenges == nil {
		return nil
	}
	// Copia: el llamador la usa fuera del lock.
	out := make([]uuid.UUID, len(r.askedChallenges[playerID]))
	copy(out, r.askedChallenges[playerID])
	return out
}

// MarkChallengeAsked registra un reto como ya emitido a este jugador.
func (r *Room) MarkChallengeAsked(playerID string, challengeID uuid.UUID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.askedChallenges == nil {
		r.askedChallenges = make(map[string][]uuid.UUID)
	}
	r.askedChallenges[playerID] = append(r.askedChallenges[playerID], challengeID)
}

// ResetAskedChallenges limpia el historial de un jugador. Se usa cuando el pool
// se agotó y hay que permitir repeticiones antes que dejarlo sin card.
func (r *Room) ResetAskedChallenges(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.askedChallenges, playerID)
}

// StartExamSession marca que las cards de este jugador cuentan para el examen del
// mundo indicado. Idempotente: no reinicia las estadísticas ya acumuladas.
func (r *Room) StartExamSession(playerID string, worldID uint) {
	if worldID == 0 {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.examWorldID == nil {
		r.examWorldID = make(map[string]uint)
	}
	r.examWorldID[playerID] = worldID
}

// ExamWorldID devuelve el mundo que este jugador está examinando (0 = ninguno).
func (r *Room) ExamWorldID(playerID string) uint {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.examWorldID[playerID]
}

// RecordExamAnswer acumula el resultado de una card por cada tag temático de la
// pregunta. Solo cuenta si el jugador está en sesión de examen. Los tags que son
// el propio exam_tag del mundo se ignoran: no son un tema, son el enrutamiento.
func (r *Room) RecordExamAnswer(playerID string, tags []string, examTag string, isCorrect bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.examWorldID[playerID] == 0 {
		return
	}
	if r.examStats == nil {
		r.examStats = make(map[string]map[string]models.TagStat)
	}
	if r.examStats[playerID] == nil {
		r.examStats[playerID] = make(map[string]models.TagStat)
	}
	for _, tag := range tags {
		if tag == "" || tag == examTag {
			continue
		}
		st := r.examStats[playerID][tag]
		st.Total++
		if isCorrect {
			st.OK++
		}
		r.examStats[playerID][tag] = st
	}
}

// TakeExamSession devuelve y BORRA la sesión de examen de un jugador. Devolverla
// de una sola vez evita que un segundo flush (p. ej. salir de la sala justo
// después de matar al boss) registre el intento dos veces.
func (r *Room) TakeExamSession(playerID string) (uint, map[string]models.TagStat) {
	r.mu.Lock()
	defer r.mu.Unlock()
	worldID := r.examWorldID[playerID]
	if worldID == 0 {
		return 0, nil
	}
	stats := r.examStats[playerID]
	delete(r.examWorldID, playerID)
	delete(r.examStats, playerID)
	if len(stats) == 0 {
		return 0, nil // sin respuestas: no fue un intento real
	}
	return worldID, stats
}

// ClearPlayerSession borra todo el estado de retos de un jugador al salir.
func (r *Room) ClearPlayerSession(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.askedChallenges, playerID)
	delete(r.examWorldID, playerID)
	delete(r.examStats, playerID)
}
