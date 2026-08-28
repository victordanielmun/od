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

### 2.5. El sprite del letrero importa — usar el poste de madera, no un mueble de interior

El primer letrero de Mundo 2 usaba `furniture3` (atlas `furniture/spritesheet.png`)
frame `sprite1` como placeholder — resultó ser un pedestal de piedra de
mazmorra/tienda, fuera de lugar en una aldea o pradera. Además, **ninguna**
de las misiones de NPC originales (`the_village`/`the_village_2`/
`clock_tower`) usa tiles de tipo mueble para decoración — su paisaje es
100% `forest` (+ `builds` en `clock_tower` para la torre).

El sprite correcto, confirmado porque es el que ya usa un letrero real en
`clock_tower` en producción: tipo **`furniture`** (no `furniture3`), atlas
`store-furniture` (`store/furniture.png`), frame **`sprite63`** — un
letrero de madera con poste, visualmente correcto para exteriores. Antes
de reusar cualquier frame como placeholder, recortarlo con `crop_atlas.py`
y mirarlo — no asumir que "un frame válido" es "un frame que se ve bien
ahí".

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

## 6. Clonar tal cual repite el paisaje entre mundos — variar con vista previa, no a ciegas

Clonar `walls_json` (Etapa 1) es rápido pero dos mundos que clonan la misma
plantilla se ven **pixel a pixel idénticos** para el jugador (mismo bosque,
mismos árboles). Se corrigió para Mundo 2 con dos herramientas:

- **`crop_atlas.py <png> <json> <salida.png>`** — recorta cada frame de un
  atlas (terrain/forest/etc.) usando sus coordenadas reales del JSON y arma
  una hoja de referencia con el nombre de cada `spriteN` al lado. Los atlas
  de `forest`/`store-furniture`/etc. están empaquetados de forma irregular
  (no un grid uniforme) — **no se puede adivinar qué es cada `spriteN`
  mirando la hoja completa**, hay que recortar para tener certeza antes de
  elegir una paleta nueva.
- **`preview_map.py <mapa.json> <salida.png>`** — compone los sprites reales
  de `floors`/`forest` en sus coordenadas exactas sobre un canvas, y dibuja
  marcadores para `npcZones` (círculo azul), `furniture*` (círculo dorado),
  `builds` (recuadro naranja), `enemySpawns` (punto rojo con nº de oleada) y
  `pickups` (punto rosa). **Renderizar y mirar la imagen antes de subir a
  producción** — así se detectan superposiciones (árbol sobre un NPC, item
  cayendo en agua) sin depender de abrir el juego real.

**Patrón usado para variar un mapa ya clonado** (ver
`design_combate1.py`/`design_boss.py`/`design_dialogue.py` como ejemplos
completos, ya no están en el repo pero el patrón es reproducible):

1. Mapas de **combate**: se puede regenerar toda la grilla (floor/forest/
   voids) con zonas nuevas (ej. bosque denso + lago + campo abierto), porque
   `enemySpawns`/`pickups` son marcadores libres — solo hay que preservar el
   `npcId`/stats exactos de cada enemigo (copiarlos del mapa actual, **no
   inventarlos**) y la cantidad por tipo (debe calzar con
   `mission_tasks.required_kills`).
2. Mapas de **diálogo**: es más seguro **no tocar las coordenadas** de
   `npcZones`/`furniture3`/`builds` (mover un NPC de lugar en el mapa
   también requiere actualizar `position_x`/`position_y` en su fila real de
   `npc_templates`, si no el marcador del editor y el NPC real quedan
   desincronizados). En cambio: reasignar el `frame` de cada tile de
   `floors` ya existente (mismo lugar, otro piso) y generar un `forest`
   nuevo usando **solo** coordenadas que ya eran `floors` válidos, evitando
   un radio alrededor de cada NPC/letrero/`build`.
3. Después de generar, correr `resync_map.py <scene_key>` si el `PUT` no
   se hizo ya con el nuevo `walls_json` (un `PUT` con contenido nuevo ya
   sincroniza pickups solo, no hace falta un paso aparte).

## 7. El patrón real es 6 mapas (3 NPC + 2 combate + 1 jefe), no 5

