# Plan de migración a Devvit — Hackathon "Reddit's Games with a Hook"

> Rama `reddit`. Deadline de envío: **15 jul 2026, 6:00 PM PT**. Hoy: 3 jul → ~12 días.
> Decisiones tomadas por el usuario en esta iteración:
> 1. **Todo texto.** Sin generación de audio, sin STT, sin TTS, sin pronunciación. El usuario interactúa por texto; el aprendizaje de inglés es por texto.
> 2. **OpenAI directo** desde el server Devvit por `fetch` (sin gateway externo/VPS).
> 3. **Migrar la base de datos** Postgres → Redis (Devvit).
> 4. **Portar el tiempo real** al entorno Devvit (Realtime).

---

## 1. Arquitectura objetivo (simplificada)

```
┌──────────────────────────── Reddit / Devvit ─────────────────────────────┐
│  Webview (React + Phaser)  ⇄ postMessage/fetch ⇄  Devvit server (Node/TS) │
│                                                    │                       │
│                                               Redis (todos los datos)      │
│                                               Realtime (multijugador)      │
│                                               Scheduler (reset semanal)    │
│                                               context.userId (identidad)   │
└────────────────────────────────────────────────────┼──────────────────────┘
                                                       │ fetch (allowlist + secret)
                                                       ▼
                                              api.openai.com  (LLM directo)
```

**Ya NO hay gateway externo ni VPS.** El único destino de `fetch` es `api.openai.com`, con la API key en Devvit Secrets. Esto elimina la pieza de infraestructura más frágil del plan anterior.

---

## 2. Lo que se ELIMINA por "todo texto" (gran simplificación)

Estos módulos NO se migran; se borran del alcance:

| Se elimina | Motivo |
|---|---|
| `voice/backend` (Python/FastAPI, Whisper, Piper) | Sin STT/TTS |
| Rutas `/tts/*`, `tts_handler`, `tts_service` | Sin audio |
| `hub_webrtc.go`, WebRTC, voz por proximidad | Sin voz |
| Análisis de pronunciación, `pronunciation_*` | Aprendizaje por texto |
| Karaoke (`/missions/karaoke/*`) | Sin audio |
| WhatsApp entero (`whatsapp_*`, Evolution) | No aplica a Reddit |
| Billing Wompi (`/billing/*`, `subscriptions`) | Reddit tiene sus propios pagos; se difiere |
| Piper models/voces (~cientos de MB) | Sin TTS |

**Consecuencia clave:** el diálogo con NPC pasa de "voz→STT→LLM→TTS" a **texto→LLM→texto**. Los retos de pronunciación (`ChallengeTypePronunciation`, `listening`) se convierten en retos de **texto** (vocabulary/grammar de opción múltiple, que ya existen).

---

## 3. Verdades incómodas / riesgos (ordenados por gravedad)

1. **Tiempo real de combate (el mayor riesgo).** El hub actual (`internal/websocket`, ~4.900 LOC) es un servidor autoritativo con *tick loop* de IA de enemigos. Devvit es **serverless**: no hay proceso persistente a 60fps ni Scheduler sub-segundo. → El combate con IA de enemigos **no se porta 1:1**. Ver §6, decisión obligada.
2. **Peso de assets: 84 MB de PNGs** (NPCs de 3.8MB c/u). Devvit tiene límites de bundle. **Hay que comprimir (PNG→WebP + atlas) antes de empaquetar.** Riesgo alto e independiente del código.
3. **Redis ≠ SQL.** Sin joins ni queries; modelar con hash/set/zset y desnormalizar. Trabajo mecánico pero extenso (30+ tablas).
4. **Timeline.** Port completo solo en 12 días no es realista. **Hay que escoger alcance MVP** (§4).
5. **`fetch` de Devvit** es request/response con timeout de segundos: sirve para LLM (diálogo/retos), no para streaming largo.

---

