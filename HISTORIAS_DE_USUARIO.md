# 📖 Historias de Usuario — Odyssey (Gather RPG + English Learning)

> Formato: **Como** \<rol\>, **quiero** \<acción\>, **para** \<beneficio\>.
> Cada historia incluye criterios de aceptación (CA). Derivadas de los roles del sistema
> (`admin`, `user`, invitado) y de las funcionalidades implementadas en el backend.

---

## 🎭 Actores del sistema

| Actor | Descripción | Identificación técnica |
|-------|-------------|------------------------|
| **Invitado** | Entra sin registrarse, prueba el juego con datos efímeros | `IsGuest = true` |
| **Jugador / Estudiante** | Usuario registrado que aprende inglés jugando | `Role = "user"` |
| **Administrador** | Diseña mapas, NPCs, retos, misiones, ítems y campañas | `Role = "admin"` |
| **Sistema / IA** | Procesos automáticos (LLM, TTS, traducción, WhatsApp) | servicios internos |

---

## 🟢 Invitado

### HU-G1 — Acceso rápido como invitado
**Como** invitado, **quiero** entrar con un solo clic ("Guest Login"), **para** probar el juego sin registrarme.
- **CA1:** Un botón "Guest Login" crea una sesión sin pedir email/contraseña.
- **CA2:** Se me asigna un personaje y entro directamente al lobby.
- **CA3:** Mi cuenta queda marcada como invitada (`is_guest`).

### HU-G2 — Convertirme en usuario registrado
**Como** invitado, **quiero** registrarme conservando mi avance, **para** no perder mi progreso.
- **CA1:** Desde la sesión de invitado puedo completar el registro (username, email, contraseña, idioma nativo).
- **CA2:** Tras registrarme, mi progreso de juego y perfil de inglés se mantienen.

---

## 🔵 Jugador / Estudiante (`user`)

### Autenticación y perfil

### HU-U1 — Registro con idioma nativo
**Como** jugador, **quiero** registrarme indicando mi idioma nativo, **para** recibir ayudas traducidas a mi idioma.
- **CA1:** El registro pide username, email, contraseña e idioma nativo (ISO-639-1: `es`, `pt`, `fr`...).
- **CA2:** El idioma de aprendizaje siempre es inglés (`en`).
- **CA3:** Si no elijo idioma, se asume inmersión total (`en`, sin ayudas).

### HU-U2 — Inicio de sesión
**Como** jugador, **quiero** iniciar sesión con email y contraseña, **para** recuperar mi cuenta y progreso.
- **CA1:** Login válido devuelve un token JWT y los datos del usuario.
- **CA2:** Credenciales inválidas devuelven error sin filtrar cuál campo falló.

### HU-U3 — Aceptar términos y condiciones
**Como** jugador, **quiero** aceptar los términos una vez, **para** cumplir con los requisitos legales del juego.
- **CA1:** Si no he aceptado términos (`terms_accepted = false`), se me solicita antes de jugar.
- **CA2:** Tras aceptar, no se vuelve a pedir.

### HU-U4 — Elegir y cambiar mi avatar (sprite)
**Como** jugador, **quiero** elegir el aspecto de mi personaje, **para** personalizar mi identidad en el mapa.
- **CA1:** Puedo seleccionar un sprite; queda registrado (`has_chosen_sprite`).
- **CA2:** Puedo cambiarlo después desde mi perfil.

### HU-U5 — Cambiar mi idioma nativo
**Como** jugador, **quiero** cambiar mi idioma nativo en cualquier momento, **para** ajustar el nivel de ayudas.
- **CA1:** Al cambiar el idioma, las ayudas y traducciones de NPC se generan en el nuevo idioma.

### HU-U6 — Elegir un NPC compañero
**Como** jugador, **quiero** elegir un NPC compañero, **para** tener una guía durante mi aventura.
- **CA1:** Puedo asignar un `companion_npc_id` desde la lista de guías disponibles.

### Mundo / multijugador

### HU-U7 — Caminar en el mapa en tiempo real
**Como** jugador, **quiero** moverme por el mapa y ver a otros jugadores, **para** vivir una experiencia multijugador.
- **CA1:** Mi posición se sincroniza por WebSocket en tiempo real.
- **CA2:** Veo a otros jugadores moverse y entrar/salir de la sala.

