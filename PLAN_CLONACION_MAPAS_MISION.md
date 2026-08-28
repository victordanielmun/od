# Plan — Clonar mapas-misión por etapas, mundo al final

> Runbook para crear los mapas-misión de un mundo nuevo reutilizando el
> contenido de mapas ya existentes (patrón `the_village` / `the_village_2` /
> `clock_tower`, ver [MISIONES_MUNDO_PUEBLO.md](MISIONES_MUNDO_PUEBLO.md)).
> Complementa a [PLAN_MUNDOS.md](PLAN_MUNDOS.md) (arquitectura de mundos) y
> [worlds_schema.sql](worlds_schema.sql) (DDL de `worlds`).
>
> **Implementación real usada (no SQL directo)**: en la práctica se ejecutó
> por HTTP contra la API admin real (`https://api.odisea-rpg.com`) en vez de
> SQL crudo contra Postgres — evita el problema de caché de
> `map_configs` (ver Etapa 1) y la validación la hace el propio backend. Los
> scripts de referencia (Mundo 2: Pronombres, ya usado como piloto) viven en
> [scripts/world-builder/](scripts/world-builder/), orquestados por
> [scripts/mundo2-pronombres.ps1](scripts/mundo2-pronombres.ps1)
> (`-Step build|validate|publish`). Sirven de plantilla para el próximo
> mundo: copiar y adaptar `scene_key`s, contenido de NPCs y challenges.

## Principio del plan

**Construir cada mapa-misión de forma aislada y verificable, y recién al
final —cuando TODOS los mapas del mundo nuevo estén completos y probados—
hacer la asignación a `world_id` y a `learning_challenges`.**

Por qué en ese orden y no al revés:

- `missions.world_id` acepta `NULL` (`ON DELETE SET NULL`) — una misión sin
  mundo sigue siendo válida, aparece en el bucket "misiones sueltas". No hay
  ninguna razón técnica para asignar el mundo antes de tener el contenido
  listo.
- Manteniendo `missions.status = 'draft'` mientras se construye, la misión
  es invisible para los jugadores (`mission_repository.go:130`,
  `mission_handler.go:220/314/474` filtran por `status = 'active'`) — se
  puede iterar sin exponer nada a medio hacer.
- El único paso que "publica" de verdad el mundo completo es al final:
  crear `worlds`, hacer `UPDATE missions SET world_id=…, status='active'`
  en bloque, y etiquetar `learning_challenges`. Es un solo punto de
  reversión (basta con `UPDATE missions SET world_id=NULL` +
  `DELETE FROM worlds WHERE key=…` si algo sale mal), en vez de tener el
  riesgo repartido en cada mapa.

## Hallazgo en producción (2026-08-21): ya existen piezas de combate/boss

Antes de diseñar las etapas de combate, consulté la DB real. World 1
(`mundo_1` — "The Town") no son solo las 3 misiones de diálogo que ya
documentamos — tiene **6 misiones en total**, y dos quedaron a medias:

| id | scene_key | título | type | world_id | is_final | status |
|---|---|---|---|---|---|---|
| 1 | the_village | Aprende a saludar | talk_to_npc | 1 | false | active |
| 3 | the_village_2 | Aprende a saludar 2 | talk_to_npc | 1 | false | active |
| 4 | clock_tower | Aprende sobre la Hora | talk_to_npc | 1 | false | active |
| 5 | combate_town_1 | Los ogros atacan el pueblo | kill_all | **1** | false | active |
| 6 | combate_town_2 | Los ogros atacan a ben | kill_all | **NULL** ⚠️ | false | active |
| 7 | combat_town_boss | vence a Gorgak el Grande | kill_boss | **NULL** ⚠️ | **false** ⚠️ | active |