Mundo 2 se construyó inicialmente con 5 mapas (3 NPC + 1 combate + 1 jefe),
calcado mal de World 1. La estructura real de World 1 es **3 NPC +
2 combate + 1 jefe**: `the_village`/`the_village_2`/`clock_tower` +
`combate_town_1` + `combate_town_2` + `combat_town_boss`. Se corrigió
agregando `combate_pronoun_2` (clon de `combate_town_2`). El segundo mapa
de combate importa porque **las Ninja Cards de ambos combates y del jefe
sacan del mismo pool de tags del mundo** (`challenge_tags` para los dos
combates, `exam_tag` para el jefe) — dos combates dan una repetición extra
del tema antes del examen final, no son solo relleno.

## 8. Al clonar, limpiar `furniture`/`furniture3` heredado antes de agregar el letrero nuevo

`clock_tower` ya tenía su propio letrero (el de "Basic Greetings" que
analizamos en `ANALISIS_LETRERO_CLOCK_TOWER.md`) cuando se clonó para
Mundo 3 — el clon se lo llevó puesto, y el script agregó el letrero nuevo
**encima**, dejando 2 letreros en el mismo mapa (uno de un tema que no
corresponde). Antes de agregar el `SIGNS[dst]` nuevo, vaciar
`wallsData["furniture"] = []` (y `furniture2`/`furniture3`) heredado del
mapa fuente — no asumir que un mapa clonado llega sin muebles.

## 9. Las `instructions` de los NPC de contenido necesitan CONTEXTO, no solo frases para repetir

Encontrado jugando los mundos 2-9 en producción: cada NPC de contenido
enseñaba bien la lista de frases a repetir, pero nunca le decía al jugador
**cuándo o por qué** se usa esa forma — el jugador terminaba repitiendo
frases en inglés sin entender el motivo. Ejemplo del problema que señaló
el usuario: un NPC de "pregunta" solo decía "repite esto" sin explicar la
relación afirmativo → pregunta → respuesta corta.

**Fix aplicado** (`fix_npc_context.py`, ya corrido sobre los 112 NPCs de
contenido de los mundos 2-9): se inserta una frase de regla gramatical en
español justo después de "hablas ingles." y antes del resto de la
instrucción original (que no se toca) — por ejemplo, para un NPC de
pregunta: *"En afirmativo decimos 'He is a chef'. En pregunta, 'Is he a
chef?'. La respuesta corta es 'Yes, he is' o 'No, he isn't'."* Para un
NPC de posesivo: *"'My' se usa para decir que algo es tuyo. Por ejemplo,
si el libro es tuyo, dices 'This is my book'."*

**Para el próximo mundo**: cada NPC de contenido (no los NPC "puerta") debe
tener, en sus `instructions`, una frase de contexto ANTES de las frases de
práctica, que explique la regla en términos simples — idealmente
mencionando el contraste afirmativo/negativo/pregunta cuando aplique (no
solo "aquí está la frase, repítela"). Los NPC de repaso (mapa "square")
deben usar "Recuerda: ..." en vez de introducir la regla de cero. No hace
falta reescribir toda la instrucción — alcanza con insertar esta frase
justo después de "Eres X, hablas ingles." (ver `fix_npc_context.py` como
plantilla del patrón de split/insert vía `PUT /admin/npcs/:id`, siempre
con GET-full-row-then-merge, punto de la sección de cosas técnicas).

## 9.5. El atlas `forest` se agota alrededor del mundo 12 -- a partir de ahi, variar la COMBINACION, no cada frame

Con 80 frames en el atlas `forest` (muchos vacios), para Mundo 12 solo
quedaban 3 frames que ningun mundo anterior habia usado
(`sprite3`/`sprite4`/`sprite55`). A partir de aca es normal que un frame
individual se repita entre mundos -- lo que hay que seguir evitando es
que la COMBINACION completa (mismo piso + mismo set de decoracion) se
repita pixel a pixel. Para Mundo 12 se resolvio reusando el piso rocoso
de Mundo 6 pero con la decoracion de tocones/musgo de Mundo 9 en vez de
arboles muertos -- ninguno de los dos mundos anteriores usa esa pareja
exacta, asi que el resultado se sigue viendo distinto aunque los frames
individuales ya existian. **Para el próximo mundo**: antes de asumir que
hace falta un frame 100% nuevo, revisar la tabla del punto 10 y armar una
pareja piso+decoracion que ningun mundo haya usado todavia, aunque cada
frame por separado ya se haya usado en otro contexto.

