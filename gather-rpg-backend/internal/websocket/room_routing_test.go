package websocket

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// resolveRoomRouting reproduce la decisión de tipo/aforo de handleRequestMapJoin,
// aislada de la BD y del hub para poder fijarla con tests. Si se cambia una, hay
// que cambiar la otra — por eso el test comprueba las reglas de negocio y no la
// implementación.
func resolveRoomRouting(sceneMode string, isPublic bool, mapMaxUsers int) (string, int) {
	roomType := roomTypePublic
	maxUsers := mapMaxUsers
	if !isPublic {
		roomType = "mission"
	}
	switch sceneMode {
	case "cooperative", "competitive":
		roomType = sceneMode
		if maxUsers > maxTeamPlayers {
			maxUsers = maxTeamPlayers
		}
	case "individual":
		roomType = roomTypeSolo
		maxUsers = maxSoloPlayers
	}
	return roomType, maxUsers
}

func TestRoomRoutingByMissionMode(t *testing.T) {
	cases := []struct {
		name      string
		sceneMode string
		isPublic  bool
		mapMax    int
		wantType  string
		wantMax   int
	}{
		{
			// Sin misión: mapa de tránsito libre, aforo del mapa.
			name: "escena sin misiones", sceneMode: "", isPublic: true, mapMax: 50,
			wantType: "public", wantMax: 50,
		},
		{
			// Lo que hacía imposible el examen: 50 desconocidos en el mapa final,
			// todos obligados a acertar su card para que cayera el boss.
			name: "individual aísla a 1 jugador", sceneMode: "individual", isPublic: true, mapMax: 50,
			wantType: "solo", wantMax: 1,
		},
		{
			name: "cooperativo tope 5", sceneMode: "cooperative", isPublic: true, mapMax: 50,
			wantType: "cooperative", wantMax: 5,
		},
		{
			// Competitivo NO es "cooperative": si lo fuera, processEnemyKill
			// repartiría el crédito de kills a todo el equipo y no habría carrera.
			name: "competitivo tope 5 y tipo propio", sceneMode: "competitive", isPublic: true, mapMax: 50,
			wantType: "competitive", wantMax: 5,
		},
		{
			// Un mapa con aforo menor que el tope de equipo no se infla.
			name: "no sube el aforo del mapa", sceneMode: "cooperative", isPublic: true, mapMax: 3,
			wantType: "cooperative", wantMax: 3,
		},
		{
			name: "mapa privado sin misión", sceneMode: "", isPublic: false, mapMax: 50,
			wantType: "mission", wantMax: 50,
		},
		{
			// El modo manda sobre la visibilidad del mapa.
			name: "individual en mapa privado", sceneMode: "individual", isPublic: false, mapMax: 50,
			wantType: "solo", wantMax: 1,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotType, gotMax := resolveRoomRouting(tc.sceneMode, tc.isPublic, tc.mapMax)
			assert.Equal(t, tc.wantType, gotType)
			assert.Equal(t, tc.wantMax, gotMax)
		})
	}
}

// El crédito compartido de kills es exclusivo del cooperativo. Si el competitivo
// usara ese mismo tipo de sala, matar un enemigo puntuaría a todos los rivales.
func TestOnlyCooperativeSharesKillCredit(t *testing.T) {
	assert.True(t, roomTypeCooperative == "cooperative",
		"processEnemyKill compara room.Type contra 'cooperative' literalmente")
	assert.NotEqual(t, roomTypeCooperative, roomTypeCompetitive)
	assert.NotEqual(t, roomTypeCooperative, roomTypeSolo)
}