## 4. Decisión de alcance para el hackathon (MVP recomendado)

Los jueces puntúan: **UX deleitable · Polish · Reddity · Hook · (Phaser)**. NO puntúan "portaste todo tu backend". El movimiento ganador es un **slice pulido, social y con retención**, no el port total.

**MVP recomendado (IN):**
- Lobby social multijugador (presencia + movimiento por Realtime).
- Chat de texto entre jugadores.
- Aprendizaje de inglés por **texto** (retos de opción múltiple) con **leaderboard semanal** (retención = "hook").
- Diálogo con NPC por texto vía OpenAI (misiones simples tipo "habla con X / responde en inglés").
- i18n cualquier idioma→inglés (ya está en el backend Go; se reimplementa en Redis).
- Identidad Reddit + racha diaria/streak (retención).

**Fuera del MVP (defer / stretch):**
- Combate en tiempo real con IA de enemigos (§6). Si entra, versión **por turnos/carta** (request-response), no tick.
- Tienda, inventario complejo, crafting.
- Sistema de amigos (Reddit ya da identidad social).

> Este MVP cubre 4 de los 5 criterios directamente y encaja con los sub-retos **Retención** ($3k) y potencialmente **Phaser** ($5k).

---

## 5. Mapa de datos: Postgres → Redis

Claves propuestas (namespace por entidad; JSON en strings, índices en sets/zsets):

| Entidad (GORM) | Clave Redis | Tipo |
|---|---|---|
| `User` (identidad) | `context.userId` de Reddit; perfil en `user:{id}` | hash |
| `PlayerStats` | `user:{id}:stats` | hash |
| `UserLearningProfile` | `user:{id}:learning` | hash |
| `LearningChallenge` | `challenge:{id}` + índices `chal:type:{t}` `chal:diff:{d}` `chal:tag:{t}` | string + sets |
| `ChallengeTranslation` | `tr:challenge:{id}:{lang}` | string |
| `UserChallengeAttempt` | `user:{id}:attempts` (lista/stream) | list |
| Leaderboard semanal | `lb:weekly` | **zset** (`ZADD`) |
| `Mission` / `MissionTask` | `mission:{id}` (JSON con tasks embebidos) + `mission:scene:{key}` | string + set |
| `MissionTranslation`/`TaskTranslation` | `tr:mission:{id}:{lang}` / `tr:task:{id}:{lang}` | string |
| `PlayerMissionProgress` | `progress:{userId}:{missionId}` | hash |
| `NPCDefinition`/`NPCTemplate` | `npcdef:{id}` / `npctmpl:scene:{key}` | string + set |
| `NPCDialogueCache` | `dlgcache:{hash}` (con lang en la clave) | string + TTL |
| `MapConfig` | `map:{sceneKey}` | string |
| `Item`/`Inventory` | `item:{id}` / `user:{id}:inv` (itemId→qty) | string + hash |
| Presencia de sala | `room:{id}:presence` | set + Realtime |
| `UserBlock` | `user:{id}:blocks` | set |

Se **descartan**: `WhatsApp*`, `Subscription`, `PlayerNPCGift` (opcional), tablas de voz.

---

## 6. Tiempo real / combate — decisión obligada (Fase 5)

El `Ninja Card` (resolución de kills) ya es **request/response** → portable directo al server Devvit. Lo que NO es portable es el **tick de IA/movimiento de enemigos**. Opciones:

- **(A) Cliente-host autoritativo + Devvit Realtime** *(recomendado si el combate entra al MVP)*: un cliente corre la IA de enemigos y difunde estado por un canal Realtime; los demás renderizan. Movimiento de jugadores = client-authoritative por Realtime.
- **(B) Combate por turnos/carta**: se elimina el tick; el combate es una secuencia request-response contra el server Devvit. Más simple, más robusto, menos "acción".
- **(C) Diferir combate** del MVP y centrar el hook en aprendizaje social + leaderboard.

