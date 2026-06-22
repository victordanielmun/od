# Plan de migración a Devvit (rama `reddit`)

## Arquitectura objetivo

```
┌─────────────────────────── Reddit / Devvit ───────────────────────────┐
│  Webview (React + Phaser)  ⇄ postMessage ⇄  Devvit server (Node/TS)    │
│                                              │                          │
│                                         Redis (datos)                   │
│                                         Realtime (multijugador)         │
│                                         Scheduler (tareas)              │
└──────────────────────────────────────────────┼────────────────────────┘
                                                 │ fetch (allowlist + secret)
                                                 ▼
                         Gateway externo de IA/Voz (se mantiene fuera)
                         · TTS (Piper)          · STT (Whisper)
                         · LLM (diálogo/traducción)
```

**Decisiones tomadas:**
- Backend de juego = **Devvit-nativo** (server Node + Redis). No se hospeda Go.
- Voz/IA = **servicio externo** consumido por `fetch` (TTS Piper, STT, LLM). No migra a Devvit.
- Identidad = **contexto de Reddit** (`context.userId`), se elimina el JWT propio.
- WhatsApp/Evolution = **descartado** (no aplica a una app de Reddit).
- TTS de los 12s (`edge-tts`) = **eliminado**; se usa Piper externo + pre-cache de vocabulario.

---

## Riesgos / verdades incómodas

1. **Combate en tiempo real (el mayor riesgo).** El hub WebSocket actual es autoritativo con un *tick loop* de IA (~tiempo real). Devvit es **serverless**: no hay proceso persistente que corra el tick a 60fps, y el Scheduler no tiene granularidad sub-segundo. → El combate NO se puede portar 1:1. Opciones a decidir en Fase 5.
2. **Redis ≠ SQL.** No hay joins ni queries complejas; hay que modelar con hashes/sets/sorted-sets y desnormalizar.
3. **`fetch` restringido.** Solo dominios en allowlist (`devvit.json`) y con permiso `http`; secretos vía Devvit Secrets.
4. **El gateway externo debe estar público y estable** (VPS/Cloud Run) con token de auth.

---

## Fase 0 — Andamiaje Devvit
- [ ] `devvit new` con plantilla **Devvit Web**; conectar a un subreddit de pruebas.
- [ ] `devvit.json`: permisos `redis`, `realtime`, `http` (allowlist del gateway), `media`.
- [ ] Configurar build del webview (Vite) y servirlo desde la app.
- [ ] Puente `postMessage` cliente ⇄ server Devvit (tipos de mensaje compartidos).
- [ ] `devvit playtest` funcionando con un "hola mundo" del webview.

## Fase 1 — Identidad y datos base (Redis)
- [ ] Reemplazar auth/JWT por `context.userId` + username de Reddit.
- [ ] Definir esquema de claves Redis y una capa de acceso (repos) tipada.
- [ ] Migrar `PlayerStats` → hash `user:{id}:stats`.
- [ ] Migrar `UserLearningProfile` → hash `user:{id}:learning`.
- [ ] Script de seed: cargar `LearningChallenge` a Redis (JSON + índices).
- [ ] Índices para retos: sets por `type`, `difficulty`, `tag` (intersección + `SRANDMEMBER`).

## Fase 2 — Plataforma de aprendizaje (núcleo, bajo riesgo)
- [ ] `GetRandomChallenge(type, difficulty, tag)` sobre sets Redis.
- [ ] `RecordAttempt`: registrar intento + XP (5/15) + level-up (500/1500).
- [ ] Leaderboard semanal → **sorted set** Redis (`ZADD`).
- [ ] Reset semanal del score → **Scheduler** (resuelve el bug pendiente del weekly).
- [ ] Endpoints de perfil; cablear el webview `/learn`.
- [ ] Conservar: categoría como filtro (tag) y dificultad prefijada por nivel.

## Fase 3 — Gateway externo de IA/Voz (`fetch`)
- [ ] Consolidar el servicio externo con API HTTP limpia: `/tts`, `/analyze`, `/llm`.
- [ ] Añadir token de auth al gateway; guardar como Devvit Secret.
- [ ] Allowlist del dominio en `devvit.json`.
- [ ] Proxy desde el server Devvit a los 3 endpoints.
- [ ] **Pre-generar y cachear** el audio del vocabulario finito (cero latencia, mata los 12s).
- [ ] STT: priorizar **Web Speech API** del navegador; gateway Whisper como fallback.

## Fase 4 — NPC / diálogo / misiones
- [ ] Migrar `Mission`/`Task`/`PlayerMissionProgress` a Redis.
- [ ] `NPCDefinition` a Redis (JSON).
- [ ] Diálogo NPC vía LLM del gateway externo.
- [ ] Caché de traducciones (i18n) en Redis (reemplaza `ChallengeTranslation`).

## Fase 5 — Multijugador / combate (alto riesgo — decisión aparte)
- [ ] **Decidir modelo:** (a) cliente-host autoritativo + Devvit **Realtime** para sync, o (b) combate como servicio externo (contradice "nativo").
- [ ] Ninja Card: la resolución es request/response (no tick) → portable al server Devvit.
- [ ] IA de enemigos (tick): evaluar viabilidad; probablemente cliente-host.
- [ ] Sync de salas/jugadores vía canales Realtime.

## Fase 6 — Pulido y publicación
- [ ] Playtest en subreddit, medir rendimiento.
- [ ] Manejo de errores/timeouts del gateway.
- [ ] Revisión y publicación en Devvit.

---

## Mapa de equivalencias

| Hoy (Go/Postgres) | Devvit-nativo |
|---|---|
| JWT + auth_service | `context.userId` (Reddit) |
| Postgres + GORM | Redis (hash/set/zset) |
| WebSocket hub (combate) | Devvit Realtime + cliente-host (Fase 5) |
| Scheduler WhatsApp | Devvit Scheduler (reset semanal, etc.) |
| Piper TTS local | Gateway externo `/tts` por fetch |
| Whisper STT | Web Speech API + gateway `/analyze` |
| Ollama/LLM | Gateway externo `/llm` por fetch |
| Evolution/WhatsApp | Descartado |
