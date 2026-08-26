# World Builder — notas y checklist

Scripts que construyen un mundo nuevo (mapa + misión + NPCs + tareas +
mapa de combate + mapa de jefe + challenges) contra la API real de
producción, sin SQL crudo. Ver el proceso completo en
[PLAN_CLONACION_MAPAS_MISION.md](../../PLAN_CLONACION_MAPAS_MISION.md).
Esta carpeta es la implementación de referencia (Mundo 2: Pronombres) —
para el próximo mundo, copiarla y adaptar contenido.

## Principios de diseño de contenido (lo que aprendimos con Mundo 2)

### 1. Un mundo = un tema, repetido — no una progresión de sub-temas

Mundo 2 se construyó inicialmente como `pronoun_village`=pronombres sujeto,
`pronoun_village_2`=posesivos, `pronoun_square`=presente simple — tres
temas gramaticales distintos en un solo mundo. Se corrigió a: **las 3
misiones de diálogo repiten el mismo tema (pronombres sujeto) en 3
contextos distintos** (pueblo → granja → plaza), porque una sola
conversación con un tema no alcanza para que el jugador lo retenga.

**Para el próximo mundo**: si el tema es "presente simple", las 3
misiones de diálogo son sobre presente simple de principio a fin —con
personajes/escenarios distintos para no ser repetitivo en la forma, pero
sin introducir gramática nueva a mitad de mundo. Los posesivos y el
presente simple que salieron de Mundo 2 quedaron re-etiquetados
(`possessive-pronouns`, `present-simple`) en `learning_challenges` como
semilla para esos mundos futuros — revisar esos tags antes de escribir
challenges nuevos desde cero.

**Nota**: `mundo_1` (the_village/the_village_2/clock_tower) tiene el mismo
problema sin corregir — the_village + the_village_2 sí repiten saludos,
pero clock_tower cambia a hora/números. No se tocó (no se pidió), pero es
la misma corrección pendiente si se retoma ese mundo.

### 2. Los NPCs "puerta" (si/no) necesitan sugerir cómo responder

Un NPC cuya única tarea es una confirmación tipo "Are you ready?" puede
dejar a un jugador principiante sin saber qué decir en inglés — no hay
frase de ejemplo que copiar, a diferencia de las tareas de práctica real
("pide una frase como 'X'"). Cualquier NPC con este patrón debe incluir en
sus `instructions` una pista explícita tipo *"si el jugador no sabe qué
responder, sugerirle 'Sure', 'OK', 'Yes' o 'Let's go'"*.

**Para el próximo mundo**: revisar el primer NPC de cada misión (suele ser
el de bienvenida/gate) y confirmar que tiene esta pista.

### 3. El `greeting` es solo saludo — el contenido va en `instructions`, con patrón 2+2

`greeting` se muestra tal cual, **antes** de que el LLM tome el control de
la conversación (es texto fijo, no generado). Meterle la frase de la
lección ahí (ej. *"Hey! They are working in the field."*) confunde: el
jugador no sabe si eso es un saludo casual al que responder como quiera, o
la frase exacta que debe repetir para completar la tarea.

**Patrón correcto**:
- `greeting`: una interjección simple y nada más — `Hi!` / `Hello!` /
  `Hey!` / `Hey there!` / `What's up!` (variar por personaje, no por
  contenido).
