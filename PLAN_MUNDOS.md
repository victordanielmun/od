# Plan de implementación — MUNDOS

> Agrupa misiones en mundos, con un **mapa final de combate que valida lo aprendido**.
> Complementa a [MISSION_FLOWS.md](MISSION_FLOWS.md) y [MISSION_MAP_REFACTOR_PLAN.md](MISSION_MAP_REFACTOR_PLAN.md).

## Estado

| Fase | Estado |
|---|---|
| 0 — SQL | ✅ archivo listo · ⏳ **falta ejecutarlo contra la BD** |
| 1 — Backend (modelos, repo, servicio, handlers, rutas, subida de PNG) | ✅ |
| 2 — Cards acotadas al mundo / al examen, sin repetición | ✅ |
| 3 — Mastery + diagnóstico por tema | ✅ backend · ⏳ falta la pantalla de resultado |
| 4 — `/admin/worlds` + PNG por mapa | ✅ |
| 5 — Traducciones de mundos | ✅ |
| 6 — Catálogo de mundos en el maestro | ✅ |

Backend compila y `go vet` limpio; 4 tests nuevos de sesión de examen en verde.
Frontend compila sin errores de lint nuevos.

## Decisiones aprobadas

| Tema | Decisión |
|---|---|
| Prerequisitos | **Ninguno.** Cualquier mundo y cualquier misión se juegan libres (mundo 3 antes que el 5). |
| Validación | El **mapa final** es el examen. Si no sabes, la card te penaliza y no puedes terminarlo. |
| Aprobar | **Matar al boss** (aparece en la última wave). Sin umbral de score aparte. |
| Tag de examen | `final_mision_1` — legible para humanos, guardado en `worlds.exam_tag` (nunca hardcodeado). |
| Cooperativo | **Aprendizaje en equipo**: la card del boss exige que todos acierten (comportamiento actual, sin cambios). |
| Jerarquía | `mundo → misión → mapa → tasks` |

