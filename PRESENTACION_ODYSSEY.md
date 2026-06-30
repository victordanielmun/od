# 🏰 Odyssey — Aprende inglés jugando un RPG

> Documento de presentación del proyecto **Odyssey** (*Gather RPG + English Learning Platform*).
> Plataforma que fusiona un RPG multijugador top-down con un sistema de práctica de pronunciación
> e interacción en inglés impulsado por IA.

---

## 1. Presentación del equipo

| Rol | Integrante | Responsabilidad principal |
|---|---|---|
| 🎯 Líder de proyecto / Backend de juego | _(completar)_ | API en Go, WebSockets, lógica de misiones y combate |
| 🎮 Frontend / Game | _(completar)_ | Cliente React + Phaser, UI, estado del juego |
| 🗣️ IA y Voz | _(completar)_ | Backend Python (FastAPI), STT/TTS, scoring de pronunciación |
| 🗄️ Datos / Infraestructura | _(completar)_ | PostgreSQL, Redis, Docker, despliegue EC2 |
| 📐 Diseño de contenido / Misiones | _(completar)_ | NPCs, retos de aprendizaje, balance de misiones |

> **Nota:** sustituir los `_(completar)_` por los nombres reales y apellidos del equipo antes de presentar.
> Repositorio mantenido por `victordanielmun`.

---

## 2. Explicación del problema identificado

Aprender un idioma —especialmente la **pronunciación** y la **conversación**— sufre de tres
barreras conocidas:

1. **Falta de motivación y constancia.** Las apps tradicionales de idiomas son repetitivas y
   abandonan al usuario en ejercicios aislados sin contexto ni recompensa emocional.
2. **Miedo a hablar.** Practicar pronunciación frente a otra persona genera ansiedad; falta un
   entorno seguro donde equivocarse no tenga coste social.
3. **Aprendizaje descontextualizado.** Memorizar vocabulario fuera de una situación real no se
   transfiere al uso práctico del idioma.

**Conclusión del problema:** se necesita un entorno donde practicar inglés sea una consecuencia
natural de **jugar**, con retroalimentación inmediata, contexto narrativo y progreso medible.

---

## 3. Presentación de la solución tecnológica propuesta

**Odyssey** convierte la práctica del inglés en la mecánica central de un RPG multijugador:

- El jugador **camina por un mundo** (mapa top-down estilo *Gather*) y se encuentra con **NPCs**.
- Para **avanzar en las misiones** debe **conversar, pronunciar frases y completar retos** en inglés.
- La **pronunciación se evalúa con IA** (STT + scoring fonético) y abre o bloquea el progreso.
- El aprendizaje se integra al **combate, los ítems y los diálogos**, dándole un propósito jugable.
- Un **leaderboard** y un sistema de **XP / niveles** mantienen la motivación a largo plazo.

### Arquitectura (estado actual)

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  Frontend (Vite + React + Phaser + Zustand + i18next)              │
└───────────────┬───────────────────────────────┬───────────────────┘
                │ HTTP / WebSocket               │ HTTP (audio / IA)
                ▼                                 ▼
   Backend de juego (Go / Fiber)        Backend de voz (Python / FastAPI)
   · Auth JWT                           · STT (Whisper)
   · Hub WebSocket (mapa + combate)     · Scoring de pronunciación
   · Misiones, NPCs, inventario         · TTS · LLM (diálogo / traducción)
                │                                 │
                └──────────────┬──────────────────┘
                               ▼
                  PostgreSQL (datos)  +  Redis (estado / caché)
