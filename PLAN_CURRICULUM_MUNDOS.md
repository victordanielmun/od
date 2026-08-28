# Plan de currículum — Roadmap de mundos (qué se enseña y en qué orden)

> A diferencia de `PLAN_MUNDOS.md` (arquitectura técnica) y
> `PLAN_CLONACION_MAPAS_MISION.md` (cómo construir un mundo), este documento
> responde una pregunta distinta: **¿qué mundo viene después, y por qué en
> ese orden?** El orden es pedagógico — qué necesita saber el jugador antes
> de poder aprender lo siguiente — no depende de qué contenido ya exista en
> la base de datos. Mismo principio que ya aplicamos en Mundo 2: **un mundo
> = un tema, repetido 3 veces**, nunca una mezcla de temas.

## Mundos ya construidos

| # | Clave | Nombre | Enseña |
|---|---|---|---|
| 1 | `mundo_1` | The Town | Saludos, presentarse, la hora (mezcla 3 temas — no sigue el principio, ya estaba así antes de esta sesión) |
| 2 | `mundo_2` | Pronoun Village | Pronombres personales (I/you/he/she/it/we/they), repetidos en 3 contextos |
| 3 | `mundo_3` | Career Village | `I am a/an ___` (profesiones) — 9 profesiones repartidas en 2 mapas + repaso en el 3º, mínimo 3 repeticiones resueltas por NPC |
| 4 | `mundo_4` | Village People | `You are` / `He is` / `She is a/an ___` — reusa las 9 profesiones de Mundo 3 a propósito, foco 100% en la conjugación nueva |
| 5 | `mundo_5` | Wonderland | `It is a/an [adjetivo] ___` — 9 adjetivos (good/big/small/old + new/hot/cold/fast/slow), primer contacto con adjetivos |
| 6 | `mundo_6` | No-Way Town | Negativo: `I'm not` / `you aren't` / `he/she isn't a/an ___`, contrasta con afirmativo en el mapa de repaso |
| 7 | `mundo_7` | Question Harbor | Pregunta + respuesta corta: `Are you...? Yes, I am.` / `Is he/she...? No, he isn't.` — **cierra el bloque "to be" (mundos 3-7)** |
| 8 | `mundo_8` | Possession Point | Posesivos `my/your/his/her/its/our/their` — los 7 juntos en un solo mundo (misma lógica que Mundo 2 con pronombres sujeto), repartidos my/your/his/her + its/our/their + repaso final |
| 9 | `mundo_9` | Twofold Town | `this/that/these/those`, `a/an`, plural regular `-s`, e introducción de `the` específico — singular vs. plural en 3 contextos (this/that + a/an → these/those + -s → repaso mezclado + the) |
| 10 | `mundo_10` | Daily Grove | Presente Simple **afirmativo** — forma base con I/you/we/they, forma `-s` con he/she/it. Primer mundo del bloque "presente simple" (partido en 10=afirmativo, 11=negativo, 12=pregunta, misma razón que "to be" se partió en 5) |
| 11 | `mundo_11` | Nevergreen Grove | Presente Simple **negativo** — `don't` con I/you/we/they, `doesn't` con he/she/it (el verbo vuelve a su forma base). Reusa los 5 verbos de Mundo 10 para contraste directo afirmativo→negativo |
| 12 | `mundo_12` | Boulder Query | Presente Simple **pregunta** — `Do you...? / Does he/she/it...?` + respuesta corta (`Yes, I do` / `No, he doesn't`). Reusa los mismos 5 verbos y **cierra el bloque "presente simple" (mundos 10-12)** |
| 13 | `mundo_13` | Thereabouts | `There is a/an ___` (singular) / `There are` + número + `___s` (plural) — describe qué hay en un lugar. **Cierra el Bloque A completo** (gramática base, mundos 1-13) |
| 14 | `mundo_14` | Hue Harbor | Colores (red/blue/green/yellow/orange/purple/black/white/brown) con `It is a/an [color] [sustantivo]` — reusa el patrón de Mundo 5 sin gramática nueva. Primer mundo del Bloque B (vocabulario) |
| 15 | `mundo_15` | Critter Cove | Animales (dog/cat/bird/fish/lion/elephant/rabbit/horse/monkey) con `This is a/an [animal]. It lives in/on [lugar]` — reusa "this is" (Mundo 9) + "it + verbo-s" (Mundo 10) sin gramática nueva |
| 16 | `mundo_16` | Hearthwood | Familia (mother/father/brother/sister/grandmother/grandfather/aunt/uncle/cousin) con `This is [posesivo] [familiar]` / `He-She is [posesivo] [familiar]` — reusa posesivos (Mundo 8) sin gramática nueva |
| 17 | `mundo_17` | Tally Town | Números 13-20 con `There are [número] [sustantivo]` (Mundo 13) + pregunta `How many [sustantivo] are there?` |
| 18 | `mundo_18` | Snack Shore | Comida y bebidas (bread/rice/chicken/milk/water/juice/cheese/eggs/fish) con `I like ___` (afirmativo, Mundo 10) / `I don't like ___` (negativo, Mundo 11) — sin gramática nueva |
| 19 | `mundo_19` | Anatomy Grove | Cuerpo (head/nose/mouth/stomach con `This is my ___`, sin gramática nueva) + eyes/hands/legs/arms/ears con **have/has** — primer contacto con el verbo `have`, `has` explicado como excepción irregular (no "haves") |
| 20 | `mundo_20` | Household Hollow | La casa (kitchen/bedroom/bathroom/living room con `This is the ___`) + table/bed/chair/book/lamp con preposiciones **in** (dentro) / **on** (encima) — primer contacto con preposiciones de lugar, anticipo del Bloque C. **Cierra el Bloque B completo (mundos 14-20)** |
| 21 | `mundo_21` | Position Point | Preposiciones de lugar **under** (debajo)/**next to** (al lado)/**between** (entre, dos lugares) — completa el trío empezado en Mundo 20 (in/on). **Primer mundo del Bloque C** |
| 22 | `mundo_22` | Motion Meadow | Presente Continuo `am/is/are + verbo-ing` — describe acciones que pasan AHORA, contraste directo con presente simple (mundos 10-12) |
| 23 | `mundo_23` | Can-Do Cavern | Modal `can` (habilidad, afirmativo) / `can't` (negativo) — punto clave: nunca cambian de forma, ni con he/she/it (nunca "cans"/"can'ts") |
| 24 | `mundo_24` | Yesterday Yard | Pasado Simple regular **afirmativo** (`-ed`), sin cambios por sujeto. Primer mundo del trío "pasado simple regular" (24=afirmativo, 25=negativo, 26=pregunta), partido por la misma razón que "to be" y presente simple |
| 25 | `mundo_25` | Didn't Dell | Pasado Simple regular **negativo** — `didn't` + verbo base (nunca "didn't played"). Reusa los 9 verbos de Mundo 24 para contraste directo afirmativo→negativo |
| 26 | `mundo_26` | Query Quarry | Pasado Simple regular **pregunta** — `Did...?` + verbo base + respuesta corta (`Yes, I did` / `No, he didn't`). `Did` es igual para TODOS los sujetos (a diferencia de do/does). **Cierra el trío "pasado simple regular" (mundos 24-26)** |
| 27 | `mundo_27` | Memory Mine | Verbos irregulares comunes (go/have/see/do/eat/make/take/come/get) — memorización pura, no una regla nueva. En negativo/pregunta vuelven a forma base igual que los regulares. **Cierra el bloque completo de pasado simple (mundos 24-27)** |
| 28 | `mundo_28` | Superlative Sands | Comparativos (`adjetivo-er + than`) y superlativos (`the + adjetivo-est/most`) — reusa adjetivos de Mundo 5 + el irregular `good→better→best` + dos adjetivos largos nuevos (`beautiful`, `expensive`) para el patrón `more/most` |
| 29 | `mundo_29` | Tomorrow Town | Futuro `going to` (plan ya decidido, reusa am/is/are) vs `will` (espontáneo/promesa/predicción, sin "to be"). **Cierra el Bloque C completo (mundos 21-29)** y el bloque de tiempos verbales |

## Por qué este orden y no otro

El inglés básico se construye en capas: cada mundo nuevo asume que el
jugador ya puede usar todo lo de los mundos anteriores. El orden de abajo
sigue la progresión estándar de un curso de inglés A1 (principiante):

```
Saludos → Pronombres → Verbo "to be" → Posesivos → Plural/Articulos
   → Presente Simple → Vocabulario básico (en paralelo)
   → There is/are → Preposiciones de lugar → Presente Continuo
   → Can/Can't → Pasado Simple → Comparativos → Futuro
```

Los mundos de **vocabulario** (colores, animales, comida, familia) no
tienen prerequisito estricto entre sí — se pueden intercalar en cualquier
punto para variar el ritmo — pero sí deberían venir **después** de tener
pronombres + "to be", porque las frases de práctica de vocabulario
("It is red", "She is my sister") ya asumen esa base.

## Roadmap propuesto

### Bloque A — Gramática base, en pasos granulares

**Corrección de enfoque**: en vez de un mundo grande "El Verbo To Be" que
mezcle afirmativo + negativo + pregunta de una sola vez, se parte en pasos
mucho más chicos — **un mundo = una sola frase-patrón**, repetida con
vocabulario distinto (igual filosofía que Mundo 2, pero aplicada a una
unidad más pequeña que "toda la gramática de to be"). Cada paso agrega
una sola pieza nueva sobre el anterior.

| # | Mundo | Patrón único que repite | Ejemplos (vocabulario que varía) | Por qué va aquí |
|---|---|---|---|---|
| 3 | **Yo soy...** | `I am a/an ___` (identidad/profesión, sin negar ni preguntar todavía) | *I am a farmer. I am a student. I am a teacher. I am a doctor.* | Extiende directo el "I am" que Mundo 2 ya usó para practicar el pronombre — ahora es el foco, no un ejemplo de paso |
| 4 | **Tú eres / Él es / Ella es...** | `You are` / `He is` / `She is` `a/an ___` (mismo patrón, agregando personas) | *You are a student. He is a farmer. She is a teacher.* | Ya domina "I am a ___" (mundo 3); ahora extiende el mismo patrón a las otras personas |
| 5 | **Eso es un/a... (bueno/grande/etc)** | `It is a/an [adjetivo] ___` (describir objetos/animales, primer adjetivo) | *It is a good dog. It is a big house. It is a small cat.* | Introduce UN adjetivo a la vez sobre "it is" ya conocido — primer contacto con adjetivos, sin acumular más gramática |
| 6 | **No soy / No es...** | Negativo: `I'm not`, `You aren't`, `He isn't a/an ___` | *I'm not a doctor. He isn't a farmer.* | Recién acá negativo — después de que las 3 formas afirmativas (mundos 3-5) ya están firmes |
| 7 | **¿Eres...? / ¿Es...?** | Pregunta: `Are you...?`, `Is he/she/it...?` + respuesta corta (`Yes, I am` / `No, he isn't`) | *Are you a student? Yes, I am.* | Cierre del bloque "to be" — pregunta y respuesta corta, la pieza que faltaba |
| 8 | **Posesivos** | `my/your/his/her/its/our/their` | *This is my book.* | Necesita pronombres (mundo 2) resueltos |
| 9 | **Plural y Artículos** | `a/an/the`, plural `-s`, `this/that/these/those` | *These are books.* | Antes de vocabulario que cuenta cosas |
| 10 | **Presente Simple — afirmativo** | Forma base con I/you/we/they, forma `-s` con he/she/it | *I play. She plays.* | Depende de pronombres + to be sólidos. Partido en 3 pasos (10-12) igual que "to be" |
| 11 | **Presente Simple — negativo** | `don't` / `doesn't` | *I don't play. She doesn't play.* | Recién acá negativo, después de que el afirmativo (mundo 10) esté firme |
| 12 | **Presente Simple — pregunta** | `Do you...? / Does he...?` + respuesta corta | *Does she play? Yes, she does.* | Cierre del bloque presente simple |
| 13 | **There is / There are** | Describir qué hay en un lugar | *There is a cat. There are two dogs.* | Depende de plural (mundo 9) |

**Nota**: esto alarga el roadmap (7 mundos en vez de 1 para cubrir "to be"
completo), a propósito — es el costo de ir lento y que cada paso sea
sólido antes del siguiente, en vez de un mundo grande donde el jugador ve
3 formas nuevas a la vez.

### Bloque B — Vocabulario funcional (COMPLETO — mundos 14-20, ver tabla "Mundos ya construidos")

| # | Mundo | Clave/Nombre | Enseña |
|---|---|---|---|
| 14 | Colores | `mundo_14` Hue Harbor | Colores básicos + "It is + color" |
| 15 | Animales | `mundo_15` Critter Cove | Animales comunes + "This is a/an ___. It lives in/on ___" |
| 16 | Familia | `mundo_16` Hearthwood | Miembros de la familia + posesivos ("my mother", "his brother") |
| 17 | Números y Cantidades | `mundo_17` Tally Town | Contar más allá de 12, "how many...are there?" |
| 18 | Comida y Bebidas | `mundo_18` Snack Shore | Vocabulario + "I like / I don't like" |
| 19 | El Cuerpo | `mundo_19` Anatomy Grove | Partes del cuerpo + primer contacto con "have/has" |
| 20 | La Casa | `mundo_20` Household Hollow | Habitaciones y objetos del hogar + preposiciones `in`/`on` (anticipo Bloque C) |

### Bloque C — Gramática intermedia temprana (después del Bloque A y B completos)

| # | Mundo | Enseña | Por qué va aquí |
|---|---|---|---|
| 21 | **Preposiciones de Lugar** | `under/next to/between` (`in`/`on` ya vistos en Mundo 20) | Se apoya en vocabulario de casa/objetos (Bloque B) |
| 22 | **Presente Continuo** | `-ing`, "what are you doing?" | Contraste directo con presente simple (mundos 10-12) — se enseña mejor cuando el simple ya está firme |
| 23 | **Can / Can't** | Habilidad y permiso | Estructura corta, buen "descanso" antes del pasado |
| 24 | **Pasado Simple regular — afirmativo** | `-ed`, sin cambios por sujeto | El salto grande siguiente; partido en 3 pasos (24-26) igual que "to be" y presente simple |
| 25 | **Pasado Simple regular — negativo** | `didn't` + verbo base | Recién acá negativo, después de que el afirmativo (mundo 24) esté firme |
| 26 | **Pasado Simple regular — pregunta** | `Did...?` + verbo base + respuesta corta | Cierre del bloque "pasado simple regular" |
| 27 | **Pasado Simple (verbos irregulares comunes)** | `went/had/saw/did` etc. | Mundo aparte porque es memorización pura, no una regla nueva |
| 28 | **Comparativos y Superlativos** | `bigger/the biggest`, `more/most` | Necesita adjetivos (ya tocados en Bloque B) |
| 29 | **Futuro** | `going to` vs `will` | Cierre natural del bloque de tiempos verbales |

## Estructura de contenido por mundo (recordatorio, ya validada con Mundo 2)

Cada mundo = **6 mapas**: 3 de diálogo (mismo tema, 3 contextos distintos,
NO progresión de sub-temas) + **2** de combate + 1 de jefe examen — calcado
de World 1 (`the_village`×3 + `combate_town_1`+`combate_town_2` +
`combat_town_boss`). Los dos mapas de combate importan porque sus Ninja
Cards sacan del mismo pool de tags del mundo — es una repetición más del
tema antes del examen, no relleno. El diseño de tiles se varía por mundo
(ver `scripts/world-builder/README.md`, puntos 6-7) para que no se repita
el paisaje entre mundos.

## Qué NO decide este roadmap

- **No asume qué preguntas de `learning_challenges` ya existen** — eso se
  resuelve mundo por mundo al construirlo (puede que haya que redactar
  todo el pool nuevo, o que se pueda reusar algo ya tageado; es un detalle
  de implementación, no de currículum).
- **No fija fechas ni obliga orden de juego** — como ya está decidido en
  `PLAN_MUNDOS.md`, no hay prerequisitos técnicos, el jugador puede entrar
  a cualquier mundo. Este roadmap ordena en qué secuencia **conviene
  construirlos** para que el contenido tenga sentido pedagógico si el
  jugador sí los sigue en orden.
- **Pronunciación** queda fuera de este roadmap — es un tipo de challenge
  distinto (`type=pronunciation`) que ya existe en la base y probablemente
  merece su propio track paralelo, no mundos de diálogo/combate.

## Próximo paso sugerido

Con Mundo 29 se cierra el **Bloque C completo** (gramática intermedia
temprana, mundos 21-29) — y con él, toda la gramática básica-intermedia
planificada en este roadmap (mundos 1-29). Los bloques de vocabulario
(Bloque B) y gramática (Bloques A y C) están completos. Próximos pasos
posibles, a decidir con el usuario: (a) ampliar el Bloque B con más
mundos de vocabulario no construidos aún (Comida ya está, pero temas
como Ropa, Clima, Deportes, Trabajo quedan abiertos), (b) extender el
roadmap hacia gramática más avanzada (presente perfecto, voz pasiva,
condicionales), o (c) considerar el currículum de gramática básica
"terminado" y enfocar el esfuerzo en pulir/expandir los 29 mundos
existentes (más variantes de vocabulario, refuerzo, contenido
opcional).
