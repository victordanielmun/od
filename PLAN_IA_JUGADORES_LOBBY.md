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

> **⚠️ Actualización tras implementar F1 — cinco de estos ocho agujeros ya no
> existen.** Todos nacían de la misma premisa: que un bot fuese un `*Client`
> dentro de `room.Clients`. Resultó innecesaria. La sala ya sabe difundir por su
> cuenta (`broadcastToAll`), así que **un bot es solo una posición**, no un
> cliente: sin socket, fuera de `room.Clients`, del `Grid` y de Redis.
>
> Con eso decaen por construcción, sin escribir una sola guarda, los agujeros
> **1** (la sala no se cerraba), **2** (ocupaban plaza), **3** (voz WebRTC rota),
> **4** (`Conn == nil`) y **5** (los enemigos les pegaban): todo eso se mide sobre
> `room.Clients`, donde no están. El **7** (spam de `player_joined`) tampoco
> aplica porque no se emite. Siguen vigentes el **6** (el flujo social hay que
> desviarlo) y el **8** (no hay chat de sala — ya resuelto en el anexo E).
>
> Lo que sí hará falta cuando los bots conversen (F2): una fila en `users` y
> registrarlos en `clientsByID`, que es lo único que permite enrutarles un mensaje
> privado. Nada de eso los mete en `room.Clients`.

El inventario original, que sigue siendo la referencia de por qué el diseño es el
que es:

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

### F1 — Presencia: que se vean y se muevan — ✅ IMPLEMENTADA

*Cinco desconocidos paseando por el lobby. Backend casi puro.*

- **[bots.go](gather-rpg-backend/internal/websocket/bots.go)** (nuevo): `LobbyBot`
  (identidad + posición + tramo de paseo), `Room.EnsureBots` (idempotente, ancla
  los bots donde aparece el jugador que entra) y `Room.tickBots`, colgado del
  mismo bucle de 100 ms que la IA de enemigos.
- **Un bot NO es un `*Client`** — el cambio de diseño que simplifica todo lo
  demás (ver el aviso de la sección 3). Difunde `positions_update` a los clientes
  de la sala, que es el mensaje que el frontend ya sabe pintar. **Cero mensajes
  WS nuevos, cero guardas defensivas.**
- **Terreno**: la geometría del paseo se extrajo a `Room.pickWanderLeg`, que ahora
  comparten enemigos y bots. Respeta vacíos, muros y límites del mapa, y tira
  hacia el ancla cuando el bot se aleja.
- **Difusión en cada tick, también en pausa**, a propósito: al no estar en Redis
  ni en el `Grid`, los bots no salen en el `positions_snapshot` del que acaba de
  entrar. Si solo se emitiera al moverse, un bot parado sería invisible para él.
- **Aforo/limpieza**: no hizo falta `HumanCount()`. Los bots mueren con la sala
  porque viven dentro de ella.
- **Config**: `AI_LOBBY_BOTS` (número, por defecto 5; `0` los apaga sin desplegar).
  Solo se pueblan en la escena `lobby`.
- **Frontend**: `is_ai` viaja en `PlayerMovedBroadcast` → `gameStore` → 
  `sprite.isAI`. `InteractionSystem` los excluye del flujo social: sin esa guarda,
  pulsar E sobre un bot crearía una solicitud de amistad hacia un usuario que no
  existe.
- **Tests**: [bots_test.go](gather-rpg-backend/internal/websocket/bots_test.go)
  (solo en el lobby, idempotencia, identidades distintas, entran andando, no son
  clientes, se difunden con `is_ai`, también en pausa, no simulan sin público, no
  se salen del mapa, se quedan cerca del ancla, no son objetivo de enemigos) y
  [aiPlayers.test.js](gather-rpg-frontend/src/tests/aiPlayers.test.js).
- **Pendiente de verificar en ejecución**: no se pudo pasar el detector de
  carreras de Go (`-race` necesita cgo y no hay gcc en este equipo). El acceso
  concurrente se razonó a mano: `tickBots` construye posiciones y captura los
  destinatarios bajo `r.mu`, y envía fuera del lock.

### F2 — Conversación por chat — ✅ IMPLEMENTADA (backend + admin)

> **Cambio de rumbo respecto al plan original.** F2 iba a reutilizar las tablas de
> NPC (`npc_definitions` / `npc_templates`) y el overlay de diálogo. Se descartó:
> los bots son **otro tipo de entidad**, no una variante de NPC. Usan los
> personajes de JUGADOR, los mueve el servidor, no tienen misiones ni tareas ni
> tienda, y conversan por la ventana de chat entre usuarios. Meterlos en el modelo
> de NPC habría contaminado el pipeline de misiones con casos especiales.