> Recomendación para 12 días: **(C) o (B)**. Dejar el combate en tiempo real para post-hackathon.

---

## 7. Plan por fases (con checkboxes)

### Fase 0 — Andamiaje Devvit
- [ ] `devvit new` (plantilla **Devvit Web**); conectar a subreddit de pruebas.
- [ ] `devvit.json`: permisos `redis`, `realtime`, `http` (allowlist `api.openai.com`), `media`.
- [ ] OpenAI API key → **Devvit Secret**.
- [ ] Build del webview (Vite) servido por la app; puente cliente⇄server tipado.
- [ ] `devvit playtest` con "hola mundo" del webview.

### Fase 0.5 — Assets (riesgo independiente, hacer YA)
- [ ] Comprimir 84MB → WebP + atlas; medir que entra en el bundle de Devvit.

### Fase 1 — Identidad + datos base (Redis) ✅
- [x] Reemplazar auth/JWT por `context.userId` + username de Reddit. → `core/identity.ts`
- [x] Capa de repos Redis tipada (get/set JSON + índices). → `core/redis.ts` (único punto con llamadas crudas)
- [x] `PlayerStats` y `UserLearningProfile` en Redis. → `repos/userRepo.ts` (hashes con incrementos atómicos)
- [x] Seed de `LearningChallenge` a Redis + índices (type/difficulty/tag). → `seed/` (idempotente)

### Fase 2 — Aprendizaje por texto (núcleo, bajo riesgo, alto valor)
- [x] `GetRandomChallenge(type, difficulty, tag)` sobre índices Redis (intersección en memoria).
- [x] `RecordAttempt` + XP (5/15) + level-up (500/1500). No filtra la respuesta correcta al cliente.
- [x] **Leaderboard semanal** = zset (write+read+top-N); **reset semanal por Scheduler** pendiente (rollover lazy ya hecho).
- [x] **Streak diario** (retención) dentro de `recordAttempt`.
- [x] Endpoints: `/api/challenge/random`, `/api/attempt`, `/api/leaderboard`, `/api/me`, `/api/me/native-language`, `/api/admin/seed`.
- [x] Webview del loop de aprendizaje (`src/client`): reto + helper nativo + opciones + resultado/XP/level-up + leaderboard + selector de idioma. Vanilla TS/DOM, tema RPG. Consume `/api/*`.
- [ ] Reset semanal vía Devvit Scheduler.

### Fase 3 — OpenAI directo (texto) ✅
- [x] Cliente OpenAI en el server Devvit (`fetch` a `api.openai.com`, key en Devvit Secrets). → `services/openai.ts`
- [x] Diálogo NPC texto→texto, parametrizado por idioma nativo (JSON: response + native + state + task_completed + feedback). → `services/dialogueService.ts`, ruta `/api/npc/dialogue`
- [x] i18n: traductor real de challenges (`services/translators.ts`) enchufado; caché en Redis (`tr:*`) lazy + reuse; ES backfill gratis.
- [x] Secreto declarado en `devvit.json` (`openai-api-key`, `openai-model`).

### Fase 4 — NPC / misiones (texto) ✅
- [x] `Mission`/`Task`/`Progress` en Redis (tasks embebidos; progreso por (user,mission)). → `repos/missionRepo.ts`
- [x] `NPCDefinition` en Redis + índice por escena. → `repos/npcRepo.ts`
- [x] Traductores de misión/tarea + caché (`tr:mission:*`, `tr:task:*`). Targets de aprendizaje (`targetPhraseEn`) NO se traducen.
- [x] Misión-servicio: `getMissionsForScene` (nativo + inglés + progreso), `accept`. → `services/missionService.ts`
- [x] Diálogo consciente de misión: `talkToNpc` carga NPC + tarea activa de Redis; completa tareas talk/deliver al lograrlas. Condiciones de item/enemigo → Fase 5.
- [x] Seed de contenido: NPC "Elder Maro" + misión "First Words". Rutas `/api/missions/*`, `/api/npc/talk`, `/api/npc/scene`.
- [x] Cliente "Quests": log de misiones (objetivo + tareas localizadas + aceptar) + **diálogo NPC por texto** (`src/client/questView.ts`); tareas talk/deliver se completan conversando y refrescan el log.

