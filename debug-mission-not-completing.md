# [OPEN] Debug Session: mission-not-completing

## Resumen
- Sintoma: al eliminar los dos enemigos del mapa, la mision no se termina.
- Objetivo: verificar el flujo completo desde `enemy_died`/`UpdateKillProgress` hasta la actualizacion de estado y finalizacion de la mision.

## Hipotesis Iniciales
1. Las muertes de enemigos ocurren, pero `UpdateKillProgress` no encuentra tareas/misiones asociadas a ese `enemy_id` o `room_id`.
2. El progreso de kills se actualiza parcialmente, pero la condicion de mision completada no se recalcula o no se persiste.
3. La muerte por uno de los caminos de combate (`player_attack`, `ninja_card`, otro flujo) no dispara el mismo avance de mision.
4. La mision si se completa en backend, pero el frontend no recibe o no procesa el evento de progreso/completado.
5. Existe un desacople de IDs entre enemigo instanciado, template enemigo y el `enemy_id` que usan las tareas de mision.

## Evidencia
- `UpdateKillProgress` se ejecuta tras ambas muertes Ninja y no falla.
- En `logs.txt`, para ambas muertes solo aparecen misiones activas `1` y `2`, y ninguna produce resultados:
  - mission `1` tiene tarea `talk_to_npc`
  - mission `2` tiene `0` tareas
- `UpdateKillAllProgress` tambien corre tras la segunda muerte y tampoco encuentra una tarea `kill_all`.
- Consulta directa a PostgreSQL:
  - existe una mision para `scene_key='combat1'`: `mission id=2`, `type=kill_all`, `difficulty=beginner`
  - `player_mission_progresses` del usuario incluye `mission_id=2`
  - `mission_tasks` no tiene ninguna tarea para `mission_id=2`
- Evidencia runtime posterior:
  - `fetchActiveMission(combat1)` devuelve `missionId=2`, `taskCount=1`, `taskTypes=["kill_all"]`
  - el backend reporta `GetProgress(user, mission 2)` con `status="completed"`
  - no llega ningun `enemy_kill_progress` al cliente durante la reproduccion donde el enemigo si muere
  - conclusion: el HUD estaba mostrando una mision ya completada como si siguiera activa

## Conclusion Parcial
- La logica de combate y el disparo de progreso funcionan.
- La causa raiz confirmada es de seleccion de estado en frontend: `fetchActiveMission()` tomaba la primera mision de la escena sin filtrar `status="completed"`, por lo que el HUD mostraba una mision ya terminada con contador `0/2`.

## Plan
1. Revisar logs existentes para ubicar los eventos de muerte y progreso.
2. Inspeccionar codigo de `UpdateKillProgress`, tareas de mision y emisiones WS.
3. Si la evidencia no alcanza, instrumentar solo los puntos criticos.
4. Aplicar fix minimo basado en evidencia.
5. Verificar con evidencia post-fix y limpiar al confirmar.