**DB** — tabla propia `ai_players`, DDL en
[ai_players_schema.sql](ai_players_schema.sql) (aplicar a mano: el backend va con
`AUTO_MIGRATE=false`). Cada bot tiene además su **fila espejo en `users`**, que es
lo que permite enrutarle un mensaje privado y que su nombre salga en la ventana de
chat. Su historial **no necesita tabla nueva**: se guarda en `direct_messages`
igual que el de una persona, y de ahí sale tanto lo que ve el jugador al reabrir
el chat como el contexto que se le pasa al LLM.

**Backend**:
- [ai_player_service.go](gather-rpg-backend/internal/services/ai_player_service.go):
  CRUD (crea/borra la fila espejo en la misma transacción), elenco inicial
  idempotente y el cerebro conversacional. Separado del `DialogueService` a
  propósito: aquel resuelve misiones, tareas, tienda y pronunciación; esto es
  charla libre.
- [hub_ai_players.go](gather-rpg-backend/internal/websocket/hub_ai_players.go):
  carga el elenco de la escena, registra a cada bot **solo en `clientsByID`** (que
  es lo único que hace falta para que un DM lo encuentre — nunca en
  `room.Clients`, y así siguen valiendo todas las ventajas de F1), y responde.
- `handleChatRequest` cortocircuita con los bots: la conversación se abre en el
  acto en vez de tramitar una amistad que nadie podría aceptar.
  `handlePrivateMessage` los exime del candado de amistad.
- Detalles que sostienen la ilusión: **pausa de tecleo** proporcional a la
  longitud de la respuesta (una contestación instantánea delata a la máquina), el
  saludo **solo la primera vez**, y limpieza de los tics del LLM (prefijo con su
  propio nombre, comillas envolventes, acotaciones entre asteriscos).

**Frontend**: la E sobre un bot sigue **exactamente el mismo camino** que sobre una
persona — ese es el objetivo. Y
[AdminAIPlayers.jsx](gather-rpg-frontend/src/pages/admin/AdminAIPlayers.jsx) en
`/admin/ai-players` para configurarlos: nombre, personaje, escena, personalidad,
saludo, modo (texto / voz / ambos), voz, ancla y activo.

**Tests**:
[ai_player_service_test.go](gather-rpg-backend/internal/services/ai_player_service_test.go)
(el prompt pide jugador y no asistente, el hilo va en orden, limpieza de tics,
fallo ruidoso sin proveedor) y los de sala actualizados en
[bots_test.go](gather-rpg-backend/internal/websocket/bots_test.go).

**Pendiente**: reproducir el audio en el cliente cuando el modo es `hybrid` o
`audio_only` (el modelo y el servicio ya lo contemplan; falta que el chat pida el
wav a Piper y lo suene). Y aplicar el DDL en la BD remota.

### F2 (plan original, descartado) — Conversación por el overlay de NPC

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

---

# ANEXO — Validación de la lógica actual (interacción + WebSocket)

> Auditoría del código real contra tres expectativas: *mensajes privados en
> pública*, *audio 1:1 en pública*, *audio grupal en privadas*. Decisión tomada:
> los bots hablan **solo por texto**, como un usuario más.

## A. Mensajes privados en sala pública — ⚠️ existe, pero **solo entre amigos**

El recorrido real, verificado extremo a extremo:

1. Pulsas E sobre un jugador → `sendChatRequest` ([InteractionSystem.js:258](gather-rpg-frontend/src/game/interactions/InteractionSystem.js#L258)).
2. `handleChatRequest` ([hub_social.go:82](gather-rpg-backend/internal/websocket/hub_social.go#L82)) bifurca:
   - **Ya sois amigos** → `chat_session_start` a los dos → se abre la ventana y
     además se carga el historial persistido desde `/friends/:id/messages`.
   - **El otro ya te había pedido amistad** → auto-acepta y abre chat.
   - **No hay nada entre vosotros** → crea un `FriendRequest` pendiente y lanza el
     popup de aceptar/rechazar. **No se abre ningún chat.**
3. `handlePrivateMessage` ([hub_social.go:350](gather-rpg-backend/internal/websocket/hub_social.go#L350))
   corta en seco: `if !h.areFriends(...) → "Solo puedes enviar mensajes a tus amigos"`.

**Veredicto:** en el lobby público **no puedes escribirle a un desconocido**.
Primero amistad, luego chat. Es una decisión anti-acoso razonable, pero conviene
saber que "mensajes privados en público" hoy significa "entre amigos".

## B. Audio 1:1 en sala pública — ✅ funciona (y es malla, no pareja)

- Disparo doble: `proximityLoop` cada 2 s ([hub_proximity.go:57](gather-rpg-backend/internal/websocket/hub_proximity.go#L57))
  **y** un chequeo inmediato en cada movimiento ([hub_rooms.go:337](gather-rpg-backend/internal/websocket/hub_rooms.go#L337)).
- Rango **800 px**, volumen con atenuación lineal, tope de **8 pares** simultáneos
  ([proximity.go:8](gather-rpg-backend/internal/webrtc/proximity.go#L8)).
- Iniciador determinista (`ID menor` abre la oferta) → sin colisiones de señalización.
- Bloqueos filtrados en ambas direcciones, tanto al conectar como al desmontar.

**Matiz:** no es "entre dos personas", es **todo el que esté a menos de 800 px**,
cada uno con su volumen. Si hay cinco juntos, se oyen los cinco. Es exactamente el
modelo Gather y es el correcto para el lobby.

## C. Audio grupal en salas privadas — ❌ **hoy no ocurre**

Este es el hallazgo importante. El full-mesh ("sala de reuniones", todos a volumen
máximo sin importar la distancia) está condicionado a `room.Type == "cooperative"`
en los **dos** sitios que lo gobiernan:

- al entrar, el mallado inicial ([hub_rooms.go:226](gather-rpg-backend/internal/websocket/hub_rooms.go#L226));
- y el `return` que apaga la proximidad ([hub_proximity.go:113](gather-rpg-backend/internal/websocket/hub_proximity.go#L113)).

Pero una **sala privada** (mapa con `is_public = false`, PIN de 4 dígitos) se crea
con `effectiveRoomType = "mission"`, no `"cooperative"`. Solo se vuelve
cooperativa si la **misión de esa escena** tiene `Mode = cooperative`.

**Traducción:** una sala privada por PIN usa hoy **audio por proximidad**, igual
que el lobby. Si la quieres con audio grupal hay que ampliar la condición en esos
dos puntos. La señal más limpia ya está en memoria y no exige tocar el esquema:
`room.InviteCode != ""` solo es cierto en salas privadas (`generatePIN()` únicamente
se llama cuando `!isPublic`). El `Room` en memoria **no** tiene `IsPublic`
([room.go:32](gather-rpg-backend/internal/websocket/room.go#L32)), así que usar el
PIN evita arrastrar un campo nuevo.

→ Cambio propuesto: extraer un `room.UsesGroupAudio()` (= `Type == "cooperative" ||
InviteCode != ""`) y usarlo en los dos sitios, en vez de repetir la comparación.

## D. Qué implica todo esto para los bots de texto

Con la decisión tomada (bots en el servidor, interacción por mensajes, sin voz),
la auditoría deja cinco requisitos concretos:

1. **Los bots necesitan fila en `users`.** No es opcional: `handleChatRequest` lee
   el nombre del compañero de la BD (`database.DB.Select("username")...`) y **si el
   SELECT falla no envía `chat_session_start` en absoluto** — el chat con el bot no
   se abriría, en silencio. `Username` y `Email` son únicos y not-null, así que
   cada bot necesita su email ficticio. Buena noticia: `DirectMessage` no tiene
   claves foráneas ([direct_message.go:12](gather-rpg-backend/internal/models/direct_message.go#L12)),
   así que persistir mensajes hacia un bot no rompe nada.
2. **Puentear el candado de amistad.** `areFriends` debe devolver `true` cuando el
   destino es un bot (o bien auto-amistad al spawnear). Sin esto el bot jamás
   recibe un `private_message`.
3. **`handleChatRequest` debe cortocircuitar con los bots.** Un bot no puede pulsar
   "aceptar": si el target es IA, se emite `chat_session_start` directo, sin
   solicitud de amistad de por medio.
4. **`trackClient` sí, Grid y Redis no.** Los bots tienen que estar en
   `clientsByID` para que `findClientByID` los resuelva al recibir un DM. Pero
   dejándolos **fuera de `room.Grid` y fuera de Redis**, el audio los ignora
   gratis: `checkUserProximity` descubre pares vía `Grid.GetNearbyUsers` y luego
   resuelve posiciones vía Redis ([peer_service.go:31](gather-rpg-backend/internal/services/peer_service.go#L31)).
   Sin presencia en ninguno de los dos, un bot **no puede** entrar en una sesión de
   voz. Cero código defensivo: el agujero nº 3 del plan se cierra solo.
5. **Latido de posición para los bots quietos.** Consecuencia del punto anterior:
   `positions_snapshot` se construye desde Grid + Redis, así que un jugador que
   entra **no recibe los bots en el snapshot inicial**. Los verá en el siguiente
   `positions_update` (≤50 ms) *si el bot se está moviendo*. Un bot en pausa de
   paseo sería invisible hasta que reanude. → el bucle de bots debe reemitir su
   posición cada ~1 s aunque esté quieto.

## E. Tabla de verdad: audio y mensajes por tipo de sala (jugadores reales)

Objetivo declarado: **en instancia de misión privada, audio y mensajes para toda
la room; en pública, solo mensajes y audio usuario a usuario.** Esto es lo que
hace el código hoy.

Primero, cómo se decide el tipo de sala ([hub_rooms.go:657](gather-rpg-backend/internal/websocket/hub_rooms.go#L657)).
Lo importante y poco evidente: **el modo de la misión pisa a la privacidad**. Un
mapa con `is_public = false` arranca como `"mission"`, pero si la escena tiene una
misión activa el `switch` lo sobrescribe:

| `is_public` | Modo de misión activa | Tipo final | Aforo |
|---|---|---|---|
| `true` | (ninguna) | `public` | `MaxUsers` del mapa (50 por defecto) |
| `false` | (ninguna) | `mission` | `MaxUsers` del mapa |
| cualquiera | `cooperative` | `cooperative` | 5 |
| cualquiera | `competitive` | `competitive` | 5 |
| cualquiera | `individual` | `solo` | 1 |

Y esto es lo que cada tipo tiene realmente:

| Tipo | Audio | Mensajes a toda la sala | Mensajes 1:1 |
|---|---|---|---|
| `public` | Proximidad: 800 px, ≤8 pares, volumen lineal | ❌ **no existe** | ✔ solo entre amigos |
| `mission` (PIN privado) | **Proximidad** — *no* grupal | ❌ no existe | ✔ solo entre amigos |
| `cooperative` | ✔ **Grupal** (full-mesh, volumen máximo) | ❌ no existe | ✔ solo entre amigos |
| `competitive` | **Proximidad** — *no* grupal | ❌ no existe | ✔ solo entre amigos |
| `solo` | N/A (1 jugador) | N/A | ✔ |

### Conclusión para "misión privada → audio y mensajes de sala"

- **Audio grupal: solo si la misión de esa escena es `cooperative`.** Una instancia
  privada por PIN cuyo mapa no tenga misión cooperativa usa **audio por
  proximidad**, igual que el lobby. Es el hueco descrito en el apartado C.
- **Mensajes de sala: no existen en ningún tipo de sala.** `handleChatMessage`
  ([hub_rooms.go:499](gather-rpg-backend/internal/websocket/hub_rooms.go#L499)) es un
  cuerpo vacío con el comentario `// ... (Existing logic)`. Comprobado que **no es
  una regresión de un merge**: el mismo hueco está en `hub.go.orig`, o sea que
  nunca llegó a escribirse. El frontend tampoco envía `chat_message` (solo lo hace
  un test).

### Conclusión para "pública → solo mensajes y audio usuario a usuario"

- **Audio: ya es exactamente eso** ✔ — proximidad pura, sin mallado de sala.
- **Mensajes: funcionan, con dos matices.** El primero, el candado de amistad del
  apartado A. El segundo, menos obvio: `handlePrivateMessage` **no comprueba ni
  sala ni distancia**. Los DM son globales — dos amigos en mapas distintos pueden
  escribirse. Si "usuario a usuario en pública" implicaba proximidad, hoy no lo es.

### El plano ya existe: las sesiones de challenge

Lo que falta para las salas privadas está **ya implementado y funcionando** para
los retos ([hub_challenges.go](gather-rpg-backend/internal/websocket/hub_challenges.go)):
full-mesh de voz al entrar, chat de grupo (`handleChallengeChatMessage`, 30 líneas),
aforo de 5, bloqueos respetados y desmontaje limpio al salir. Es el molde a copiar,
no hay que inventar nada.

### Cambios necesarios para llegar al objetivo — ✅ IMPLEMENTADOS

1. **`Room.IsGroupInstance()`** ([room.go](gather-rpg-backend/internal/websocket/room.go)) —
   un único predicado del que cuelgan los dos canales de grupo, para que voz y
   chat no puedan divergir. Es `Type == "cooperative" || !IsPublic`, con
   competitivo excluido a propósito: comparten mapa pero corren una carrera, no
   celebran una reunión.
   - Sustituye a las dos comparaciones contra `"cooperative"` sueltas
     (`handleJoinRoom` y `checkUserProximity`), así que **una instancia privada por
     PIN ya reparte voz en malla** en vez de por proximidad.
   - La señal es `IsPublic`, **no** el PIN: ver el bug del punto 4.
2. **Chat de sala** — `handleChatMessage` implementado calcado de
   `handleChallengeChatMessage`: valida sala, exige instancia de grupo, filtra
   bloqueados en ambas direcciones y difunde `chat_broadcast` con eco al emisor.
   En un mapa público responde con error: allí se habla 1:1.
   - Frontend: `chat_broadcast` **ya tiene listener** (`roomMessages` +
     burbuja sobre el sprite), acción `sendRoomMessage`, y panel
     [RoomChatPanel.jsx](gather-rpg-frontend/src/components/lobby/RoomChatPanel.jsx)
     que solo se monta en salas de grupo. Sin añadido optimista: el mensaje
     aparece con el eco del servidor, que es cuando de verdad se ha aceptado.
3. **Pública** — audio intacto (proximidad). El candado de amistad para los DM se
   mantiene tal cual.
4. **Bug de paso: una sala rehidratada perdía su PIN.** `handleJoinRoom` copiaba
   `MaxUsers`, `SceneKey` y `Type` de la fila de BD, pero **no `InviteCode` ni
   `IsPublic`**. Una sala privada recreada en memoria por esa vía (reinicio del
   backend, o un `join_room` directo tras vaciarse) se quedaba sin código, así que
   el emparejamiento por PIN ya no la encontraba y abría una instancia nueva
   dejando dentro a quien ya estaba. Ambos campos se rehidratan ahora.
5. **Bug de paso: el aviso de "aliado se ha unido" se lo mandaba también al que
   acababa de entrar** (te anunciaba a ti mismo). Pasaba desapercibido porque
   nadie pintaba `chat_broadcast`; al activar el chat de sala se habría visto.

**Tests**: [room_group_test.go](gather-rpg-backend/internal/websocket/room_group_test.go)
(tabla de tipos de sala, difusión con eco, rechazo en pública, filtrado de
bloqueados, mensajes en blanco) y
[roomChat.test.js](gather-rpg-frontend/src/tests/roomChat.test.js) (acumulación,
burbuja, avisos de sistema sin burbuja, bloqueados, envío sin duplicado).

## F. Otros hallazgos del paso (no bloquean, conviene saberlos)

- **`if len(room.Clients) >= dbRoom.MaxUsers`** en `handleJoinRoom`
  ([hub_rooms.go:63](gather-rpg-backend/internal/websocket/hub_rooms.go#L63)) es un
  **tercer** punto que necesita `HumanCount()`, además de los dos ya listados.
- **`chat_broadcast` es código muerto.** El servidor anuncia *"¡Un aliado se ha
  unido al combate!"* ([hub_rooms.go:141](gather-rpg-backend/internal/websocket/hub_rooms.go#L141))
  pero **ningún listener del frontend escucha ese evento**: el mensaje se emite y se
  tira. Si se quiere reaprovechar `chat_broadcast` para las burbujas ambientales de
  los bots (fase F3), hay que darle un handler en `gameStore`.
- **Doble disparo de burbuja**: `Sidebar.handleSendChat` y `gameStore.sendPrivateMessage`
  despachan los dos `chat-message-received` para el mismo mensaje. Inocuo hoy
  (`showChatBubble` destruye la burbuja anterior antes de crear la nueva), pero es
  trabajo duplicado y despista al leer el código.
- **Basura de un parche fallido en el repo**: `hub.go.orig` y `hub.go.rej` están
  **commiteados** en `internal/websocket/`. El `.rej` es el trozo que no aplicó
  (la firma de `NewHub` al añadir `LearningService`). Confunden las búsquedas —
  `handleChatMessage` aparece dos veces al hacer grep — y deberían borrarse.