### Fase 5 — Multijugador / combate (backend ✅; tick de enemigos = cliente)
- [x] **Modelo decidido: (A)** cliente-host + Realtime. Movimiento e IA de enemigos los difunde el cliente; el server difunde presencia/chat/muertes.
- [x] Contrato Realtime compartido (`shared/realtime.ts`) + `broadcast` server (`core/realtime.ts`).
- [x] **Presencia** por heartbeat en Redis con TTL → `repos/presenceRepo.ts`, `services/roomService.ts` (join/ping/leave + chat con backlog).
- [x] **Ninja Card = aprendizaje**: `resolveNinjaCard` califica reto de inglés; acierto → mata enemigo + XP + avanza tasks de kills (`recordKill` ≈ `processEnemyKill`) + broadcast. Rutas `/api/room/*`, `/api/combat/ninja-card`.
- [x] Cliente "Tavern": presencia en vivo + chat por `connectRealtime` (`src/client/roomView.ts`, `realtime.ts`). Valida la capa Realtime de punta a punta.
- [x] Cliente Phaser (`src/client/game/GameScene.ts`, `worldView.ts`): escena con placeholders (círculos), movimiento local, jugadores remotos interpolados, host electo (menor userId) que tickea IA de enemigos, y **combate Ninja Card** (modal de reto de inglés → `/api/combat/ninja-card` → muerte del enemigo). Pestaña "World".
- [x] Relay de movimiento/enemigos por el server (los clientes Devvit no publican directo en el canal): `/api/room/move`, `/api/room/enemies` (throttled). Interpolación en cliente.
- [ ] **Validar en `devvit playtest`** (input/netcode/timing no se pueden verificar solo con typecheck).
- [ ] Reemplazar placeholders por sprites reales (assets comprimidos).
- [ ] Filtrado de bloqueados (`UserBlock`) en posiciones/chat (refinamiento).

**Nota de build:** el cliente y el server necesitan condiciones de resolución distintas (`browser` vs `default`), así que hay **tsconfigs separados** (`tsconfig.server.json` / `tsconfig.client.json`) — sin eso, `connectRealtime` no resuelve.

### Fase 6 — Pulido y publicación
- [ ] Playtest en subreddit; medir rendimiento y límites de Redis/Realtime.
- [ ] Manejo de timeouts de OpenAI.
- [ ] README de gameplay + post demo público. Publicar en Devvit.

---

## 8. Mapa de equivalencias

| Hoy (Go/Postgres/VPS) | Devvit-nativo |
|---|---|
| JWT + `auth_service` | `context.userId` (Reddit) |
| Postgres + GORM | Redis (hash/set/zset) |
| WebSocket hub (combate tick) | Realtime + cliente-host / por turnos (§6) |
| `translation_service` (LLM) | Igual, pero `fetch` a OpenAI + Redis |
| Piper TTS / Whisper STT / pronunciación | **Eliminado (texto)** |
| Scheduler manual (renovaciones) | Devvit Scheduler (reset semanal, streak) |
| Ollama/LLM propio | **OpenAI directo** por fetch |
| Evolution/WhatsApp, Wompi | **Descartado** |
```

---

## 9. Primer paso concreto

Fase 0 + Fase 0.5 en paralelo: montar el andamiaje `devvit new` **y** medir la compresión de assets. Si los 84MB no entran ni comprimidos, eso redefine todo antes de escribir lógica. Los dos son "hechos duros" que conviene resolver el día 1.