`combate_town_1` **ya está** enlazada al mundo — es una plantilla real y
funcionando de mapa "eliminar enemigo" (2 tareas `kill_all`: 5 "Ogre
Warrior" + 4 "Ogre"). `combat_town_boss` **ya existe** como mapa de Boss
(1 tarea `kill_boss` contra "Gorgak el Grande") pero nunca se enlazó al
mundo ni se marcó `is_final=true` — hoy es una misión suelta jugable que
debería ser el examen de `mundo_1` y no lo es. `combate_town_2` tampoco
está enlazada.

**Segundo hallazgo, más serio**: `worlds.challenge_tags` de `mundo_1` es
`{saludos, presentacion, numeros, "presente simple"}` — tags en español.
Pero `learning_challenges.tags` usa **inglés** (`greetings`,
`introductions`, `numbers`, `vocabulary`, …). Verifiqué directamente:

```sql
SELECT count(*) FROM learning_challenges
WHERE tags && ARRAY['saludos','presentacion','numeros','presente simple'];
-- → 0
```

**El pool de cards normales de `mundo_1` está vacío ahora mismo, en
producción** — el riesgo R3/R6 de `PLAN_MUNDOS.md` no es hipotético, ya
está pasando en silencio. El pool de examen (`final_mision_1`) sí tiene
contenido (28 preguntas) — solo el pool "normal" está roto. Esto es
independiente del plan de mundo nuevo, pero vale la pena repararlo en
algún momento (2 `UPDATE` + revisar/crear challenges en inglés).

## Las 4 etapas por mapa (se repiten por cada mapa nuevo)

Orden **obligatorio por foreign key**, no solo por conveniencia —
`mission_tasks` tiene dos FK duras (`mission_id`, `target_npc_template_id`)
y físicamente no se puede insertar antes de que existan ambas filas padre:

```
map_configs          npc_definitions (catálogo ya existente, reusar)
  (sin FK)                  │
                             ▼
missions  ◄── world_id=NULL   npc_templates ◄── npc_definition_id
     │            status='draft'                       │
     └──────────────────► mission_tasks ◄───────────────┘
```

### Etapa 1 — Mapa + tiles (`map_configs`)

- `INSERT` con `scene_key` nuevo único, `walls_json` (floors/walls/forest/
  builds/pickups/enemySpawns; `npcZones` puede ir vacío o precargado — no
  tiene FK, es solo dibujo del editor) y `map_data` (width/height).
- Fuente sugerida: copiar `walls_json`/`map_data` de un `scene_key`
  existente (`the_village`, `the_village_2` o `clock_tower`) vía
  `INSERT ... SELECT`, y revisar/limpiar los `builds[].targetMap` que
  apunten a un `scene_key` específico del mundo viejo (los que apuntan a
  `'lobby'` son genéricos y no hace falta tocarlos).
- **Checkpoint que ya no aplica si se usa la API**: `GetMapConfig` sirve
  desde una caché en memoria (`mapConfigCache`) que un `INSERT` SQL directo
  NO invalida — hay que reiniciar el backend o pegarle una vez a
  `POST /admin/maps`. Usando `POST /admin/maps` desde el principio (como
  hacen los scripts de `scripts/world-builder/`) este problema no existe:
  el propio handler invalida la caché al guardar.
- **Checkpoint nuevo, encontrado en producción con `combate_pronoun_boss`**:
  `POST /admin/maps` (crear mapa nuevo) guarda el `walls_json` tal cual
  pero **no** sincroniza NPCs/enemigos/`pickups` a sus tablas reales —
  eso solo pasa en la rama "actualizar mapa existente". El mapa clonado
  se ve completo en el editor (lee `walls_json` directo) pero el juego
  real no tiene items jugables (lee la tabla `map_pickups`, vacía).
  **Después de clonar, correr `scripts/world-builder/resync_map.py
  <scene_key>`** (un `PUT` con el mismo `walls_json` sin cambios, dispara
  el sync) — ver detalle en
  [scripts/world-builder/README.md](scripts/world-builder/README.md).
- **Validar antes de pasar a la etapa 2**: el mapa carga en el editor/juego,
  se ve completo (tiles, portales, pickups), sin NPCs todavía.

### Etapa 2 — Misión (`missions`)

- `INSERT` con el mismo `scene_key`, `world_id = NULL`, `status = 'draft'`,
  `type = 'talk_to_npc'`, título/descripción/objetivo/recompensas.
- No depende de que la etapa 1 ni la 3 estén terminadas a nivel de FK, pero
  lógicamente va después del mapa.
- **Validar**: la fila existe, `status='draft'` (no aparece en el catálogo
  de jugador — confirmar con una consulta a `/missions` que no la liste).

### Etapa 3 — NPCs (`npc_templates`)

- `INSERT ... SELECT` copiando de los NPCs de un mapa fuente: posición,
  `npc_definition_id` (reusar personajes existentes — Joy/Ann/Sam/etc. — o
  crear `npc_definitions` nuevas solo si el mundo necesita sprites nuevos),
  y **`instructions` / `greeting` / `success_message`** (el contenido
  pedagógico real — esto es lo que el editor NO copia si se usa
  Exportar/Importar, ver análisis previo).
- `RETURNING` + `id_map` (old_id → new_id) correlacionando por
  `(npc_definition_id, position_x, position_y)` — clave natural única
  dentro de un mismo `scene_key`, más confiable que asumir orden de
  `RETURNING`.
- **Validar**: los NPCs aparecen en el mapa (posición correcta), y su
  diálogo (`instructions`) tiene sentido — reescribir aquí si el mapa
  nuevo cambia de tema respecto al mapa fuente.

### Etapa 4 — Tareas (`mission_tasks`)

- `INSERT` usando el `id_map` de la etapa 3 para resolver
  `target_npc_template_id`, y el `id` de la misión de la etapa 2 para
  `mission_id`.
- **Validar**: jugar la misión de punta a punta (con `status` temporalmente
  en `'active'` en un entorno de prueba, o vía un usuario admin) — las 5
  tareas se completan en orden y la misión se marca `completed`. Volver a
  `status='draft'` si se probó en prod hasta que el mundo esté listo para
  publicarse.

**Repetir las 4 etapas por cada mapa nuevo del mundo** (p.ej. 3 mapas de
vocabulario, como el patrón de World 1) antes de pasar a la fase final.

## Variante de las etapas para mapas de combate y de Boss

Mismo esqueleto de 4 etapas, pero `mission_tasks` no depende de
`npc_templates` — depende de los enemigos, que son un catálogo **global**
(`enemies`, hoy 4 filas: Ogre, Ogre Warrior, y los del boss), no
per-`scene_key`. Eso simplifica la Etapa 3: no hace falta `id_map`, se
referencia el `enemy_id`/nombre existente directo.

### Etapa 1 (combate) — Mapa + tiles + `enemySpawns`

- Igual que la variante de diálogo, pero `walls_json.enemySpawns` en vez de
  `npcZones`: posición, `npcId` (referencia al `enemies.id` o legacy
  numérico), oleada (`waveNum`), HP/daño/velocidad. Se sincroniza a
  `map_configs.map_data.enemies` (ver `syncMapEnemies` en
  `admin_map_handler.go`).
- **Plantilla real para "eliminar enemigo"**: clonar `combate_town_1`
  (`map_data` de 2939 bytes, 2 oleadas de ogros) o `combate_town_2`.
- **Plantilla real para "Boss"**: clonar `combat_town_boss` (`map_data` de
  5478 bytes — más oleadas + boss final). Mismo mecanismo de clonado que
  ya describimos: copiar `walls_json`/`map_data`, nuevo `scene_key`.

### Etapa 2 (combate) — Misión

- `type = 'kill_all'` (mapa intermedio) o `type = 'kill_boss'` (mapa
  final). Si es el mapa final del mundo: `is_final = true` — recordar el
  índice único (`idx_missions_one_final_per_world`, solo uno por mundo).

### Etapa 3 (combate) — Enemigos

- No se copian filas nuevas de `enemies` a menos que el mundo quiera
  monstruos con skin distinto — normalmente se **reusa** el catálogo
  existente (igual que se reusan `npc_definitions` para diálogo). El tema
  del mundo se transmite por las Ninja Cards (`challenge_tags`/`exam_tag`),
  no por el sprite del enemigo.

### Etapa 4 (combate) — Tareas

- `mission_tasks` con `type='kill_all'` + `required_enemy` (nombre) +
  `required_kills`, o `type='kill_boss'` + `required_enemy` del boss. No
  usa `target_npc_template_id` — sin `id_map` que resolver.

## Fase final — Asignar a mundo y a challenges (una sola vez)

Solo cuando **todos** los mapas-misión del mundo nuevo pasaron su
validación individual:

1. **Crear el mundo** — `INSERT INTO worlds (key, name, description_en,
   "order", challenge_tags, challenge_types, exam_tag, difficulty)` (ver
   estructura en [worlds_schema.sql](worlds_schema.sql)). `key` y
   `exam_tag` son únicos — elegir valores nuevos que no choquen con
   `mundo_1` / `final_mision_1`.
2. **Asignar las misiones al mundo** — `UPDATE missions SET world_id = :id,
   order_in_world = :n, status = 'active' WHERE id IN (…)`. Este es el
   momento en que el mundo se vuelve visible de golpe para los jugadores.
3. **Sembrar/etiquetar `learning_challenges`** con `challenge_tags` (cards
   normales durante las misiones) y `exam_tag` (cards del mapa final de
   examen) del mundo nuevo. Sin esto, el pool cae en silencio al random
   global (riesgo `R3` ya documentado en `PLAN_MUNDOS.md`) — verificar con
   el endpoint `/admin/worlds/:id/pool-health` antes de dar por cerrado el
   mundo.
   **Usar tags en inglés** — `learning_challenges.tags` es 100% inglés
   (`greetings`, `numbers`, `pronunciation`, …); `mundo_1` usó español
   (`saludos`, `numeros`) y por eso su pool normal está vacío ahora mismo
   (ver hallazgo arriba). No repetir ese error.
4. **Mapa final de examen** — es un mapa de **combate** (oleadas + boss),
   no un mapa `talk_to_npc`; no sale de clonar un mapa de diálogo y se
   construye aparte. Requiere `is_final = true` en su `missions` (índice
   único: solo un final por mundo) y sus propios `enemySpawns` en
   `map_data`.

**Validar el cierre**: `SELECT w.key, count(*) FROM missions m JOIN worlds
w ON w.id = m.world_id WHERE w.key = :nuevo GROUP BY w.key` da el número de
misiones esperado; el mundo aparece en `/worlds` con progreso 0/N; el
diagnóstico de `pool-health` da semáforo verde.

## Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `scene_key` repetido (choca con `map_configs.scene_key` UNIQUE) | Elegir claves nuevas explícitas antes de escribir el SQL de la etapa 1 |
| R2 | `id_map` de la etapa 3 mal correlacionado si dos NPCs quedan en la misma posición exacta | Verificar `(npc_definition_id, position_x, position_y)` sea único por `scene_key` antes de copiar |
| R3 | Caché de `map_configs` no invalidada tras `INSERT` directo | Reiniciar backend o re-guardar por API antes de probar cada mapa (etapa 1) |
| R4 | Mundo visible a medias si se asigna `world_id` antes de terminar todos los mapas | Mantener `status='draft'` y `world_id=NULL` durante todas las etapas 1-4; asignar todo junto en la fase final |
| R5 | `exam_tag`/`key` del mundo nuevo choca con uno existente (índices únicos) | Revisar `SELECT key, exam_tag FROM worlds` antes de la fase final |
| R6 | Pool de `learning_challenges` vacío para los tags nuevos → examen cae a random global en silencio | `pool-health` antes de cerrar el mundo (mismo riesgo R3 de `PLAN_MUNDOS.md`) |

## Prueba piloto propuesta — Mundo 2: Pronombres

Mismo esqueleto de 5 misiones que `mundo_1` (3 diálogo + 1 combate + 1
boss), clonando exactamente las plantillas ya identificadas:

| # | scene_key propuesto | Clona tiles de | Tipo | Tema |
|---|---|---|---|---|
| 1 | `pronoun_village` | `the_village` | talk_to_npc | Pronombres sujeto: I, you, he, she, it, we, they |
| 2 | `pronoun_village_2` | `the_village_2` | talk_to_npc | Pronombres posesivos: my, your, his, her, its, our, their |
| 3 | `pronoun_square` | `clock_tower` | talk_to_npc | Presente simple + pronombre (he/she/it agrega -s) — encadena con el tag `"presente simple"` que `mundo_1` ya quería cubrir y nunca tuvo contenido |
| 4 | `combate_pronoun_1` | `combate_town_1` | kill_all | Ninja Cards tag `pronouns` |
| 5 | `combate_pronoun_boss` | `combat_town_boss` | kill_boss (is_final) | Ninja Cards tag `final_mundo_2` |

`worlds`: `key='mundo_2'`, `challenge_tags=['pronouns']` (**inglés**),
`exam_tag='final_mundo_2'`.

**El único tramo que no es clonable, hay que escribirlo**:
`learning_challenges` con tag `pronouns`/`final_mundo_2` — hoy existen
**0** preguntas con esos tags en toda la DB (verificado). Esto es
redacción de contenido real (preguntas de opción múltiple sobre
pronombres en inglés), no un `INSERT ... SELECT` de otra tabla — conviene
dimensionarlo aparte (¿cuántas preguntas por tag? ¿mismo formato que las
380 de `vocabulary`?).

## Checklist de ejecución (estado real, Mundo 2: Pronombres)

- [x] Etapa 1-4 completas y validadas para **mapa #1** (`pronoun_village`)
- [x] Etapa 1-4 completas y validadas para **mapa #2** (`pronoun_village_2`)
- [x] Etapa 1-4 completas y validadas para **mapa #3** (`pronoun_square`)
- [x] Etapa 1-4 (variante combate) para **mapa de combate** (`combate_pronoun_1`)
- [x] Etapa 1-4 (variante combate) para **mapa de Boss** (`combate_pronoun_boss`, `is_final` se marca en la Fase final)
- [x] `learning_challenges` redactados para `pronouns` (20) y `final_mundo_2` (10)
- [x] *(Aparte, no bloqueaba lo anterior)* Reparado `mundo_1`: `combate_town_2`/`combat_town_boss` enlazados, `is_final` en el boss, `challenge_tags` corregidos a inglés — `pool-health` pasó de 0 a 51 preguntas normales
- [x] Fase final: mundo `mundo_2` creado (id=2), 5 misiones publicadas (`world_id=2`+`status='active'`), `combate_pronoun_boss` marcado `is_final`, `pool-health` en verde (20 normales + 10 examen)

**Mundo 2: Pronombres quedó completo y publicado — 6 mapas, no 5.**
Corrección importante encontrada después de la primera pasada: el patrón
real de World 1 es **3 NPC + 2 combate + 1 jefe = 6 misiones**
(`the_village`/`the_village_2`/`clock_tower` + `combate_town_1` +
`combate_town_2` + `combat_town_boss`) — el primer build de Mundo 2 solo
clonó 1 mapa de combate, no 2. Se completó con `combate_pronoun_2`
(clon de `combate_town_2`: 9 Ogre Warrior + 4 Ogre, sin pickups). **Usar 6
mapas como default para el próximo mundo**, no 5 — dos combates antes del
jefe da una repetición más de las Ninja Cards del tema antes del examen.

Próximo mundo: copiar `scripts/world-builder/` a una carpeta nueva, cambiar
`scene_key`s/tema/contenido, y repetir `build` → `validate` → `publish`.