### HU-U8 — Entrar a salas/escenas y teletransportarme
**Como** jugador, **quiero** entrar a distintas salas (lobby, edificios), **para** explorar el mundo y acceder a actividades.
- **CA1:** Puedo ver las salas públicas disponibles.
- **CA2:** Los teletransportes cargan la nueva escena sin demoras notables (cache de map-config).

### HU-U9 — Leer letreros de información traducidos
**Como** jugador, **quiero** leer letreros informativos en mi idioma nativo, **para** entender las instrucciones del juego.
- **CA1:** El texto del letrero se traduce a mi idioma nativo (cacheado por hash).
- **CA2:** El arte del letrero se muestra correctamente.

### Aprendizaje de inglés (núcleo educativo)

### HU-U10 — Practicar pronunciación por voz
**Como** estudiante, **quiero** grabar mi voz y recibir análisis de pronunciación, **para** mejorar mi inglés hablado.
- **CA1:** Puedo grabar audio y el sistema (Whisper/IA) lo evalúa.
- **CA2:** Recibo retroalimentación sobre mi pronunciación.

### HU-U11 — Resolver retos de inglés
**Como** estudiante, **quiero** recibir retos aleatorios adecuados a mi nivel, **para** practicar de forma progresiva.
- **CA1:** `GET /learning/challenges/random` devuelve un reto acorde a mi nivel.
- **CA2:** El enunciado y ayudas se muestran en mi idioma nativo cuando aplica.

### HU-U12 — Registrar intentos y ver mi progreso
**Como** estudiante, **quiero** que mis intentos queden guardados, **para** seguir mi evolución.
- **CA1:** Cada intento se registra (`POST /learning/attempts`).
- **CA2:** Puedo consultar mi perfil de aprendizaje y estadísticas.

### HU-U13 — Establecer mi nivel de inglés
**Como** estudiante, **quiero** indicar/ajustar mi nivel de inglés, **para** recibir contenido apropiado.
- **CA1:** Puedo fijar mi nivel (`PUT /learning/profile/level`).

### HU-U14 — Ver el ranking (leaderboard)
**Como** estudiante, **quiero** ver una tabla de clasificación, **para** motivarme comparando mi avance.
- **CA1:** El leaderboard es accesible y muestra a los mejores jugadores.

### HU-U15 — Escuchar pronunciación correcta (TTS)
**Como** estudiante, **quiero** escuchar cómo se pronuncia una palabra/frase, **para** imitar el modelo correcto.
- **CA1:** `POST /tts/generate` produce audio reproducible.
- **CA2:** El audio se sirve cacheado por clave.

### NPCs e IA conversacional

### HU-U16 — Conversar con NPCs con IA
**Como** jugador, **quiero** hablar con NPCs que responden de forma inteligente, **para** practicar inglés en contexto.
- **CA1:** Al interactuar (tecla **E**), el NPC responde mediante IA.
- **CA2:** Las respuestas pueden incluir traducción nativa de apoyo.

### HU-U17 — Recibir guía de NPCs guía
**Como** jugador nuevo, **quiero** que NPCs guía me orienten, **para** entender qué hacer.
- **CA1:** Existe una lista de NPCs guía consultable.

### Misiones

### HU-U18 — Ver misiones disponibles por escena y por NPC
**Como** jugador, **quiero** ver qué misiones hay en una escena o NPC, **para** decidir qué hacer.
- **CA1:** Puedo listar misiones por escena y por NPC.

### HU-U19 — Aceptar y completar misiones
**Como** jugador, **quiero** aceptar misiones y validar su cumplimiento, **para** progresar y obtener recompensas.
- **CA1:** Puedo aceptar una misión (`POST /missions/:id/accept`).
- **CA2:** El sistema valida la completitud y otorga recompensas.

### HU-U20 — Completar misiones de karaoke
**Como** estudiante, **quiero** completar retos de karaoke (cantar/pronunciar), **para** practicar fluidez de forma divertida.
- **CA1:** `POST /missions/karaoke/complete` registra el resultado.

