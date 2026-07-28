package websocket

import (
	"testing"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func newExamRoom() *Room {
	// Construido a mano: NewRoom arranca el loop de IA y aquí solo interesa el
	// estado de sesión de retos.
	return &Room{
		ID:              "exam-room",
		Clients:         make(map[*Client]bool),
		askedChallenges: make(map[string][]uuid.UUID),
		examWorldID:     make(map[string]uint),
		examStats:       make(map[string]map[string]models.TagStat),
	}
}

func TestAskedChallengesNoRepeat(t *testing.T) {
	r := newExamRoom()
	p := "player-1"
	c1, c2 := uuid.New(), uuid.New()

	assert.Empty(t, r.AskedChallenges(p))

	r.MarkChallengeAsked(p, c1)
	r.MarkChallengeAsked(p, c2)
	assert.Equal(t, []uuid.UUID{c1, c2}, r.AskedChallenges(p))

	// El historial es por jugador: lo de uno no excluye retos al otro.
	assert.Empty(t, r.AskedChallenges("player-2"))

	r.ResetAskedChallenges(p)
	assert.Empty(t, r.AskedChallenges(p))
}

func TestExamSessionAccumulatesByTag(t *testing.T) {
	r := newExamRoom()
	p := "player-1"

	// Sin sesión abierta, las respuestas no cuentan.
	r.RecordExamAnswer(p, []string{"food"}, "final_mision_1", true)
	worldID, stats := r.TakeExamSession(p)
	assert.Zero(t, worldID)
	assert.Nil(t, stats)

	r.StartExamSession(p, 7)
	r.RecordExamAnswer(p, []string{"vocabulary", "food"}, "final_mision_1", true)
	r.RecordExamAnswer(p, []string{"vocabulary", "food"}, "final_mision_1", false)
	// El exam_tag es enrutamiento, no un tema: nunca debe aparecer en el diagnóstico.
	r.RecordExamAnswer(p, []string{"final_mision_1", "animals"}, "final_mision_1", true)

	worldID, stats = r.TakeExamSession(p)
	assert.Equal(t, uint(7), worldID)
	assert.Equal(t, 2, stats["food"].Total)
	assert.Equal(t, 1, stats["food"].OK)
	assert.Equal(t, 1, stats["animals"].Total)
	assert.NotContains(t, stats, "final_mision_1")
}

func TestTakeExamSessionIsSingleShot(t *testing.T) {
	r := newExamRoom()
	p := "player-1"
	r.StartExamSession(p, 3)
	r.RecordExamAnswer(p, []string{"food"}, "", true)

	worldID, stats := r.TakeExamSession(p)
	assert.Equal(t, uint(3), worldID)
	assert.Len(t, stats, 1)

	// Segundo flush (p. ej. salir de la sala justo tras matar al boss): no debe
	// registrar el intento otra vez.
	worldID, stats = r.TakeExamSession(p)
	assert.Zero(t, worldID)
	assert.Nil(t, stats)
}

// TestExamSessionMethodsAreLockSafe verifica que los métodos de sesión toman el
// lock por su cuenta y no se bloquean entre sí. Es la invariante que hace que el
// motor de combate DEBA llamarlos con room.mu liberado: el mutex no es reentrante,
// así que llamarlos con el lock tomado colgaría la sala entera.
func TestExamSessionMethodsAreLockSafe(t *testing.T) {
	r := newExamRoom()
	done := make(chan struct{})

	go func() {
		for i := 0; i < 200; i++ {
			p := "player-1"
			r.StartExamSession(p, 1)
			r.MarkChallengeAsked(p, uuid.New())
			_ = r.AskedChallenges(p)
			r.RecordExamAnswer(p, []string{"food"}, "", i%2 == 0)
			_ = r.ExamWorldID(p)
			r.ClearPlayerSession(p)
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("deadlock: los métodos de sesión de examen se bloquearon entre sí")
	}
}