- `instructions`: ahí sí va todo — decir qué se va a practicar, dar **dos
  frases de ejemplo con invitación explícita a repetirlas** ("dale dos
  frases y dile que las puede repetir tal cual: 'X' y 'Y'"), y luego
  **dos frases más** para reforzar. Completar la tarea con al menos 2 de
  las 4. Esto da más repeticiones dentro de una sola conversación, no solo
  un intercambio.
- Excepción: un NPC "puerta" (si/no, ver punto 2) sí puede tener el gancho
  en el `greeting` (ej. Mochi: *"Ready for a new lesson?"*) porque esa
  pregunta **es** la tarea completa, no contenido de lección a medias.

### 4. Los mapas de combate necesitan pociones de vida/maná y lanzables

Los `pickups` (Health Potion, Mana Potion, Throwing Dagger, etc.) viven en
`map_configs.walls_json` igual que los demás tiles — si el mapa de combate
se **clona** de uno existente (como `combate_town_1`/`combat_town_boss`),
se copian solos. Si algún día se arma un mapa de combate **desde cero**
(no clonado), hay que agregar `pickups` a mano — sin esto el jugador no
tiene forma de recargar vida/maná ni de usar lanzables en el combate.

### 5. Clonar un mapa nuevo (Etapa 1) NO sincroniza NPCs/enemigos/pickups — hay que forzarlo

Encontrado jugando `combate_pronoun_boss` en producción: el mapa se veía
bien en el editor, pero **no aparecía ningún item**. Causa raíz:
`POST /admin/maps` (como lo usa `*_build.py` para clonar) tiene dos ramas
en `admin_map_handler.go` — "crear mapa nuevo" guarda el `walls_json` tal
cual y **retorna sin sincronizar nada**; "actualizar mapa existente" sí
corre `SyncTemplatesFromMap` (NPCs), `syncMapEnemies` y `syncMapPickups`.
Como clonar un mapa siempre lo **crea** (scene_key nuevo), cualquier
`pickups` que traiga el `walls_json` clonado queda en el JSON pero nunca
se copia a la tabla real `map_pickups` — que es de donde
`GET /inventory/pickups/:scene` (lo que el juego usa en vivo) lee. El
mapa "se ve" completo en el editor (lee `walls_json` directo) pero no
tiene items jugables.

**Fix, y por qué hay que aplicarlo siempre después de clonar**: un
`PUT /admin/maps/:id` con el mismo `walls_json` (sin cambios) toma la
rama "actualizar" y dispara los 3 syncs. Ya existe el script para esto:

```
python resync_map.py <scene_key> [<scene_key> ...]
```

**Para el próximo mundo**: después de clonar cada mapa en la Etapa 1,
correr `resync_map.py` sobre esos `scene_key` — sobre todo los de
combate/Boss (tienen `pickups`; los de diálogo puros no, así que ahí es
inofensivo pero no imprescindible). No asumir que "se ve bien en el
editor" significa que el juego real tiene los items — son dos caminos de
lectura distintos (`walls_json` vs. tabla `map_pickups`).

## Cosas técnicas a tener en cuenta

### `PUT` de `missions`/`npcs`/`tasks` es sobreescritura completa

`UpdateMission`, `UpdateNPCTemplate` y `UpdateTask` hacen `BodyParser` a un
struct **vacío** (no precargan la fila actual de la DB) — si el `PUT` no
incluye TODOS los campos, los que falten se pisan con su valor por
defecto (cero/vacío). Por eso todo helper de update en estos scripts hace
primero un `GET` de la fila completa, y recién ahí `dict(row) | patch`
antes de mandar el `PUT`. **`UpdateChallenge` es la excepción** — sí
precarga la fila antes del `BodyParser`, así que un `PUT` parcial no borra
nada ahí. No asumir que todos los endpoints admin se comportan igual sin
revisar el handler primero.

### `_client.call()` — pasar `token` siempre como keyword

La firma es `call(method, path, body=None, token=None)`. Pasar el token
posicional (`call("GET", path, token)`) lo manda al parámetro `body` y
deja `token=None` → `401 Missing token` silencioso hasta que se lee el
mensaje de error. Usar siempre `call(..., token=TOKEN)`.

### Ejecución: por HTTP contra la API real, no SQL directo

Evita el problema de caché de `map_configs` (un `INSERT` SQL directo no
invalida `mapConfigCache`; `POST /admin/maps` sí lo hace solo) y la
validación la hace el propio backend. Requiere login admin
(`admin@odyssey.dev` — credenciales del seed, ver
`gather-rpg-backend/internal/database/seed.go`, overridable con
`ODYSSEY_ADMIN_EMAIL`/`ODYSSEY_ADMIN_PASSWORD`).

### El clasificador de seguridad bloquea las corridas de escritura

Los pasos `build`/`publish`/`adjust`/`adjust2` (cualquiera que haga
`POST`/`PUT` reales) suelen ser bloqueados si Claude intenta ejecutarlos directamente
— es el comportamiento esperado, no un bug. El flujo que funciona: Claude
prepara y sintáctica-verifica el script, y el usuario lo corre desde su
propia terminal con `scripts/mundo2-pronombres.ps1 -Step <paso>` (o el
`.ps1` equivalente del mundo nuevo). `validate` (solo lectura) sí suele
poder correrlo Claude directamente.

## Checklist para el próximo mundo

- [ ] Elegir **un solo tema gramatical/de vocabulario** para las 3 misiones
      de diálogo (repetición, no progresión) — revisar primero los tags
      `possessive-pronouns`/`present-simple` en `learning_challenges` por
      si ya hay contenido reusable de una etapa anterior.
- [ ] Copiar `scripts/world-builder/` a una carpeta nueva; renombrar los
      scripts y el `.ps1` orquestador.
- [ ] Etapa 1-4 por cada mapa de diálogo (clonar tiles, misión en `draft`,
      NPCs con `instructions` nuevas, tareas) — el primer NPC de la
      primera misión necesita la pista de respuesta (punto 2), y cada NPC
      de contenido necesita `greeting` limpio + patrón 2+2 en
      `instructions` (punto 3).
- [ ] Etapa 1-4 (variante combate) para el mapa de "eliminar enemigo" y el
      de Boss — clonar de un mapa de combate existente para heredar los
      `pickups` (punto 4); si se arma desde cero, agregarlos a mano.
- [ ] Correr `resync_map.py <scene_key>` sobre cada mapa recién clonado
      (sobre todo los de combate) — clonar por `POST /admin/maps` NO
      sincroniza `map_pickups`/NPCs/enemigos por sí solo (punto 5).
- [ ] Redactar `learning_challenges` nuevos SOLO del tema del mundo — no
      mezclar sub-temas (lección de Mundo 2).
- [ ] Fase final: crear el `World`, publicar las 5 misiones, marcar
      `is_final` en el mapa de Boss, confirmar `pool-health` en verde.
- [ ] Correr `-Step validate` antes y después de publicar.