### HU-U21 — Progreso de misiones por matar enemigos
**Como** jugador, **quiero** que derrotar enemigos cuente para mis misiones, **para** avanzar combatiendo.
- **CA1:** Al derrotar un enemigo (vía Ninja Card), el progreso de misión de tipo "kill" se actualiza.

### Inventario, ítems y combate

### HU-U22 — Recoger ítems del mapa
**Como** jugador, **quiero** recoger objetos repartidos por el mapa, **para** equiparme y avanzar.
- **CA1:** Los pickups son por jugador (`MapPickupClaim`) y se reinician por intento al (re)entrar a la escena.
- **CA2:** Puedo ver y reclamar pickups de una escena.

### HU-U23 — Gestionar y usar mi inventario
**Como** jugador, **quiero** ver y usar mis ítems, **para** beneficiarme de sus efectos.
- **CA1:** Puedo consultar mi inventario y usar un ítem (`POST /inventory/use/:id`).

### HU-U24 — Comprar en tiendas de NPC
**Como** jugador, **quiero** comprar ítems a NPCs comerciantes, **para** mejorar mi equipo.
- **CA1:** Puedo ver los ítems de la tienda de un NPC y comprarlos.

### HU-U25 — Combatir enemigos
**Como** jugador, **quiero** enfrentar enemigos con mis habilidades, **para** superar desafíos del mundo.
- **CA1:** El combate usa cartas/habilidades (Ninja Card), no daño directo a HP.

### Social

### HU-U26 — Gestionar amigos
**Como** jugador, **quiero** enviar/aceptar/rechazar solicitudes de amistad, **para** construir mi red social.
- **CA1:** Puedo listar amigos, enviar solicitudes y aceptarlas/rechazarlas.
- **CA2:** Puedo eliminar a un amigo.

### HU-U27 — Mensajería directa
**Como** jugador, **quiero** chatear con mis amigos, **para** coordinarnos y socializar.
- **CA1:** Puedo ver el historial de conversación con un amigo.

### Recordatorios por WhatsApp

### HU-U28 — Vincular mi WhatsApp
**Como** estudiante, **quiero** vincular mi número de WhatsApp, **para** recibir práctica y recordatorios fuera del juego.
- **CA1:** Puedo registrar/actualizar mi contacto y consultar el estado de conexión.

### HU-U29 — Recibir frases y recordatorios de práctica
**Como** estudiante, **quiero** recibir frases motivacionales y recordatorios programados, **para** mantener el hábito de estudio.
- **CA1:** El sistema envía frases/recordatorios según una programación (scheduler).

---

## 🔴 Administrador (`Role = "admin"`)

> Todas las rutas `/admin/*` requieren autenticación **y** rol admin (`AdminOnly`).

### Mapas y escenas

### HU-A1 — Diseñar y editar mapas
**Como** admin, **quiero** crear/editar/eliminar configuraciones de mapa, **para** construir el mundo del juego.
- **CA1:** Puedo listar, crear, actualizar y borrar map-configs.
- **CA2:** Puedo entrar al editor con `?edit_map=<escena>` siendo admin.
- **CA3:** Los mapas grandes (JSON hasta 50 MB) se guardan correctamente.

### HU-A2 — Gestionar letreros de información
**Como** admin, **quiero** subir/listar/borrar el arte de letreros, **para** documentar el mundo dentro del juego.
- **CA1:** Puedo subir imágenes de letreros y eliminarlas.

### NPCs

### HU-A3 — Definir NPCs (definiciones y plantillas)
**Como** admin, **quiero** crear definiciones y plantillas de NPC, **para** poblar el mundo con personajes reutilizables.
- **CA1:** CRUD de NPC definitions y NPC templates.
- **CA2:** Puedo asignar plantillas a escenas e instancias por escena.

### HU-A4 — Configurar el comportamiento de IA de un NPC
**Como** admin, **quiero** editar las instrucciones/personalidad de cada NPC, **para** controlar cómo conversa con los jugadores.
- **CA1:** Puedo parchear instrucciones de una plantilla.
- **CA2:** Puedo asociar misiones a una plantilla de NPC.

### HU-A5 — Probar la IA antes de publicar
**Como** admin, **quiero** un endpoint de prueba de IA (`/admin/ai-test`), **para** validar respuestas sin afectar a jugadores.
- **CA1:** Puedo enviar un prompt de prueba y ver la respuesta del LLM.

