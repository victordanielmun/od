# Mundo "Pueblo Inicial" (World ID 1) — Misiones y tareas

> Fuente: consulta directa a la Postgres de producción (EC2, `missions` +
> `mission_tasks` + `npc_templates` + `npc_definitions`), no al dump
> `gather_rpg.sql` del repo (desactualizado desde la reconstrucción de la DB
> del 2026-07-19). Última verificación: 2026-08-20.
>
> Para volver a consultar: abrir túnel SSH hacia la EC2
> (`ssh -f -N -L 5433:127.0.0.1:5433 -i od3.pem ec2-user@3.14.9.51`, correr
> desde la raíz del repo donde está `od3.pem`) y apuntar `DB_HOST=127.0.0.1
> DB_PORT=5433` con las credenciales de `gather-rpg-backend/.env`. Cerrar el
> túnel al terminar (`taskkill /F /PID <pid de ssh.exe>`).

Las 3 misiones son `talk_to_npc`, individuales, gratis (`is_premium=false`),
dificultad `beginner`, sin `challenge_tags` propios (heredan el pool del
World 1). Recompensa en las tres: **25,000 gold + 2,000 XP + 1 ítem**
(`the_village` y `clock_tower` comparten el mismo `reward_item_id`
`...a788f`; `the_village_2` usa uno distinto, `...a7890`).

---

## 1. `the_village` — "Aprende a saludar" (mission id 1, order_in_world=0)

Objetivo: *Saluda a los aldeanos*.

| # | NPC (npc_template) | Qué enseña | Frase objetivo | Mensaje de éxito |
|---|---|---|---|---|
| 1 | **Mochi** (id 6) | Da la bienvenida, pregunta "You are ready?" para arrancar el viaje | — | "Great! Let's go." |
| 2 | **Joy** (id 1) | Saludo informal entre amigos: `Hi` / `Hey there` | Hi / Hey there | "Aweson you are great, go to talk with the other villagers" |
| 3 | **Ann** (id 2) | Presentarse: `Hello I am ___` / `Hi I am ___` | Hello I am ___ | "Nice to meet you" |
| 4 | **Sam** (id 3) | Responder a una presentación: `Nice to meet you` / `Nice to meet you too` | Nice to meet you (too) | "Great to meet you" |
| 5 | **Amy** (id 4) | Flujo completo de presentación: `Hello, my name is ___, nice to meet you` | Hello, my name is ___, nice to meet you | "Great to meet you" |

Progresión pedagógica: bienvenida → saludo casual → fórmula de
presentación → respuesta a la presentación → presentación completa
encadenada.

---

## 2. `the_village_2` — "Aprende a saludar 2" (mission id 3, order_in_world=1)

Objetivo: *Saluda a los aldeanos* (mismo objetivo, sube el nivel: small talk
en vez de solo presentarse).

| # | NPC (npc_template) | Qué enseña | Frase objetivo | Mensaje de éxito |
|---|---|---|---|---|
| 1 | **Joy** (id 7) | `How are you?` → responder `I am fine` y devolver la pregunta (`and you?`) | I am fine, and you? | "Go talk to the other villagers" |
| 2 | **Ann** (id 8) | Saludo informal `What's up?` | What's up? | "Go talk to the other villagers" |
| 3 | **Sam** (id 9) | Saludos formales según momento del día: `Good morning` / `Good afternoon` / `Good evening` (las 3) | Good morning / afternoon / evening | "Go talk to the other villagers" |
| 4 | **Zoe** (id 10) | Variantes de respuesta a `How are you?`: `fine`, `great`, `so so` (las 3) | fine / great / so so | "Go talk to the other villagers" |
| 5 | **Tom** (id 11) | Intercambio completo: saludo + respuesta + `how are you?` | Hello, how are you? | "Awesome! You are great" |

Progresión: retomar cortesía (`and you?`) → variante informal → saludos
formales por franja horaria → variantes de respuesta de estado → diálogo
completo encadenado.

---

## 3. `clock_tower` — "Aprende sobre la Hora" (mission id 4, order_in_world=2)

Objetivo: *Aprende sobre la Hora*. Combina repaso de saludo con vocabulario
nuevo de horas.

| # | NPC (npc_template) | Qué enseña | Frase objetivo | Mensaje de éxito |
|---|---|---|---|---|
| 1 | **Toro** (id 18) | Números del 1 al 12 (base para decir la hora) | contar 1–12, incl. 8, 11, 3 | "Great! Now you have learned to count from 1 to 12." |
| 2 | **Ann** (id 21) | AM vs PM (mañana / tarde) | 9AM = morning, 2PM = afternoon | "Good! Now you can tell the difference between morning and afternoon." |
| 3 | **Tom** (id 22) | Decir la hora cuando te la preguntan | "What time is it?" → respuesta correcta | "Thanks! That's correct. I am late, see you later!" |
| 4 | **Joy** (id 20) | Preguntar la hora | "What time is it?" | "Great! You asked correctly. It is 9:00 AM." |
| 5 | **Sam** (id 19) | Expresiones de hora relativa: `10 minutes past 9`, `a quarter to 9` | 10 minutes past / a quarter to | "Excellent work! You have mastered these time expressions. Mission accomplished!" |

Progresión: números → AM/PM → responder la hora → preguntar la hora →
expresiones de hora relativa (la más avanzada, al final).

---

## Notas generales

- La tabla `npc_mission_roles` está **vacía en toda la DB** (no solo para
  estas 3 misiones) — no es un dato faltante de estas misiones puntuales,
  simplemente esa tabla no se usa actualmente en el flujo real.
- NPCs con el mismo nombre en distintas misiones (Ann, Sam, Joy, Tom) son
  `npc_templates` distintos por `scene_key`, cada uno con su propio
  `instructions`/`greeting`/`success_message` — no comparten estado ni
  guión entre misiones.
- El campo `instructions` de cada NPC es el prompt real que usa la IA para
  conducir la conversación; `greeting` es la primera línea que dice el NPC;
  `success_message` es lo que dice al completar la tarea. Estos tres campos
  son la fuente de verdad de "qué se enseña" — más confiable que
  `description_en` de la tarea, que es solo la instrucción corta mostrada
  al jugador en el log de misión.
