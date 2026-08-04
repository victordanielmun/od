package services

import (
	"strings"
	"testing"

	"gather-rpg-backend/internal/models"

	"github.com/stretchr/testify/assert"
)

// El bot tiene que sonar a jugador, no a asistente. Estos tests fijan lo que se
// le pide al LLM y, sobre todo, la limpieza de la respuesta: los tics típicos
// (prefijo con su propio nombre, comillas, acotaciones) son justo lo que delata
// que al otro lado hay una máquina.

// fakeLLM devuelve una respuesta fija y guarda lo que se le pidió.
type fakeLLM struct {
	reply      string
	err        error
	gotSystem  string
	gotUser    string
	callCount  int
}

func (f *fakeLLM) SendPrompt(systemPrompt, userPrompt string) (string, error) {
	f.callCount++
	f.gotSystem = systemPrompt
	f.gotUser = userPrompt
	return f.reply, f.err
}

func testBot() *models.AIPlayer {
	return &models.AIPlayer{
		Username:    "Mia",
		Personality: "You love talking about travel.",
	}
}

func TestReplyAsksTheModelToSoundLikeAPlayer(t *testing.T) {
	llm := &fakeLLM{reply: "Sounds fun! Where did you go?"}
	svc := NewAIPlayerService(llm)

	out, err := svc.Reply(testBot(), "Ana", "es", "I went to the beach", nil)

	assert.NoError(t, err)
	assert.Equal(t, "Sounds fun! Where did you go?", out)

	// Lo esencial del encargo: jugador, no asistente; frases cortas; sin delatarse.
	assert.Contains(t, llm.gotSystem, "You love talking about travel.", "la personalidad configurada viaja al prompt")
	assert.Contains(t, llm.gotSystem, "NOT an assistant")
	assert.Contains(t, llm.gotSystem, "1-2 short sentences")
	assert.Contains(t, llm.gotSystem, "Ana", "el bot sabe con quién habla")
	assert.Contains(t, llm.gotSystem, "es", "y en qué idioma piensa el jugador")
	assert.Contains(t, llm.gotUser, "I went to the beach")
}

func TestReplyPassesTheConversationInOrder(t *testing.T) {
	llm := &fakeLLM{reply: "ok"}
	svc := NewAIPlayerService(llm)

	history := []ConversationTurn{
		{FromPlayer: true, Content: "hi"},
		{FromPlayer: false, Content: "hey there"},
	}
	_, err := svc.Reply(testBot(), "Ana", "es", "how are you?", history)
	assert.NoError(t, err)

	// El hilo debe ir en orden natural y con cada frase atribuida a quien la dijo.
	assert.Less(t, strings.Index(llm.gotUser, "Ana: hi"), strings.Index(llm.gotUser, "Mia: hey there"))
	assert.Contains(t, llm.gotUser, "Ana: how are you?")
}

func TestReplyStripsModelTics(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{"prefijo con su propio nombre", "Mia: hey, what's up?", "hey, what's up?"},
		{"comillas envolventes", `"hey, what's up?"`, "hey, what's up?"},
		{"acotación entre asteriscos", "*smiles* hey there", "hey there"},
		{"espacios sobrantes", "   hello   ", "hello"},
		{"respuesta limpia se deja igual", "hello there", "hello there"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewAIPlayerService(&fakeLLM{reply: tc.raw})
			out, err := svc.Reply(testBot(), "Ana", "es", "hi", nil)
			assert.NoError(t, err)
			assert.Equal(t, tc.want, out)
		})
	}
}

func TestReplyFailsLoudlyWithoutProvider(t *testing.T) {
	svc := NewAIPlayerService(nil)
	_, err := svc.Reply(testBot(), "Ana", "es", "hi", nil)
	assert.Error(t, err, "sin proveedor de IA hay que enterarse, no responder vacío")
}

func TestBotEmailIsNeverDeliverable(t *testing.T) {
	// El dominio .invalid está reservado por la RFC 2606: garantiza que la cuenta
	// del bot jamás colisione con el correo real de una persona.
	assert.Equal(t, "mia@ai-player.invalid", botEmail("Mia"))
	assert.Equal(t, "juan-carlos@ai-player.invalid", botEmail("Juan Carlos"))
}

func TestInteractionModeDrivesTextAndAudio(t *testing.T) {
	text := &models.AIPlayer{InteractionMode: models.AIPlayerModeTextOnly}
	assert.True(t, text.WantsText())
	assert.False(t, text.WantsAudio())

	audio := &models.AIPlayer{InteractionMode: models.AIPlayerModeAudioOnly}
	assert.False(t, audio.WantsText())
	assert.True(t, audio.WantsAudio())

	hybrid := &models.AIPlayer{InteractionMode: models.AIPlayerModeHybrid}
	assert.True(t, hybrid.WantsText())
	assert.True(t, hybrid.WantsAudio())
}
