# Tácticas de Onboarding, Paywall y Monetización

Resumen de 25 tácticas (fuente: libro/resumen sobre growth de apps) con notas de aplicabilidad a **Odisea** (`com.odisea.app`, web + wrapper Android vía Capacitor, backend Go, pagos Wompi directo).

---

## Las 25 tácticas

### Paywall y pricing

**1. Funnel de paywall en 4 pasos**
En vez de una sola pantalla de pago, contar una narrativa progresiva: (1) oferta — prueba gratis de 7 días; (2) reductor de ansiedad — "te avisamos 2 días antes de cobrar"; (3) bono por tiempo limitado si empieza ya; (4) cierre con pantalla de pago mostrando el ahorro anual.

**16. Paywalls de 3 pantallas vs. 1 pantalla**
Abarrotar precio + beneficios + testimonios en una sola pantalla abruma. Dividir en 3 pantallas secuenciales genera confianza progresiva antes de pedir el pago.

**18. Paywall implacable (relentless paywall)**
Capas sucesivas de conversión: si rechaza la suscripción → descuento; si rechaza de nuevo → ruleta de premios; dentro de la app → banner fijo de oferta limitada; al reabrir la app → temporizador o venta de contenido único.

**6. Recompensar los permisos de notificaciones**
No pedir notificaciones al inicio sin contexto. Esperar a una acción clave del usuario y dar una recompensa inmediata (monedas, puntos) por aceptar.

**22. Permiso de notificaciones basado en elección**
En vez de "¿Permites notificaciones?", preguntar "¿A qué hora prefieres tu recordatorio?". Al elegir la hora y confirmar, el diálogo del sistema se siente como cumplir su propia decisión.

**23. Optimizar el offboarding (cancelación / desinstalación)**
Aprovechar el flujo de cancelación (o el menú de desinstalar en Android) para ofrecer un último incentivo — 50% de descuento, soporte — recuperando 5-10% de usuarios.

### Onboarding y psicología

**2. Psicología del compromiso (contrato digital)**
Pedir al usuario que "firme" o dibuje un compromiso con su meta durante el onboarding. El gesto visual aumenta el apego y la retención.

**4. Transformación antes/después**
No listar features: mostrar el impacto en la vida del usuario — "sin la app" (frustrado, lento) vs. "con la app" (enfocado, constante).

**5. Onboarding largo para suavizar el paywall**
Preguntas sobre hábitos/metas/preferencias generan costo hundido (inversión de tiempo). Cuando aparece el paywall, se siente como el paso lógico para proteger el plan personalizado.

**7. Primeras impresiones que venden**
Sustituir "Continuar"/"Comenzar" por mensajes que venden valor directo: "Prueba 7 días sin riesgo", "Tus datos son 100% privados".

**12. Los 4 elementos indispensables del onboarding**
Confianza (estudios/expertos/datos), Resultado (logro claro), Tiempo para el resultado, Prueba social (testimonios).

**14. Tácticas contraintuitivas en iOS/apps**
Los onboardings largos retienen mejor; pedir notificaciones/calificaciones temprano funciona *si hay contexto*; la mayoría de ventas ocurren antes de que el usuario pruebe la app.

**20. Onboarding largo convertido en juego (character-driven)**
Si hay que recolectar muchos datos, no usar un formulario: hacer que el usuario adopte una mascota/avatar, le ponga nombre, cree un lazo — y solo después pedir los datos técnicos.

### Monetización más allá de la suscripción

**3. Mascotas y cosméticos de alto margen**
Un avatar/mascota personalizable con skins, ropa o accesorios (IAP) tiene margen ~100% y monetiza a quien no quiere suscribirse.

**8. Temas visuales como modelo de negocio**
Dejar elegir temas de interfaz (fondos, paletas) en el onboarding; vender temas exclusivos.

**25. Mecánicas de juego aplicadas a monetización**
En apps con IA/compañero: cambiar apariencias, decorar espacios, entrenar/comprar habilidades del compañero — ciclo de afecto + microtransacciones.

**10. Desafío de 3 días tras cerrar el paywall**
Si el usuario cierra el paywall sin pagar, disparar un reto de racha de 3 días; si lo cumple, desbloquea un regalo o descuento Premium.

**11. Gamificación tipo apps de micro-novelas**
Check-in diario, tareas por tiempo limitado, ver anuncios a cambio de fichas — patrones probados en apps tipo DramaPops/Dreame.

### ASO, distribución y adquisición

**9. Saltarse el 30% de la App Store con paywalls web**
Llevar el tráfico de ads a una landing web propia donde ocurre todo el onboarding y el pago; luego el usuario descarga la app y se loguea ya pago.

**13. Calificaciones recientes: el motor del ASO**
El algoritmo de búsqueda de las tiendas se mueve por *frecuencia de calificaciones nuevas*, no por descargas totales.

**15. Espiar el funnel web-to-app de la competencia**
En la Ad Library de Meta: botón "Instalar" → van directo a la tienda; botón "Más información" → los mandan a landing web para cobrar fuera de la tienda.