**Lo que NO hay que construir**: el gate ya existe. Fallar una card cura al enemigo
([hub_combat.go:687-719](gather-rpg-backend/internal/websocket/hub_combat.go#L687-L719)) y fallar la del boss
lo cura según `CardFailHealPct`. El examen ya es funcional; lo que falta es **acotar el pool de preguntas**
y **dar el diagnóstico**.

---

## FASE 0 — SQL y ejecución

**Archivo**: [worlds_schema.sql](worlds_schema.sql) (ya creado, idempotente).

Crea `worlds`, `player_world_masteries`, `world_translations`; añade `world_id / is_final /
order_in_world / challenge_tags` a `missions` y `preview_image` a `map_configs`; siembra el mundo
de ejemplo `mundo_1` con `exam_tag = 'final_mision_1'`.

### Ejecución en EC2

Prod corre con `AUTO_MIGRATE=false`, así que GORM **no** creará estas tablas: hay que aplicar el DDL a mano.

```bash
# 1. Subir el archivo (od3.pem está en la raíz del repo)
scp -i od3.pem worlds_schema.sql ec2-user@3.14.9.51:/home/ec2-user/od/

# 2. Aplicar el esquema (una sola transacción, aborta al primer error)
ssh -i od3.pem ec2-user@3.14.9.51 \
  'docker exec -i gather_postgres psql -U postgres -d gather_rpg -v ON_ERROR_STOP=1 -1 < /home/ec2-user/od/worlds_schema.sql'

# 3. Verificar (queries comentadas al final del .sql)
ssh -i od3.pem ec2-user@3.14.9.51 \
  "docker exec gather_postgres psql -U postgres -d gather_rpg -c \"SELECT key, exam_tag, challenge_tags FROM worlds;\""
```

En local, el mismo archivo contra la BD de desarrollo.

**Criterio de aceptación**: las 3 queries de verificación del `.sql` corren sin error y
`SELECT count(*) FROM missions WHERE world_id IS NULL` devuelve el total actual (nada se rompió).

**Rollback**: `DROP TABLE player_world_masteries, world_translations, worlds CASCADE;` +
`ALTER TABLE missions DROP COLUMN world_id, DROP COLUMN is_final, DROP COLUMN order_in_world, DROP COLUMN challenge_tags;`

---

## FASE 1 — Backend: modelo y CRUD

### Archivos nuevos

| Archivo | Contenido |
|---|---|
| `internal/models/world.go` | `World`, `PlayerWorldMastery`, `WorldTranslation` |
| `internal/repository/world_repository.go` | CRUD + `GetWorldForMission`, `GetWorldBySceneKey` |
| `internal/services/world_service.go` | Lógica + resolución de pools de challenges |
| `internal/handlers/world_admin_handler.go` | CRUD admin |
| `internal/handlers/world_handler.go` | Catálogo para el jugador |

### Archivos a modificar

- [models/npc_mission.go](gather-rpg-backend/internal/models/npc_mission.go#L139) — `Mission` gana
  `WorldID *uint`, `IsFinal bool`, `OrderInWorld int`, `ChallengeTags pq.StringArray`.
- [cmd/server/main.go](gather-rpg-backend/cmd/server/main.go#L326) — rutas nuevas.
- `internal/handlers/info_art_handler.go` — generalizar a `ArtHandler` con `Dir` inyectable, y montar
  una segunda instancia para `uploads/worlds`. El patrón ya está resuelto (sanitizado de nombre,
  límite de 5MB, servido público sin auth); **no reinventar**.

### Rutas

```
# Admin
GET    /admin/worlds                 ListWorlds
POST   /admin/worlds                 CreateWorld
PUT    /admin/worlds/:id             UpdateWorld
DELETE /admin/worlds/:id             DeleteWorld           (world_id → NULL en sus misiones)
GET    /admin/worlds/:id/missions    MissionsOfWorld
PUT    /admin/worlds/:id/missions    SetWorldMissions      (vincular/desvincular en lote)
GET    /admin/worlds/:id/pool-health Diagnóstico del pool  (ver riesgo R3)
GET/POST/DELETE /admin/world-art     Subir/listar/borrar PNGs

# Jugador
GET    /worlds                       Catálogo + progreso + mastery
GET    /worlds/:id/missions          Misiones del mundo (mismo shape que /missions/npc/:id)
GET    /world-art/:file              PNG público (sin auth, para el <img>)
```

**Compatibilidad obligatoria**: las misiones con `world_id IS NULL` deben seguir apareciendo en un
bucket **"Misiones sueltas"**. Hoy todas las misiones existentes están así — si el catálogo solo
muestra mundos, desaparecen del juego.

---

## FASE 2 — Motor de cards acotado al mundo

El corazón del cambio. Hoy [getChallengeForClient](gather-rpg-backend/internal/websocket/hub_combat.go#L746)
pasa `tag = ""` y saca una pregunta random del catálogo entero.

### 2.1 Repositorio: pool multi-tag

[learning_repository.go:48](gather-rpg-backend/internal/repository/learning_repository.go#L48) usa
`? = ANY(tags)` — **un solo tag**. Añadir:

```go
GetRandomChallengeFromPool(types []string, difficulty string, tags []string, excludeIDs []uuid.UUID)
// WHERE tags && ?           (operador de solapamiento, varios tags)
//   AND id <> ALL(?)        (sin repetir dentro de la sesión)
```

### 2.2 Resolución por jugador

Cambiar la firma a `getChallengeForClient(client *Client, room *Room)` (los dos call sites,
[líneas 463](gather-rpg-backend/internal/websocket/hub_combat.go#L463) y
[534](gather-rpg-backend/internal/websocket/hub_combat.go#L534), ya tienen `room` a mano).

```
jugador + room.SceneKey
 → activeMissionProgresses()               [ya existe, mission_service.go:539]
 → ¿mission.IsFinal?  sí → world.ExamTag           ← EXAMEN
                      no → mission.ChallengeTags ?? world.ChallengeTags
 → excluir las ya preguntadas en esta sesión
 → ponderar hacia lo que este jugador falló antes (user_challenge_attempts)
 → fallbacks: escena → mundo único → comportamiento actual (random global)
```

Se resuelve **por jugador, no por sala**: en una sala pública dos jugadores pueden estar en misiones
distintas y la card es individual.

### 2.3 Sin repeticiones

Añadir a `Room` un `askedChallenges map[string][]uuid.UUID` (playerID → retos ya emitidos), limpiado
al salir de la sala. **Sin esto, un examen de 8 enemigos puede preguntar lo mismo 8 veces** — es el
fallo más visible si se lanza la fase 2 sola.

### 2.4 Fuga de tags al jugador

`final_mision_1` no tiene prefijo, así que aparecería como categoría en la práctica:
[PracticePage.jsx:69](gather-rpg-frontend/src/pages/PracticePage.jsx#L69) hace
`setCategories(['', ...data.tags])` desde `GetChallengeMetadata`, que hace `SELECT DISTINCT unnest(tags)`
([learning_repository.go:76](gather-rpg-backend/internal/repository/learning_repository.go#L76)).

Fix que **no depende del nombre del tag** (por eso `final_mision_1` funciona sin cambiar la convención):

```sql
AND tag NOT IN (SELECT exam_tag FROM worlds WHERE exam_tag <> '')
```

**Criterio de aceptación**: en el mapa final de `mundo_1`, 10 cards seguidas salen todas del pool
`final_mision_1` y ninguna se repite. En `/practice`, `final_mision_1` no aparece como categoría.

---

## FASE 3 — Mastery y diagnóstico

- Registrar cada respuesta del examen agrupada por tag temático de la pregunta.
- Al morir el boss del mapa final (hook en `processEnemyKill` con `isBoss=true` y
  `mission.IsFinal`): escribir `player_world_masteries` con `passed_at`, `last_score`, `best_score`,
  `weak_tags`. En coop lo reciben todos los del equipo (aprendizaje en equipo).
- Al salir del mapa sin matar al boss: `exam_attempts++` y `weak_tags` actualizado, `passed_at` sigue NULL.
- `GET /worlds/:id/mastery` → alimenta la pantalla de resultado.

**Pantalla de diagnóstico** (React, sobre el overlay de combate): *"Fallaste en `food` (2/5) y
`directions` (1/4)"* + botón **Repasar** que lleva a las misiones de ese mundo y a `/practice`
filtrado por esos tags. Ahí es donde las misiones sueltas cobran sentido sin ser obligatorias:
son el remedio recomendado, no el peaje.

---

## FASE 4 — Frontend: admin de mundos

### Ruta nueva

- `src/pages/admin/AdminWorlds.jsx`
- [App.jsx:125](gather-rpg-frontend/src/App.jsx#L125) — `<Route path="worlds" element={<AdminWorlds />} />`
- [AdminLayout.jsx:43](gather-rpg-frontend/src/layouts/AdminLayout.jsx#L43) — item de nav
  `{ path: '/admin/worlds', label: 'Mundos', icon: Globe }`, **encima** de Misiones.

### Contenido

**Lista**: grid de tarjetas con `cover_image`, nombre, dificultad, nº de misiones, y un semáforo de
salud del pool (verde/rojo según `pool-health`).

**Editor de mundo**: `key`, nombre, descripción, dificultad, orden, `challenge_tags` (chips con
autocompletado desde `/learning/challenges/metadata`), `exam_tag` (texto libre, ej. `final_mision_1`,
con contador en vivo "23 preguntas en este pool"), subida de `cover_image`.

**Vincular misiones**: dos paneles (disponibles ↔ del mundo), drag o botones, marcar **una** como
`is_final` (radio, no checkbox: el índice único del SQL solo permite una).

### PNG por mapa

En [AdminMapList.jsx](gather-rpg-frontend/src/pages/admin/AdminMapList.jsx): botón de subir imagen
por mapa → `POST /admin/world-art` → guarda el nombre en `map_configs.preview_image`. La tarjeta del
mapa muestra el preview en vez de un placeholder genérico.

---

## FASE 5 — Traducciones

`World.Name` y `DescriptionEn` son texto de cara al jugador → mismo patrón que
[MissionTranslation](gather-rpg-backend/internal/models/mission_translation.go): caché perezosa por
`(world_id, lang)` generada por LLM, inglés canónico nunca guardado ahí.

- `translation_service.go`: `GetWorldTranslation(w, lang)`, `InvalidateWorldTranslations(id)`,
  y sumar mundos a `WarmAllActiveMissions` (o un `WarmAllWorlds` llamado desde
  [main.go:177](gather-rpg-backend/cmd/server/main.go#L177)).
- Invalidar al editar un mundo en el admin (igual que hoy se hace al editar una misión).
- i18n del frontend: claves nuevas en `locales/{en,es}/translation.json` →
  `admin.nav.worlds`, `npc.dialogue.world_board`, `npc.dialogue.back_to_worlds`,
  `world.exam.passed`, `world.exam.review`, `world.loose_missions`.

**`exam_tag` y `key` NO se traducen** — son identificadores.

---

## FASE 6 — Diálogo del maestro de misiones

Hoy [NPCDialogue.jsx:971](gather-rpg-frontend/src/components/game/NPCDialogue.jsx#L971) muestra la lista
plana de misiones, y para un `quest_master` el backend devuelve **todas** las activas
([mission_handler.go:185](gather-rpg-backend/internal/handlers/mission_handler.go#L185)). Con 50+
misiones eso ya es inmanejable.

**Nuevo flujo de dos niveles:**

```
Maestro de misiones
 └─ Nivel 1: CATÁLOGO DE MUNDOS
      tarjetas con cover_image, nombre, dificultad,
      progreso ("3/7 misiones") y sello APROBADO si passed_at
      + tarjeta "Misiones sueltas" (world_id IS NULL)
 └─ Nivel 2: MISIONES DEL MUNDO  (← botón Volver)
      tarjetas con el PNG del mapa (map_configs.preview_image),
      badge de dificultad, estado, y la final marcada como ⚔️ EXAMEN FINAL
      → seleccionar = flujo actual intacto (acepta o teletransporta)
```

### Cambios concretos

- `GetMissionsByNPC` devuelve además `worlds: [...]` (id, nombre, imagen, nº misiones, mastery).
- `NPCDialogue.jsx`: estado nuevo `selectedWorldId`; el bloque de misiones se envuelve en el nivel 2.
- **No tocar** `handleSelectMission` ([línea 348](gather-rpg-frontend/src/components/game/NPCDialogue.jsx#L348)):
  el aceptar/teletransportar/premium-gate se queda igual.
- El auto-select de misión única ([línea 312](gather-rpg-frontend/src/components/game/NPCDialogue.jsx#L312))
  solo aplica a NPCs que no son board — no se ve afectado.

---

## Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Las misiones actuales tienen `world_id NULL` y desaparecerían del maestro | Bucket "Misiones sueltas" — **bloqueante para la fase 6** |
| R2 | Preguntas repetidas dentro del mismo examen | Fase 2.3, `askedChallenges` por sala |
| R3 | `exam_tag` sin preguntas → el examen cae al random global **en silencio** | Endpoint `pool-health` + semáforo en el admin + log de warning explícito |
| R4 | `final_mision_1` visible al jugador en `/practice` | Fase 2.4, filtro por subquery a `worlds.exam_tag` |
| R5 | XP farmeable: `RecordAttempt` da +5/+15 siempre; reintentar el mapa final farmea XP | Decidir: excepción para intentos de examen, o dejarlo (es XP menor) |
| R6 | `AUTO_MIGRATE=false` en prod | Fase 0, DDL manual — no olvidar antes de desplegar el binario |
| R7 | Un jugador entra al mapa final sin aceptar la misión final | Cadena de fallbacks de la fase 2.2 resuelve el mundo por `scene_key` |

## Orden de ejecución

`0 → 1 → 2 → 4` da un sistema **jugable y administrable**.
`3` (diagnóstico), `5` (traducciones) y `6` (diálogo) se pueden hacer después, pero **6 depende de R1**.

## Fuera de alcance

- Ranking/leaderboard por mundo.
- Reordenar misiones dentro del mundo con drag (basta un campo numérico `order_in_world`).
- Modo competitivo del examen (sigue sin backend, ver MISSION_FLOWS.md).