## 10. Paisajes ya usados (para no repetir entre mundos)

| Mundo | Diálogo | Combate |
|---|---|---|
| 2 (Pronombres) | pradera/granja/plaza (bosque original) | bosque original |
| 3 (I am, Career Village) | huerto (manzanos + flores) | — |
| 4 (You are/He is/She is) | cantera rocosa (tierra+rocas) | tierra |
| 5 (It is + adj, Wonderland) | pradera de flores silvestres | pantano |
| 6 (Negativo, No-Way Town) | muelle/embarcadero de madera | páramo rocoso con árboles muertos |
| 7 (Pregunta, Question Harbor) | oasis de arena con palmeras | ruinas cubiertas de musgo |
| 8 (Posesivos, Possession Point) | jardín de cabaña (pasto + hongos/flores) | llanura polvorienta (tierra + cactus) |
| 9 (Plural/Artículos, Twofold Town) | plaza de piedra (losas grises + musgo/troncos/tocones) | caverna oscura (roca de cueva + musgo/vides escasas) |
| 10 (Presente Simple afirmativo, Daily Grove) | bosque de pinos y arces (pasto + pinos/árboles de otoño) | matorral tupido (pasto + arbustos redondos) |
| 11 (Presente Simple negativo, Nevergreen Grove) | patio de ladrillo gris (piso de ladrillo + arbustos/helechos) | duna arenosa (piso de arena + cactus/matorral escaso) |
| 12 (Presente Simple pregunta, Boulder Query) | arboleda caida (pasto + arboles grandes + troncos caidos -- últimos frames 100% nuevos del atlas forest) | campo de rocas (piso rocoso de Mundo 6 + tocones/musgo de Mundo 9, combinación nueva aunque los frames se repiten) |
| 13 (There is/are, Thereabouts) | Cobblestone Pines (ladrillo de Mundo 11 + pinos de Mundo 10, nunca combinados) | Driftwood Graveyard (madera de Mundo 6 + árboles muertos de Mundo 6, nunca combinados en un mismo mapa) |
| 14 (Colores, Hue Harbor) | Sandy Bloom (arena de Mundo 7 + flores de Mundo 5, nunca combinadas) | Muddy Clearing (tierra + tocones/musgo de Mundo 9, nunca combinados) |
| 15 (Animales, Critter Cove) | Stone Grove (piedra redonda de Mundo 9 + árboles caídos de Mundo 12, nunca combinados) | Rocky Thicket (piso rocoso de Mundo 6/12 + arbustos de Mundo 10, nunca combinados) |
| 16 (Familia, Hearthwood) | Fallen Deck (madera de Mundo 6 + árboles caídos de Mundo 12, nunca combinados) | Cactus Dunes (piso de arena + cactus de Mundo 8, nunca combinados con arena) |
| 17 (Números, Tally Town) | Stone Garden (piedra de Mundo 9/15 + arbustos/helechos de Mundo 11, nunca combinados) | Wooden Clearing (madera de Mundo 6/16 + tocones/musgo de Mundo 9, nunca combinados) |
| 18 (Comida, Snack Shore) | Dusty Pines (tierra + pinos de Mundo 10/13/15, primera vez tierra en un mapa de diálogo) | Rocky Deadfall (piso rocoso + árboles caídos de Mundo 12/16, nunca combinados) |
| 19 (Cuerpo, Anatomy Grove) | Grassy Ruins (pasto + decoración de ruinas de Mundo 7, antes solo en combate) | Sandy Thicket (arena de Mundo 16 + arbustos de Mundo 10/15, nunca combinados) |
| 20 (La Casa, Household Hollow) | Brick Clearing (ladrillo de Mundo 11/13 + tocones/musgo de Mundo 9, nunca combinados) | Driftwood Cactus (madera de Mundo 6/16/17 + cactus de Mundo 8/16, nunca combinados) |
| 21 (Preposiciones, Position Point) | Sandy Ruins (arena de Mundo 11 + decoración de ruinas de Mundo 7/19, nunca combinados) | Cave Thicket (piso de cueva de Mundo 9 + arbustos de Mundo 10/15/19, nunca combinados) |
| 22 (Presente Continuo, Motion Meadow) | Wooden Ruins (madera + decoración de ruinas de Mundo 7/19/21, nunca combinados) | Rocky Yard (piso rocoso + arbustos/helechos de Mundo 11/17, nunca combinados) |
| 23 (Can/Can't, Can-Do Cavern) | Cave Deadfall (piso de cueva de Mundo 9/21 + árboles caídos de Mundo 12/16/18, nunca combinados) | Sandy Pines (arena + pinos de Mundo 10/13/18/22, nunca combinados) |
| 24 (Pasado Simple afirmativo, Yesterday Yard) | Sandy Flowerbed (arena de Mundo 11/21/23 + flores de Mundo 5/8/14, nunca combinadas) | Cactus Meadow (pasto + cactus de Mundo 8/16, nunca combinados) |
| 25 (Pasado Simple negativo, Didn't Dell) | Brick Garden (ladrillo de Mundo 11/13/20 + flores de Mundo 5/8/14/24, nunca combinados) | Dusty Dune (tierra + cactus/helecho de Mundo 11, nunca combinados con tierra) |
| 26 (Pasado Simple pregunta, Query Quarry) | Stone Ruins (piedra de Mundo 9/15/17 + decoración de ruinas de Mundo 7/19/21/22, nunca combinados) | Wooden Thicket (madera + arbustos de Mundo 10/15/19/22, nunca combinados) |
| 27 (Verbos irregulares, Memory Mine) | Cave Garden (piso de cueva de Mundo 9/21/23 + arbustos/helechos de Mundo 11/17/22, nunca combinados) | Desert Ruins (arena + decoración de ruinas de Mundo 7/19/21/22/26, nunca combinados en combate) |
| 28 (Comparativos, Superlative Sands) | Sandy Yard (arena + arbustos/helechos de Mundo 11/17/22/27, nunca combinados) | Brick Cactus (ladrillo, usado solo en diálogo hasta ahora, + cactus de Mundo 8/16/24 — primera vez en combate) |
| 29 (Futuro, Tomorrow Town) | Wooden Garden (madera + flores de Mundo 5/8/14/24/25, nunca combinadas) | Dusty Yard (tierra + arbustos/helechos de Mundo 11/17/22/27/28, nunca combinados) |

**Para el próximo mundo**: elegir una combinación de piso/decoración que no
esté en esta tabla — evita que el jugador sienta que ya vio ese paisaje.

## 11. En mundos de vocabulario, cuidado con preguntas de examen con el mismo enunciado y distinta respuesta

Al escribir los `learning_challenges` de Mundo 15 (Animales), un primer
borrador tenia varias preguntas con el enunciado **identico** ("This is
a ___. It lives in the jungle.") pero con opciones/respuesta correcta
distinta segun el animal (lion, elephant, monkey todos viven en la
selva). Esto pasa facil en mundos de vocabulario donde varios items
comparten un atributo (habitat, color, etc.) -- el jugador veria la
misma pregunta dos veces con "la misma pregunta, dos respuestas
correctas distintas", lo cual es un banco de preguntas mal formado, no
solo un detalle cosmetico.

**Fix**: cuando el atributo a adivinar (habitat/color/etc.) lo comparten
varios items del set, no preguntar "adivina el item dado solo el
atributo compartido" -- nombrar el item en el enunciado y dejar en
blanco el atributo, el verbo, o el articulo en su lugar. Antes de correr
el script de challenges, verificar con un chequeo rapido en Python que
no haya dos entradas con el mismo texto de `question` en el mismo tag
(ver el chequeo usado antes de subir Mundo 15).

## 12. El letrero del mapa "_square" no puede ir en (450, 250) -- ahí está la torre

`clock_tower` (la fuente de todos los mapas "_square") tiene un `build`
(la torre) en `(450, 150)` con `frame: sprite13, scale: 2.8`. El
`TilePlacer` del frontend renderiza los builds con origen centrado y
`renderedScale = scale * 1.25`, así que el sprite real mide ~336×402px
centrado en `(450, 150)` -- ocupa visualmente `x:[282,618] y:[-51,351]`.
Los scripts de Mundo 2 y Mundo 4 en adelante (con la única excepción de
Mundo 3, que ya lo tenía corregido) pusieron el letrero de `SIGNS[dst]`
en `(450, 250)` para el mapa "_square", copiando la misma coordenada
usada para los mapas de diálogo (`the_village`/`the_village_2`, que NO
tienen ningún build) sin verificar que `clock_tower` sí tiene uno ahí.
Resultado: el letrero quedaba dibujado detrás/debajo de la torre en 14
de los 15 mundos ya construidos (2, 4-16) -- confirmado y corregido con
`fix_sign_over_build.py`, que mueve el letrero a `(450, 550)` (la
posición que ya usaba el letrero original de `clock_tower`), verificando
antes que no caiga cerca de ningún `npcZone` ni sobre un tile de
`forest` ya generado.

**Para el próximo mundo**: en el mapa "_square", jamás reusar `(450,
250)` (o cualquier punto dentro de `x:[282,618] y:[-51,351]`) para el
letrero -- usar `(450, 550)` como en el original, o correr
`fix_sign_over_build.py --dry-run` después de construir para confirmar.
Como regla general: antes de fijar la posición de un letrero en un mapa
clonado, revisar el campo `builds` del mapa fuente (no solo
`npcZones`/`forest`) -- no todos los mapas fuente están libres de
builds como se asumía.

## 13. El letrero puede caer sobre un tile de `forest` generado al azar -- excluirlo, no solo los npcZones

Todos los scripts generan el `forest` procedural ANTES de inyectar
`SIGNS[dst]` en `furniture`, y el sorteo de tiles evita el radio de cada
`npcZone` (lesson de diseño original) pero nunca excluye la posición
exacta donde va a caer el letrero. Con ~15-18% de densidad de forest por
tile, hay una probabilidad real de que un árbol/arbusto/hongo quede
exactamente en el mismo `(x,y)` que el letrero. Auditoría de los 63
mapas de diálogo construidos hasta Mundo 22 encontró **5 casos reales**
(`doyou_grove`, `family_grove_2`, `house_grove_2`, `house_square`,
`ing_grove_1`) -- corregidos con `fix_sign_over_forest.py`, que borra el
tile de `forest` que coincide con la posición del letrero (se prioriza
el letrero, el elemento funcional, sobre la decoración).

**Para el próximo mundo**: después de generar `forest` y antes de
inyectar el letrero, filtrar explícitamente cualquier tile de `forest`
en la posición exacta de `SIGNS[dst]` -- o correr
`fix_sign_over_forest.py --dry-run` después de construir para
confirmar. Aplica el mismo principio que la lesson 12 (torre de
`clock_tower`): un elemento interactivo nunca debe compartir tile con
otro elemento visual/interactivo sin verificarlo primero.

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
- [ ] Etapa 1-4 (variante combate) para **los 2** mapas de "eliminar
      enemigo" y el de Boss (3 mapas de combate en total, punto 7) —
      clonar de mapas de combate existentes para heredar los `pickups`
      (punto 4); si se arma desde cero, agregarlos a mano.
- [ ] Correr `resync_map.py <scene_key>` sobre cada mapa recién clonado
      (sobre todo los de combate) — clonar por `POST /admin/maps` NO
      sincroniza `map_pickups`/NPCs/enemigos por sí solo (punto 5).
- [ ] Redactar `learning_challenges` nuevos SOLO del tema del mundo — no
      mezclar sub-temas (lección de Mundo 2).
- [ ] Fase final: crear el `World`, publicar las 5 misiones, marcar
      `is_final` en el mapa de Boss, confirmar `pool-health` en verde.
- [ ] Correr `-Step validate` antes y después de publicar.
- [ ] Variar el paisaje de cada mapa clonado (punto 6) — recortar atlas con
      `crop_atlas.py`, diseñar, `preview_map.py` antes de subir. No dejar
      dos mundos con el mismo bosque pixel a pixel.
- [ ] Antes de fijar la posición del letrero en el mapa "_square", revisar
      el campo `builds` del mapa fuente (`clock_tower` tiene la torre en
      `(450,150)`, área visual `x:[282,618] y:[-51,351]`) — usar `(450,550)`
      como el letrero original, nunca `(450,250)` (punto 12).
- [ ] Antes de correr el script de `learning_challenges`, verificar que no
      haya dos preguntas con el mismo `question` pero distinta respuesta
      correcta (punto 11) — pasa fácil cuando varios items comparten un
      atributo (habitat, color, etc.).
- [ ] Al escribir `instructions` de los NPC de contenido, incluir la regla
      gramatical en contexto (afirmativo/negativo/pregunta cuando aplique)
      ANTES de las frases de práctica, desde el diseño inicial — no como
      parche posterior (punto 9).
