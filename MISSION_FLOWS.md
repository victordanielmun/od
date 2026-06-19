# Flujos de uso por tipo de misión

> Estado tras **Fase 0** (estabilización) y **Fase 1** (progreso explícito + por instancia).
> ✅ = resuelto · ❌ = faltante · ⚠️ = parcial.
> Complementa a [MISSION_MAP_REFACTOR_PLAN.md](MISSION_MAP_REFACTOR_PLAN.md).

---

## Flujo base (común a todos los tipos)

```
1. Jugador habla con NPC quest-giver
2. Ve lista de misiones de la escena         (read-only — ya NO auto-crea progreso ✅)
3. Selecciona misión
     ├─ misma escena → acceptMission(room actual)            ✅
     └─ otra escena  → viaja → al llegar acceptMission(room instancia) ✅
4. Hace el objetivo (según tipo, abajo)
5. Se completa la(s) tarea(s) → si TODAS done:
     → progreso = completed
     → deliverRewards() una sola vez  (gold + xp + item, idempotente ✅)
```

**Transversal ✅ (Fase 0-1):**
- Sin panic por `progress` nil en el hub de NPC.
- Recompensa entregada **una sola vez** (antes triplicada).
- Progreso **no** se auto-crea al mirar la lista (se acabó el conteo fantasma).
- Progreso aislado por `(jugador, misión, roomID)` en los paths de acción.

**Transversal ❌ (Fase 2+):**
- Ruteo de instancia según `mission.mode` (individual/coop/competitivo) — ver sección Modos.
- Binding explícito mapa↔misión (hoy implícito por `scene_key`).

---

## GRUPO A — Combate

### 🗡️ Derrotar Enemigo (`defeat_enemy`) · Eliminar Jefe (`kill_boss`)
```
aceptar → matar enemigos en la instancia
        → WS "enemy died" → UpdateKillProgress(userID, enemyID, roomID)
        → +1 killCount por cada tarea cuyo RequiredEnemy coincida (o vacío)
        → killCount >= RequiredKills → tarea completada
        → todas las tareas done → misión completa + recompensa
```
- ✅ Conteo de kills con `RequiredKills`, acotado a misiones **aceptadas en esa instancia**.
- ✅ `checkKillTaskDone` (diálogo) refleja el progreso real (ya no es placeholder false).
- ❌ Si el nombre del enemigo no está en la DB, el kill cuenta igual (match laxo por nombre).
- ❌ Progreso **no compartido** en coop (cada jugador cuenta lo suyo).
- ❌ Sin lógica competitiva (no hay "primero en matar N").

### 💀 Eliminar a Todos (`kill_all`)
```
aceptar → limpiar TODOS los enemigos de la sala
        → WS detecta sala despejada → UpdateKillAllProgress por CADA cliente de la sala
        → marca las tareas kill_all como completadas
```
- ✅ Detección de sala despejada; acredita a todos los presentes (coop de facto).
- ✅ Acotado a `in_progress` por instancia.
- ❌ Acredita a **cualquiera** en la sala sin importar el modo (incluido un público random que la aceptó).
- ❌ No diferencia coop vs competitivo.

---

## GRUPO B — Ítems

### 🔍 Buscar Ítem (`find_item`) · 📦 Recolectar Ítems (`find_items`/`collect_items`)
```
aceptar → encontrar/recoger ítem(s) en el mundo (MapPickup) → entra al inventario
        → (al hablar con NPC target o validar tarea)
        → checkBringItem(nombre, RequiredQuantity): SUMA cantidades del inventario
        → total >= RequiredQuantity → tarea done → consume esa cantidad
```
- ✅ **Cantidad respetada**: suma cantidades y consume `RequiredQuantity` (antes exigía/consumía 1).
- ✅ Mensaje "te faltan N".
- ❌ `find_item` y `collect_items` usan el **mismo** motor (la única diferencia real es la cantidad).
- ❌ No valida que el ítem se haya conseguido **dentro** de la instancia de la misión.
- ❌ Recolección **no compartida** en coop (cada jugador junta lo suyo).
- ⚠️ Falta UI admin para setear `RequiredQuantity` (Fase 4 / T4.1).

---

## GRUPO C — Diálogo / IA

### 💬 Diálogo con NPC (`talk_to_npc`)
```
aceptar → ir al NPC target → conversar (dialogue_service)
        → checkTalkToNPC: ¿existe conversación con ese NPC para esta misión?
        → sí → tarea done
```
- ✅ Tracking de conversación por (jugador, NPC, misión).
- ❌ Solo verifica que **exista** una conversación, no el contenido.
- ⚠️ Guard nil latente en `dialogue_service.go:111` (hoy no crashea porque `GetProgress` auto-crea en el path de acción).

### ✉️ Entregar Mensaje (`deliver_message`)
```
aceptar → llevar el mensaje → hablar con NPC target
        → IA evalúa la entrega → flag de IA dispara UpdateTaskProgress(done)
```
- ✅ Recompensa única al completar.
- ❌ `CheckTaskCondition` devuelve `true` siempre: depende **100% del flag de la IA**, sin validación de contenido en el servidor.

### 🗣️ Desafío de Pronunciación (`pronunciation_challenge`)
```
aceptar → hablar con NPC → pronunciar la frase objetivo
        → score de pronunciación → si score >= PronunciationMinScore
        → flag de IA → tarea done
```
- ✅ Infra de scoring (`PronunciationScore`, `PronunciationMinScore`, `TargetPhraseEn`).
- ❌ El umbral `PronunciationMinScore` **no se valida en el servidor** dentro de `CheckTaskCondition` (returns true); se confía en el flag de la IA.

---

## Dimensión MODOS (transversal — Fase 2, pendiente)

| Modo | Comportamiento esperado | Estado actual |
|---|---|---|
| 👤 Individual | 1 usuario → su instancia aislada | ❌ No ruteado: caen juntos en instancia pública |
| 🤝 Cooperativo | varios → misma instancia + progreso compartido | ⚠️ Comparten espacio si público; progreso NO compartido (salvo `kill_all`); rama coop del matchmaking inalcanzable |
| ⚔️ Competitivo | varios → misma instancia, progreso por-jugador, hay ganador | ❌ Sin lógica alguna (ni scoreboard ni ganador) |

**Causa raíz pendiente:** el front manda `'public'` fijo y el backend instancia por `is_public`, no por `mission.mode`. → **T2.1-T2.7**.

---

## Resumen ejecutivo

| Tipo | Motor | Resuelto | Falta clave |
|---|---|---|---|
| Derrotar Enemigo | Combate | Conteo + room scope | Coop/competitivo |
| Eliminar Jefe | Combate | Conteo + room scope | Coop/competitivo |
| Eliminar a Todos | Combate | Crédito a sala | Gating por modo |
| Buscar Ítem | Ítems | Cantidad ✅ | Validar origen / coop |
| Recolectar Ítems | Ítems | Cantidad ✅ | UI admin / coop |
| Diálogo con NPC | Diálogo | Tracking | Validar contenido |
| Entregar Mensaje | IA | Recompensa única | Validación servidor |
| Pronunciación | IA | Scoring infra | Enforce umbral servidor |

**Todo lo de "Modos" y la validación de servidor de los tipos IA son el grueso de lo faltante → Fases 2-3.**