### HU-A6 — Consultar voces TTS disponibles
**Como** admin, **quiero** ver las voces TTS disponibles, **para** asignarlas a NPCs.
- **CA1:** `GET /admin/voices` lista las voces.

### Contenido educativo

### HU-A7 — Gestionar retos de inglés
**Como** admin, **quiero** crear/editar/eliminar/importar retos, **para** mantener el contenido educativo actualizado.
- **CA1:** CRUD de challenges + importación masiva (`/admin/challenges/import`).

### Economía del juego (ítems, tiendas, enemigos)

### HU-A8 — Gestionar ítems
**Como** admin, **quiero** administrar ítems y sus sprites, **para** definir el equipamiento del juego.
- **CA1:** CRUD de items; listado de sprites de ítems disponibles.

### HU-A9 — Gestionar tiendas
**Como** admin, **quiero** crear/editar/eliminar tiendas, **para** definir qué venden los NPCs comerciantes.
- **CA1:** CRUD de shops.

### HU-A10 — Gestionar enemigos y habilidades
**Como** admin, **quiero** administrar enemigos y skills, **para** balancear el combate.
- **CA1:** CRUD de enemies; listado de skills.

### Misiones (diseño de campañas)

### HU-A11 — Diseñar misiones y tareas
**Como** admin, **quiero** crear misiones con sus tareas, **para** estructurar la progresión del jugador.
- **CA1:** CRUD de missions y de tasks de cada misión.
- **CA2:** Puedo ver/asignar roles de NPC en una misión.

### HU-A12 — Internacionalizar contenido automáticamente
**Como** admin, **quiero** que misiones/tareas se traduzcan a los idiomas configurados, **para** llegar a jugadores de distintos idiomas sin trabajo manual.
- **CA1:** Las traducciones se pre-calientan en segundo plano para los idiomas configurados.

### Campañas de WhatsApp

### HU-A13 — Administrar instancias de WhatsApp
**Como** admin, **quiero** gestionar instancias y el QR global de WhatsApp, **para** operar el canal de recordatorios.
- **CA1:** Puedo listar/eliminar instancias y ver el estado/QR global.

---

## ⚙️ Sistema / IA (historias técnicas)

### HU-S1 — Traducción de ayudas bajo demanda y cacheada
**Como** sistema, **quiero** traducir textos de ayuda al idioma nativo del jugador y cachearlos, **para** no repetir llamadas LLM costosas.
- **CA1:** Las traducciones de retos/NPCs/letreros se cachean (por idioma / por hash).

### HU-S2 — Pre-calentado de cachés en el arranque
**Como** sistema, **quiero** pre-cargar map-config y traducciones de misiones al iniciar, **para** evitar latencias en la primera carga.
- **CA1:** El primer teletransporte y la primera apertura de diálogo no esperan al LLM ni a la DB remota.

### HU-S3 — Proveedor de IA configurable
**Como** sistema, **quiero** seleccionar el proveedor de IA (OpenAI / Mistral / DeepSeek), **para** adaptarme a costos y disponibilidad.
- **CA1:** El proveedor y modelo se eligen por configuración.

### HU-S4 — Observabilidad
**Como** operador, **quiero** endpoints de salud y métricas, **para** monitorear el servicio.
- **CA1:** `/health` responde estado y `/metrics` expone métricas Prometheus.

---

## 🗺️ Resumen de cobertura

| Épica | Historias |
|-------|-----------|
| Onboarding / Auth | HU-G1, HU-G2, HU-U1–U6 |
| Mundo multijugador | HU-U7–U9 |
| Aprendizaje de inglés | HU-U10–U15, HU-U20 |
| NPCs e IA | HU-U16, HU-U17, HU-A3–A6 |
| Misiones | HU-U18–U21, HU-A11, HU-A12 |
| Inventario / Economía / Combate | HU-U22–U25, HU-A8–A10 |
| Social | HU-U26, HU-U27 |
| WhatsApp | HU-U28, HU-U29, HU-A13 |
| Administración de mundo/contenido | HU-A1, HU-A2, HU-A7 |
| Plataforma / IA | HU-S1–S4 |
