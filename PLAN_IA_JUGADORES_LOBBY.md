# Plan: 5 jugadores con IA en el lobby

> Objetivo: que el lobby nunca esté vacío. Cinco "jugadores" con IA que se pasean,
> se saludan entre ellos y con los que puedes hablar en inglés como si fueran
> personas reales.

---

## 1. Veredicto: viable, y más barato de lo que parece

La infraestructura ya está construida casi entera. Lo que falta no es "hacer IA",
es **conectar tres piezas que ya existen y no se hablan**:

| Pieza que hace falta | ¿Existe ya? | Dónde |
|---|---|---|
| Pintar un jugador remoto que se mueve | ✅ Completo | `PlayerManager.handlePlayersUpdate` ([PlayerManager.js:178](gather-rpg-frontend/src/game/players/PlayerManager.js#L178)) |
| Difundir posiciones a toda la sala | ✅ Completo | `broadcastLoop` ([hub_rooms.go:336](gather-rpg-backend/internal/websocket/hub_rooms.go#L336)) |
| Deambular (wander) con pausas naturales | ✅ Completo | `beginWanderLeg` / `tickWanderLocked` ([room.go:262](gather-rpg-backend/internal/websocket/room.go#L262)) — recién escrito para enemigos |
| Conversación IA con corrección de pronunciación | ✅ Completo | `DialogueService.ProcessInput` ([dialogue_service.go:69](gather-rpg-backend/internal/services/dialogue_service.go#L69)) |
| Voz del personaje (TTS) | ✅ Completo y **gratis** | Piper local + caché wav ([tts_handler.go](gather-rpg-backend/internal/handlers/tts_handler.go)) |
| Burbujas de diálogo sobre el sprite | ✅ Completo | `ChatBubbleManager` ([ChatBubbleManager.js:15](gather-rpg-frontend/src/game/scenes/ChatBubbleManager.js#L15)) |
| Detectar "hay un jugador cerca, pulsa E" | ✅ Completo | `InteractionSystem` ([InteractionSystem.js:99](gather-rpg-frontend/src/game/interactions/InteractionSystem.js#L99)) |
| **Un "cliente" que no es una persona** | ❌ **No existe** | ← esto es el 90% del trabajo |

**El hallazgo clave:** el frontend no valida la identidad de los jugadores
remotos. `positions_update` y `positions_snapshot` ([gameStore.js:357](gather-rpg-frontend/src/store/gameStore.js#L357))
meten en el mapa `players` **cualquier UUID que mande el servidor**, y
`PlayerManager` le crea sprite, nametag, animación de caminar e interpolación sin
preguntar nada. Es decir: si el backend emite posiciones para 5 UUIDs inventados,
**los 5 bots aparecen andando por el lobby sin tocar una línea del frontend**.

---

## 2. Decisión de arquitectura: bots en el servidor, no en el cliente

Hay dos formas de hacerlo y la diferencia es grande:

**A) Bots en el cliente (cada navegador se pinta sus 5).** Barato, pero: cada
jugador ve bots distintos en sitios distintos, dos jugadores reales no pueden
comentar lo que ha dicho un bot, y si dos personas hablan con "el mismo" bot no
es el mismo. Rompe la ilusión en cuanto hay dos personas conectadas.

**B) Bots en el servidor (clientes virtuales dentro de la `Room`).** Todos ven a
los mismos 5 bots, en la misma posición, diciendo lo mismo. Es la única opción
coherente con la arquitectura actual, donde **el lobby es una sala pública
compartida** ([hub_rooms.go:728](gather-rpg-backend/internal/websocket/hub_rooms.go#L728)):
varios usuarios reales caen en la misma instancia.

→ **Se elige B.** Los bots son `Client` con `IsAI = true` y `Conn = nil`, viven en
`room.Clients` y se difunden por la tubería de posiciones que ya existe.

---

## 3. Los 8 agujeros reales (lo que se rompe si se hace a lo bruto)

Meter clientes falsos en `room.Clients` sin más **tumba cosas**. Esto es el
inventario honesto de lo que hay que blindar:

1. **La sala nunca se cerraría.** `handleUnregister` hace
   `if len(room.Clients) == 0 { room.Close() }` ([hub.go:195](gather-rpg-backend/internal/websocket/hub.go#L195)).
   Con 5 bots dentro, el contador nunca llega a 0: la sala, su ticker de IA y sus
   enemigos quedan vivos para siempre. **Fuga de memoria garantizada.**
   → Nuevo `room.HumanCount()`; los bots se despawnean cuando sale el último humano.

2. **Los bots ocuparían plazas.** Mismo `len(room.Clients)` en el matcher de salas
   públicas ([hub_rooms.go:728](gather-rpg-backend/internal/websocket/hub_rooms.go#L728)):
   5 bots = 5 plazas menos, y jugadores reales repartidos en instancias distintas
   (justo lo contrario de lo que buscamos). → mismo `HumanCount()`.

3. **La voz WebRTC se rompería.** `proximityLoop` ([hub_proximity.go:57](gather-rpg-backend/internal/websocket/hub_proximity.go#L57))
   emitiría `start_peer_connection` contra un bot que jamás contesta: el jugador
   real se queda con una tarjeta de audio "conectando" eterna y una sesión fantasma.
   → Los bots se excluyen del descubrimiento de pares. **Los bots no tienen voz
   por WebRTC** (haría falta un servidor de medios; ver fase 4 para la alternativa).

4. **`Conn == nil` es una mina.** `ReadPump`, `WritePump` y `NotifySessionReplaced`
   ([client.go:250](gather-rpg-backend/internal/websocket/client.go#L250)) desreferencian
   `Conn`. Además el canal `send` (256) se llenaría y escupiría *"Client buffer
   full"* en bucle. → `SendJSON` es no-op para bots y a los bots nunca se les
   arrancan las pumps.

5. **Los enemigos les pegarían.** `tickAI` recorre `room.Clients` como objetivos
   ([room.go:509](gather-rpg-backend/internal/websocket/room.go#L509)). En el lobby
   no hay enemigos, pero en cuanto un bot pise un mapa de combate empieza a recibir
   hostias y a robar el "turno de ataque" a los jugadores. → filtrar `IsAI`.

6. **Hablar con un bot te pediría amistad.** Hoy, pulsar E sobre un jugador manda
   `sendChatRequest` ([InteractionSystem.js:258](gather-rpg-frontend/src/game/interactions/InteractionSystem.js#L258)),
   y los mensajes privados exigen amistad previa
   ([hub_social.go:350](gather-rpg-backend/internal/websocket/hub_social.go#L350)).
   Un bot nunca podría contestar por ahí. → E sobre un bot abre el overlay de
   diálogo, no el flujo de amigos. El frontend necesita saber quién es bot: nuevo
   campo `is_ai` en `RedisPosition` / `Position` / `PlayerMovedBroadcast`
   ([position.go](gather-rpg-backend/internal/models/position.go)).

7. **Spam de notificaciones al entrar.** `player_joined` dispara
   *"¡X se ha unido!"* ([gameStore.js:199](gather-rpg-frontend/src/store/gameStore.js#L199)).
   Cinco bots = cinco toasts en cada carga. → los bots no emiten `player_joined`;
   llegan por el snapshot de posiciones.

8. **No existe chat de sala.** Ojo con esto: `handleChatMessage` está **vacío**
   ([hub_rooms.go:499](gather-rpg-backend/internal/websocket/hub_rooms.go#L499)) y
   el frontend ni siquiera escucha `chat_broadcast`. O sea: *"que hablen con los
   jugadores"* **no puede significar "por el chat del lobby", porque ese chat no
   existe**. Las superficies reales son las de la sección siguiente.

---

## 4. Qué significa "que hable" — tres superficies

| Superficie | Qué es | Coste IA |
|---|---|---|
| **Burbuja en el mundo** | Frase flotando sobre el bot, la ven todos los que estén cerca | 0 (frases enlatadas) |
| **Conversación 1:1** | Pulsas E → se abre el overlay de siempre, con micro, pronunciación y traducción | 1 llamada LLM por turno (con caché) |
| **Voz** | El navegador pide el wav a Piper y lo reproduce atenuado por distancia | 0 (Piper es local) |

La combinación es la que da la ilusión: el lobby **suena** solo (burbujas
enlatadas, coste cero) y **responde** de verdad cuando te acercas a hablar
(LLM, mismo pipeline que los NPCs de misión).

---

## 5. Fases

### F1 — Presencia: que se vean y se muevan (backend puro)

*Casi sin frontend. Al terminar esta fase ya hay 5 desconocidos paseando por el lobby.*

- **`internal/websocket/client.go`**: campo `IsAI bool`; `SendJSON` sale temprano
  si `IsAI`; constructor `NewAIClient(hub, id, username, characterID)`.
- **`internal/websocket/room_bots.go`** (nuevo): `SpawnLobbyBots(room)`,
  `DespawnBots(room)` y un ticker de ~100 ms que reutiliza la lógica de paseo de
  `beginWanderLeg`/`tickWanderLocked` (extraída a un helper genérico sobre
  posición+ancla, para no duplicarla entre enemigos y bots).
- Cada tick, el bot escribe en `h.PendingUpdates[roomID][botID]`: el
  `broadcastLoop` que ya existe lo difunde. **Cero mensajes WS nuevos.**
- Validar el destino con `MovementService.ValidatePosition` para que no anden
  sobre paredes.
- **Guardas** (agujeros 1, 2, 3, 4, 5, 7): `room.HumanCount()`, filtro `IsAI` en
  `tickAI` y en `proximityLoop`, sin `player_joined`.
- **Frontend mínimo**: propagar `is_ai` hasta `sprite.isAI` en `PlayerManager`.
- **Tests** (`room_bots_test.go`): aparecen 5; deambulan sin salirse del mapa; no
  cuentan para `MaxUsers`; se van con el último humano; no son objetivo de enemigos.

### F2 — Conversación: que respondan cuando les hablas

*Aquí no se escribe pipeline de IA nuevo: se **enchufa** el que ya funciona.*

- **Datos**: 5 `npc_definitions` + `npc_templates` con `scene_key = 'lobby'`. Al
  crearse la sala, `EnsureRoomInstances` ([npc_service.go:27](gather-rpg-backend/internal/services/npc_service.go#L27))
  ya les crea instancia automáticamente → `/npc/dialogue` funciona **sin tocar el
  backend de diálogo**.
- **Nueva columna `npc_templates.is_ai_player`**: imprescindible. Sin ella,
  `NPCManager.loadNPCs` ([NPCManager.js:29](gather-rpg-frontend/src/game/scenes/NPCManager.js#L29))
  los pintaría *además* como NPCs plantados → cada bot saldría **dos veces**. La
  columna los excluye de `GET /rooms/:id/npcs` pero los deja resolubles para el
  diálogo.
- **`InteractionSystem`**: si el sprite cercano tiene `isAI`, el cartel dice
  "Hablar con X" y la E despacha `lobby-interaction` con el `templateId` del bot →
  `LobbyLayout` ([LobbyLayout.jsx:167](gather-rpg-frontend/src/layouts/LobbyLayout.jsx#L167))
  abre `NPCDialogue.jsx` **tal cual**: micro, evaluación de pronunciación, TTS y
  traducción a tu idioma nativo, todo heredado.
- **Postura del bot**: mientras te atiende deja de pasear y te mira
  (`anim: 'idle'` + dirección). Estado `EngagedWith` en el bot, activado desde el
  handler de diálogo.
- **Eco público**: la respuesta del bot se difunde también como burbuja a los que
  estén cerca — que un tercero vea al bot conversando es la mitad de la ilusión.

### F3 — Vida ambiental: que hablen entre ellos (coste 0)

- Pool de frases por personalidad, en BD o i18n. Burbuja cada 20-40 s con jitter,
  **solo si hay un humano cerca**: sala vacía = ni tokens ni ruido.
- **Mini-diálogos entre bots**: pares guionizados (A dice, B contesta 3 s después).
  Cero LLM y un efecto de "sitio vivo" enorme.
- **Saludo reactivo**: cuando te acercas por primera vez a menos de ~200 px, el bot
  más cercano te saluda por tu nombre ("Hey Victor! Want to practice?"). Plantilla
  enlatada + username.

### F4 — Voz (opcional)

Nada de WebRTC (agujero 3): el cliente pide el wav a `/api/tts` para la frase del
bot y lo reproduce con volumen según distancia. Piper es local, así que **hablar
no cuesta dinero**.

### F5 — Control

- Env `AI_LOBBY_BOTS_ENABLED` y `AI_LOBBY_BOTS_COUNT` (por defecto 5) — poder
  apagarlos en producción sin desplegar.
- Personalidades editables desde el admin de NPCs que ya existe.

---

## 6. Coste

- **LLM**: solo en turnos iniciados por el jugador, exactamente igual que los NPCs
  de hoy, y con la caché de diálogo ya montada (que hashea prompt + camino de
  conversación + idioma). El ambiente es enlatado: **0 tokens**.
- **TTS**: 0 (Piper local con caché de wav).
- **Ancho de banda**: 5 bots a ~10 Hz sobre el batch de 50 ms que ya existe. Ruido.

---

## 7. Riesgos y decisiones abiertas

- **¿Se nota que son bots?** Sí, si se plantan o repiten frase. Mitigación: paseo
  con pausas (ya resuelto), pool de frases amplio, y que el bot **se calle** si
  nadie mira.
- **¿Y si entra gente real?** Lo suyo es que los bots **se retiren** al llenarse el
  lobby (p. ej. despawnear uno por cada humano por encima de N). Decisión de
  producto, no técnica — está por decidir.
- **Moderación**: los bots no deben aparecer como bloqueables ni invitables a
  amistad. Filtrar por `is_ai` en el sidebar y en los flujos sociales.
- **Métricas/presencia**: los bots no deben contar en `PresenceService` ni en las
  métricas Prometheus de usuarios conectados.

---

## 8. Orden recomendado

F1 sola ya cambia la sensación del lobby (gente andando) y es la que tiene todo el
riesgo técnico concentrado. F2 es enchufe puro. F3 es donde está el mayor retorno
por línea escrita. F4 y F5, cuando lo anterior esté rodado.