**17. Generar decenas de miles de reseñas 5 estrellas**
Diseñar un "momento de victoria emocional" temprano (medalla, predicción de potencial) y pedir la reseña justo ahí, en el pico emocional.

**19. "Link in bio" para redes sociales**
Tráfico orgánico de Instagram/TikTok → landing con registro y pago web, evitando comisión de tienda sin violar políticas de ads pagados.

**21. Atajos de testing: copiar a los grandes estudios**
Si un patrón de UI/flujo se repite en varias apps del mismo estudio grande, es porque ya está validado por A/B testing masivo.

**24. Encontrar los anuncios más rentables del competidor**
En Ad Library (Meta/TikTok/YouTube), filtrar por más antiguos y aún activos — si llevan meses pagándose, son los que mejor convierten.

---

## Qué aplicar en Odisea

Contexto actual del repo: `Membership.jsx` es un paywall de **una sola pantalla** (precio + 3 bullets + formulario de tarjeta), sin prueba gratuita, sin pasos previos, y bloqueado por completo para invitados (`isGuest`). No existe onboarding más allá del registro (`RegisterForm.jsx`). Ya existe una landing de marketing (`PlayLanding.jsx`) con enlaces a TikTok/Instagram/Facebook, un sistema de compañero/mascota (mencionado en memoria del proyecto), misiones free/premium (`missions.is_premium`), y distribución dual (web jugable + wrapper Android vía Capacitor). No hay flujo de permisos de notificaciones ni de reseñas.

### Ahora (bajo esfuerzo, con lo que ya existe)

- **#16 → dividir `Membership.jsx` en 3 pantallas**: beneficios/prueba social → precio y ahorro anual → formulario de pago. Es el cambio de mayor impacto y el más barato: no toca backend, solo la UI existente.
- **#7 → reescribir el copy de entrada** al paywall y al primer contacto (hoy son bullets genéricos de `membership.benefit_*`). Vender directamente: "sin compromiso", "cancela cuando quieras", apoyándose en el i18n que ya existe.
- **#5 → usar las misiones free ya jugadas como costo hundido**: cuando un usuario invitado/free complete N misiones, disparar el paywall como "protege tu progreso" en vez de un muro genérico. Encaja con el modelo `missions.is_premium` que ya filtra contenido.
- **#3/#25 → monetizar el compañero existente** con cosméticos/skins comprables en vez de (o además de) la suscripción. Ya hay un sistema de compañero; falta la tienda de accesorios. Margen alto, no compite con la suscripción, capta al usuario que no quiere pagar recurrente.
- **#19/#9 → aprovechar `PlayLanding.jsx`**: ya reciben tráfico de redes; confirmar que el link en bio de TikTok/Instagram apunta a esa landing con registro+pago *web* antes de pedir instalar el APK, para no depender de comisión de tienda cuando publiquen en Play Store.
- **#13 → plan de calificaciones**: como el Android es reciente (wrapper Capacitor), definir desde ya en qué momento del flujo se pedirá el rating, aunque sea manual al inicio, para no perder la ventana de "app nueva" del algoritmo de Play Store.

### A futuro (requieren más diseño/backend)

- **#1 → prueba gratuita real de 7 días** en `subscription_service.go` / Wompi: hoy el modelo es pago inmediato con tarjeta, sin trial. Requiere lógica de cobro diferido y estado "trialing" en la tabla `subscriptions`.
- **#20 → onboarding "character-driven"**: usar el sistema de compañero para recolectar preferencias del jugador (idioma, tema, meta) como parte de nombrar/vestir a la mascota, en vez de un formulario. Se apoya en el trabajo de i18n nativo ya existente para NPCs.
- **#6/#22 → permisos de notificación contextuales**: no existen hoy (`PushNotifications` de Capacitor no está integrado). Cuando se agregue, pedirlos tras una acción clave (terminar una misión) y dejar elegir la hora del recordatorio, no un prompt genérico al abrir la app.
- **#10/#11/#18 → capas de retención post-paywall**: reto de 3 días si cierran el paywall, banner de oferta persistente, mecánicas de racha/check-in diario reutilizando el sistema de misiones. Encaja bien con el motor de misiones coop/kill-progress ya existente.
- **#23 → offboarding con descuento**: al cancelar en `Membership.jsx` (hoy `handleCancel` solo confirma con `window.confirm`), interceptar con una oferta de retención antes de confirmar.
- **#17 → reseñas en el pico emocional**: identificar el "momento de victoria" (primer boss derrotado, primera Ninja Card ganada) y pedir rating ahí, no genérico.
- **#9/#19 a escala** + **#15/#24 (inteligencia de competencia)**: una vez haya presupuesto de ads, auditar Ad Library de competidores de apps educativas/RPG similares antes de definir el funnel pagado definitivo.
- **#8 → tienda de temas visuales**: paletas/fondos del lobby o del mapa como compra cosmética adicional, en la misma línea que #3.

---

*Documento generado a partir de una lista de tácticas de growth para apps; adaptar cifras (7 días, 3 días, 50%) a los datos reales de Odisea una vez haya volumen de usuarios para A/B testear.*
