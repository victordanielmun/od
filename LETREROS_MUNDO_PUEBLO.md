# Letreros de lectura — Mundo "Pueblo Inicial"

Contenido listo para pegar en el editor de mapas (**Mueble/Interactivo →
Tipo de Interactividad → "Letrero / Texto de Lectura"** → pegar el bloque en
el textarea de `InfoSignEditor`). Cada bloque de abajo es el texto completo
de un letrero, ya en el formato que soporta `InfoMarkdown`.

**Formato soportado** (no hay listas ni tablas, solo esto):
- `# Título` / `## Subtítulo` / `### Sub-subtítulo`
- `**negrita**` y `*cursiva*`
- `![alt](url)` para imágenes (subidas con el botón "⬆ Subir imagen")
- Cada línea suelta se muestra como su propio párrafo; línea en blanco = espacio.

El contenido de cada letrero está tomado literalmente de las frases que ya
enseñan los NPCs de esa misión (ver `MISIONES_MUNDO_PUEBLO.md`), para que
refuerce — no contradiga ni adelante — lo que el jugador va a practicar al
hablar con ellos.

---

## `the_village` — Aprende a saludar

### Letrero 1 — a la entrada del pueblo

```
# Bienvenido al pueblo

Aquí vas a aprender a *saludar* en inglés.
Habla con cada aldeano, uno por uno.

**Hi** / **Hey there**
Saludo informal, entre amigos.
```

### Letrero 2 — en la plaza central

```
# Cómo presentarte

**Hello, I am ___** o **Hi, I am ___**

Cuando alguien se presenta, responde:
**Nice to meet you** (o **Nice to meet you too**)

Frase completa:
**Hello, my name is ___, nice to meet you**
```

---

## `the_village_2` — Aprende a saludar 2

### Letrero 1 — small talk

```
# Small talk

**How are you?**
Se responde: **I am fine, and you?**

No olvides devolver la pregunta con *"and you?"* — es de buena educación.
```

### Letrero 2 — saludos según la hora del día

```
# Saludos formales

**Good morning** — antes del mediodía
**Good afternoon** — de mediodía a la tarde
**Good evening** — de noche

Informal, a cualquier hora: **What's up?**
```

### Letrero 3 — variantes de "¿cómo estás?"

```
# ¿Cómo estás?

Puedes responder de varias formas:

**Fine** — bien
**Great** — genial
**So so** — más o menos
```

---

## `clock_tower` — Aprende sobre la Hora

### Letrero 1 — los números

```
# Los números (1-12)

one · two · three · four · five · six
seven · eight · nine · ten · eleven · twelve

Los vas a necesitar para decir la hora.
```

### Letrero 2 — AM y PM

```
# AM y PM

**AM** — de medianoche a mediodía (mañana)
**PM** — de mediodía a medianoche (tarde / noche)

9 AM = 9 de la mañana.
2 PM = 2 de la tarde.
```

### Letrero 3 — preguntar y decir la hora

```
# ¿Qué hora es?

Para preguntar: **What time is it?**
Para responder: **It is 9:00 AM** (son las 9 en punto)

Otras formas de decir la hora:
**10 minutes past 9** — las 9 y 10
**a quarter to 9** — un cuarto para las 9 (8:45)
```

---

## Notas de colocación

- Sugerencia de ubicación: cerca de la entrada de cada mapa (letrero 1,
  contexto general) y cerca del grupo de NPCs relacionado con ese tema
  (letrero 2/3, refuerzo puntual) — así el jugador lo lee justo antes de
  necesitarlo.
- Si más adelante se agregan más misiones al World 1, mantener el mismo
  criterio: el letrero repite literalmente la frase objetivo del NPC, nunca
  introduce vocabulario que el NPC no vaya a usar.
- Estos letreros no tocan la DB (no son `mission_tasks` ni `npc_templates`);
  viven en la data serializada del mapa (furniture con `minigameType:
  'read'`), así que se colocan a mano desde el editor en cada `scene_key`.