```

Las cuatro piezas corren en puertos separados: **PostgreSQL (5433) + Redis (6379)**,
**Go API (3000)**, **Voice/FastAPI (8000)** y **Frontend Vite (5173)**, compartiendo una sola
base de datos para integrar el progreso de juego con el perfil de inglés.

---

## 4. Ciclo de vida del proyecto — fase por fase

### Fase 0 — Estabilización del núcleo
- Eliminación de panics por `progress` nil en el hub de NPCs.
- Corrección de la **entrega de recompensas** (antes se entregaba triplicada → ahora idempotente).
- El progreso ya **no se autocrea** al mirar la lista de misiones (se acabó el "conteo fantasma").

### Fase 1 — Progreso explícito y por instancia
- Progreso aislado por la tupla `(jugador, misión, roomID)`.
- Conteo real de kills con `RequiredKills` acotado a la instancia aceptada.
- Recolección de ítems que respeta **cantidades** (`RequiredQuantity`) y las consume.

### Fase 2 — Modos de juego (en curso)
- Ruteo de instancias según `mission.mode`: **individual / cooperativo / competitivo**.
- Progreso compartido en coop y scoreboard/ganador en competitivo.

### Fase 3 — Plataforma de aprendizaje y validación en servidor
- Reto de pronunciación con umbral (`PronunciationMinScore`) validado en el backend.
- Retos por tipo, dificultad y categoría; XP, niveles y leaderboard semanal.

### Fase 4 — NPC, diálogo y misiones con IA
- Diálogo de NPCs vía LLM; misiones de "entregar mensaje" y "hablar con NPC".
- **i18n**: ayuda nativa traducida y cacheada por idioma vía LLM (no hardcodeada).

### Fase 5 — Migración a Devvit / Reddit (rama `reddit`, planificada)
- Backend de juego **Devvit-nativo** (Node + Redis); identidad por contexto de Reddit.
- Voz/IA como **servicio externo** consumido por `fetch` (TTS Piper, STT, LLM).
- **Riesgo principal identificado:** el combate en tiempo real no se porta 1:1 a un entorno
  serverless → decisión entre *cliente-host + Devvit Realtime* o combate externo.

### Fase 6 — Pulido, despliegue y publicación
- Despliegue documentado en **AWS EC2** (`EC2_DEPLOYMENT.md`).
- Manejo de errores/timeouts, playtest y publicación.

---

## 5. Evidencias del desarrollo del prototipo

El prototipo es **funcional y ejecutable localmente** hoy:

- ✅ **Mundo jugable**: login (incl. invitado), lobby, movimiento de personaje y editor de mapas.
- ✅ **Misiones operativas** por tipo: derrotar enemigo, eliminar jefe, eliminar a todos,
  buscar/recolectar ítems, diálogo con NPC, entregar mensaje y desafío de pronunciación
  (ver detalle en [MISSION_FLOWS.md](MISSION_FLOWS.md)).
- ✅ **Multijugador en mapa** vía WebSockets y **combate** con sistema de *Ninja Card*.
- ✅ **Práctica de inglés** integrada: módulo `/learn` y NPCs con retos de pronunciación.
- ✅ **Internacionalización** con ayuda nativa traducida por LLM y cacheada.
- ✅ **Base de datos versionada** con esquema y *seeds* (`gather_rpg.sql`,
  `npc_mission_schema_v2.sql`, `seed_data.sql`).
- ✅ **Documentación técnica** extensa: planes de refactor, flujos de misión, despliegue y migración.
- 📈 **Medición de latencia** del pipeline de voz (`benchmark_latency.py`).

**Cómo ejecutarlo:** ver el [README.md](README.md) — levantar Docker (Postgres + Redis),
backend Go (`server.exe`), backend de voz (FastAPI/uvicorn) y frontend (`npm run dev`),
o usar el script `start-all.ps1`.

---

## 6. Herramientas utilizadas

| Capa | Tecnologías |
|---|---|
| **Frontend** | React 18, Vite 5, **Phaser 3** (motor de juego), Zustand (estado), TailwindCSS, **i18next / react-i18next**, Axios, wavesurfer.js (audio), simple-peer (WebRTC), chess.js |
| **Backend de juego** | **Go 1.24**, Fiber v2, WebSockets (gofiber/contrib), GORM, JWT, Prometheus (métricas) |
| **Backend de voz / IA** | **Python**, FastAPI, Uvicorn, SQLAlchemy + Alembic, **Whisper (STT)**, gTTS / Piper (TTS), LLM (Ollama / Claude), metaphone (fonética), passlib/jose |
| **Datos** | **PostgreSQL**, **Redis**, Docker / Docker Compose |
| **Calidad / Testing** | Vitest, Testing Library, ESLint, Go testing (testify) |
| **Infraestructura / Despliegue** | AWS **EC2**, PowerShell scripts, plan de migración a **Devvit (Reddit)** |
| **Control de versiones** | Git / GitHub |

---

## 7. Resultados obtenidos

- 🎮 **Prototipo jugable end-to-end**: un usuario puede entrar, moverse, aceptar misiones,
  combatir, recoger ítems y practicar pronunciación recibiendo *feedback* de IA.
- 🔧 **Núcleo de misiones estabilizado**: corregidos los bugs críticos de recompensas
  triplicadas, conteo fantasma y panics — el ciclo *aceptar → objetivo → recompensa* es
  idempotente y aislado por instancia.
- 🗣️ **Integración real de IA de voz**: pipeline STT → scoring → desbloqueo de progreso,
  con latencia medida y optimizada (eliminación del TTS lento de ~12s vía pre-caché).
- 🌍 **Soporte multi-idioma** para la ayuda al jugador mediante traducción LLM cacheada.
- 🏗️ **Arquitectura escalable y documentada**, con un plan formal de migración a Devvit/Reddit
  para llegar a una base de usuarios masiva.

---

## 8. Conclusiones y lecciones aprendidas

- **El juego como vehículo de aprendizaje funciona**: dar contexto y recompensa a la práctica
  de pronunciación reduce la barrera de "miedo a hablar" y aumenta la constancia.
- **El tiempo real es el mayor reto técnico**: el combate autoritativo por WebSocket es lo más
  difícil de portar a entornos serverless (Devvit) — conviene aislar la lógica en *request/response*
  siempre que se pueda (como la *Ninja Card*).
- **La validación debe vivir en el servidor**: confiar en flags de la IA del cliente para
  completar tareas (pronunciación, entrega de mensajes) es frágil; la lógica de aprobación debe
  reforzarse en el backend.
- **Separar voz/IA del core del juego** dio flexibilidad: permite cambiar de proveedor (Whisper,
  Piper, LLM) sin tocar la lógica del juego.
- **Documentar las "verdades incómodas"** (riesgos, deuda técnica, lo que falta) acelera la toma
  de decisiones y evita reescrituras — ver `MIGRATION_DEVVIT.md` y `MISSION_FLOWS.md`.
- **Desnormalizar para Redis**: la migración obliga a repensar el modelo SQL hacia
  hashes/sets/sorted-sets, una lección clave de diseño de datos.

---

## 9. Participación de los integrantes

> Completar con la contribución concreta de cada persona (commits, módulos, decisiones).

| Integrante | Aportes principales | Evidencia |
|---|---|---|
| _(nombre)_ | Backend de juego (Go), misiones, combate, WebSockets | commits / archivos en `gather-rpg-backend/` |
| _(nombre)_ | Frontend (React + Phaser), UI, i18n | commits / archivos en `gather-rpg-frontend/` |
| _(nombre)_ | Backend de voz/IA (Python), STT/TTS, scoring | commits / archivos en `voice/` |
| _(nombre)_ | Datos, Docker, despliegue EC2, migración Devvit | `gather_rpg.sql`, `EC2_DEPLOYMENT.md`, `MIGRATION_DEVVIT.md` |
| _(nombre)_ | Diseño de misiones y contenido de aprendizaje | `MISSION_FLOWS.md`, seeds de NPCs/retos |

> **Sugerencia de evidencia objetiva:** generar el reparto real con
> `git shortlog -sne` (commits por autor) y adjuntarlo como anexo.

---

### Anexos / documentación de referencia
- [README.md](README.md) — guía de instalación y ejecución.
- [MISSION_FLOWS.md](MISSION_FLOWS.md) — flujos de cada tipo de misión y estado.
- [MISSION_MAP_REFACTOR_PLAN.md](MISSION_MAP_REFACTOR_PLAN.md) — plan de refactor de misiones/mapa.
- [MIGRATION_DEVVIT.md](MIGRATION_DEVVIT.md) — plan de migración a Devvit/Reddit.
- [EC2_DEPLOYMENT.md](EC2_DEPLOYMENT.md) — despliegue en AWS EC2.
</content>
</invoke>
