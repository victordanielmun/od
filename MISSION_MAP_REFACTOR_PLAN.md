# Plan de remediación — Lógica de mapas-misión

> Basado en el análisis de bugs y flujos del sistema misión↔mapa↔instancia↔progreso.
> Cada fase es entregable por sí sola. Las tareas son pequeñas y atómicas.
> Marca `[x]` al completar.

## Resumen de problemas detectados

| # | Severidad | Problema | Ubicación |
|---|---|---|---|
| 1 | 🔴 | Nil-deref / panic en `progress.Status` sin guard | `mission_handler.go:282` |
| 2 | 🔴 | `mission.mode` (individual/coop/competitivo) no se aplica al instanciar | `npc_mission.go:143`, `hub.go:2410` |
| 3 | 🔴 | Progreso global por (jugador,misión); `RoomID` nunca se usa → sin aislamiento ni rejugar | `mission_repository.go:166`, `npc_mission.go:217` |
| 4 | 🟠 | `GetProgress` auto-crea progreso al consultar → kills cuentan misiones no aceptadas | `mission_service.go:74-89` |
| 5 | 🟠 | `checkDefeatEnemy` es placeholder, siempre `false` | `mission_service.go:139-143` |
| 6 | 🟠 | `collect_items` ignora cantidad; consume solo 1 | `mission_service.go:117-137` |
| 7 | 🟠 | Entrega de recompensa triplicada sin idempotencia | `mission_service.go:218/439/565` |
| 8 | 🟡 | Matchmaking `cooperative` inalcanzable (front hardcodea `'public'`) | `LobbyGameCanvas.jsx:77/218`, `hub.go:2441` |

### Comportamiento objetivo
- **Individual:** un usuario → su propia instancia aislada.
- **Cooperativo:** varios usuarios → misma instancia + progreso de objetivo compartido.
- **Competitivo:** varios usuarios → misma instancia, progreso por-jugador, hay un ganador.

---

## Fase 0 — Estabilización (bajo riesgo, sin cambio de comportamiento)
Quita el crash y la deuda que hace peligroso tocar el resto.

- [x] **T0.1** Guard `progress != nil` antes de `progress.Status` en `mission_handler.go:282`.
- [x] **T0.2** Auditar otros `progress, _ :=` del handler (`:224` guardado en `:228`/`:282`; `:311` guardado en `:312`/`:319`) — sin más derefs sin guard.
- [x] **T0.3** Extraído `deliverRewards(playerID, missionID)` en `mission_service.go`; guard de doble-grant vía `!wasCompleted` en `UpdateTaskProgress`.
- [x] **T0.4** Reemplazados los 3 bloques duplicados por `s.deliverRewards(...)`.
- [x] **T0.5** `go build ./...` ✅ + `go vet` ✅. _(Smoke test manual de completar misión por motor: pendiente en entorno con server+DB.)_

## Fase 1 — Correctitud del progreso (modelo de datos)
Progreso explícito y aislable; base de los modos. _(Depende de Fase 0.)_

- [x] **T1.1** `GetProgressReadOnly(userID, missionID, roomID)` (nil si no existe) + los 3 listados del handler ya no crean progreso al consultar. _(arregla bug #4)_
- [x] **T1.2** `AcceptMission` service + handler + ruta `POST /missions/:id/accept?room_id=`. Front: `gameStore.acceptMission` + aceptación al llegar (`LobbyLayout`) y al seleccionar same-scene (`NPCDialogue`).
- [x] **T1.3** Kills cuentan solo `in_progress` y acotados a la instancia (`activeMissionProgresses(playerID, roomID)`).
- [x] **T1.4** `AcceptMission` escribe `RoomID` en `PlayerMissionProgress`.
- [x] **T1.5** Repo `GetPlayerProgressInRoom`; lookups por `(player, mission, room)` en los paths de acción (kills). _Listings usan roomID=nil (best-effort) — OK bajo "One Map, One Mission"._
- [x] **T1.6** (DB) `RequiredQuantity` añadido a `MissionTask`; `checkBringItem` ahora suma cantidades (≥ requerido) y consume la cantidad. _(auto-migra al reiniciar)_
- [x] **T1.7** `checkDefeatEnemy` (placeholder always-false) reemplazado por `checkKillTaskDone`, que lee el progreso real marcado por los handlers WS de kills.
- [ ] **T1.8** Validación: rejugar en instancia nueva resetea; kills solo cuentan misiones aceptadas.

## Fase 2 — Cableado `mission.mode` → instancia
Que individual/coop/competitivo ruteen a la instancia correcta. _(Depende de Fase 1.)_

- [ ] **T2.1** (Diseño/DB) Binding explícito mapa→misión: `mission_id` en `MapConfig` o regla "1 misión activa por scene". Documentar decisión.
- [ ] **T2.2** En `handleRequestMapJoin` derivar el `mode` desde la misión del mapa (no confiar en el cliente).
- [ ] **T2.3** Rama **individual**: siempre crear instancia nueva aislada (max 1), nunca unir.
- [ ] **T2.4** Rama **cooperative**: hacerla alcanzable y unir a instancia compartida con cupo.
- [ ] **T2.5** Rama **competitive**: unir a instancia compartida, progreso por-jugador.
- [ ] **T2.6** Frontend: quitar el `'public'` hardcodeado (`LobbyGameCanvas.jsx:77/218`); el backend resuelve el modo.
- [ ] **T2.7** Validación: 2 usuarios individual → instancias separadas; coop/competitivo → misma instancia.

## Fase 3 — Semántica de equipo (coop) y competición
Coop comparte progreso; competitivo tiene ganador. _(Depende de Fase 2.)_

- [ ] **T3.1** Coop: progreso de objetivo compartido por instancia (a nivel room).
- [ ] **T3.2** Coop: broadcast WS de progreso compartido al avanzar cualquier miembro.
- [ ] **T3.3** Competitivo: scoreboard por instancia + condición de victoria (primero en completar).
- [ ] **T3.4** Competitivo: mensaje WS `mission_competitive_result` (ganador/posiciones) + recompensa diferenciada.
- [ ] **T3.5** Validación: coop completa para todos al lograr objetivo; competitivo declara un único ganador.

## Fase 4 — Pulido y consistencia (transversal)
- [ ] **T4.1** Alinear admin UI (`AdminMissions.jsx`) con campos nuevos (`required_quantity`, binding de mapa).
- [ ] **T4.2** Tests de instanciación (`dynamic_room_test.go`) cubriendo los 3 modos.
- [ ] **T4.3** Limpiar código muerto (métrica de progreso-por-enemigos del matchmaking si ya no aplica).
- [ ] **T4.4** Validación E2E: matriz tipo-de-objetivo × modo.

---

## Orden y dependencias
```
Fase 0  ──►  Fase 1  ──►  Fase 2  ──►  Fase 3
                                   └─►  Fase 4 (transversal, al final)
```
- **Fase 0**: mergeable ya, independiente.
- **Fase 1**: el aislamiento por `RoomID` (T1.4-T1.5) es prerequisito real del instanciado.
- **Fases 2-3**: mayor diseño; validar enfoque antes de codear.

## Recomendación de arranque
**Fase 0 completa** + **T1.1/T1.3** (cortar conteo fantasma). Solo eso ya elimina el panic, la triplicación de recompensas y los cruces de progreso más visibles.
