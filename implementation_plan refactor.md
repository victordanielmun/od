# Refactorización del Sistema de Editor de Mapas

## Contexto

El archivo `MapManager.js` creció de ~550 a ~762 líneas durante las correcciones de bugs. `LobbyScene.jsx` ya tiene 2068 líneas. El sistema de editor tiene responsabilidades mezcladas que se deben separar correctamente.

## Estado actual (post-bugfix)

| Archivo | Líneas | KB | Responsabilidad actual |
|---|---|---|---|
| `LobbyScene.jsx` | 2068 | 74.4 | TODO: escena + combate + editor + networking + NPC + audio |
| `MapManager.js` | 762 | 30.9 | Grupos, carga/guardado, tiles directos, export/import, camera |
| `EditorController.js` | 626 | 21.8 | Input del editor, historial undo/redo, comandos |

## Análisis de Responsabilidades

### `MapManager.js` — demasiadas responsabilidades
```
✅ Grupos de tiles (walls, floors, forest, ...)  → MANTENER
✅ loadMapConfig / loadServerMapConfig            → MANTENER
✅ clearMap / resizeMap                           → MANTENER
⚠️ exportMapConfig (70+ líneas)                  → EXTRAER → MapSerializer.js
⚠️ importMapConfig (80+ líneas)                  → EXTRAER → MapSerializer.js
⚠️ _placeTileDirect (80+ líneas)                 → EXTRAER → TilePlacer.js
⚠️ _setupForestSprite / _setupBuildSprite        → EXTRAER → TilePlacer.js
⚠️ _getGroupForType / _getTextureForType          → EXTRAER → TileRegistry.js
⚠️ _findTileAt / _findAllTilesAt                 → EXTRAER → TileRegistry.js
⚠️ updateCameraBounds / calculateMapLimits        → EXTRAER → CameraSystem (ya existe)
```

### `EditorController.js` — tamaño aceptable, pequeños issues
```
✅ Input handling (pointerdown, move, up)         → MANTENER
✅ undo / redo stack                              → MANTENER  
⚠️ _editorFillRect (no agrupa historial como atomic) → BUG menor pendiente
⚠️ _pickObjectAt                                  → MANTENER (pequeño)
```

### `LobbyScene.jsx` — crítica: demasiado grande
```
🔴 Lógica de combate (~400 líneas)               → Ya debería estar en CombatSystem
🔴 Lógica de enemigos (~200 líneas)              → Ya debería estar en sistema separado
🔴 Delegaciones al MapManager (~100 líneas)      → Simplificar con proxy
🟡 NPC / pickup loading (~150 líneas)            → Acceptable o extraer
✅ Ciclo de vida de escena (create/init)         → MANTENER
```

## Open Questions

> [!IMPORTANT]
> **¿Qué tan agresiva debe ser la refactorización?**
> - **Opción A (Conservadora):** Solo extraer `MapSerializer.js` y `TilePlacer.js` de MapManager. ~2 horas de trabajo.
> - **Opción B (Completa):** Extraer + limpiar LobbyScene delegaciones duplicadas. ~4 horas.
> - **Opción C (Mínima):** Solo los bugs críticos pendientes en EditorController (rect fill atomic). ~30 min.

> [!WARNING]
> LobbyScene.jsx tiene lógica de combate mezclada con el editor. Separar esto requiere crear un `CombatSystem.js` y un `EnemySystem.js`, lo que implica cambios en LobbyScene sustanciales.

## Propuesta de Cambios (Opción A — Conservadora, Recomendada)

### Nuevos archivos a crear

---

### [NEW] `src/game/map/TileRegistry.js`
Centraliza el conocimiento de qué textura y grupo corresponde a cada tipo.
```js
// Solo contiene los maps/switches de tipo → textura y tipo → grupo
export class TileRegistry {
  constructor(mapManager) { this.mm = mapManager; }
  getTexture(type) { ... }
  getGroup(type) { ... }
  findAt(gx, gy, targetType) { ... }
  findAllAt(gx, gy) { ... }
}
```
**Beneficio:** MapManager y LobbyScene dejan de tener switches duplicados.

---

### [NEW] `src/game/map/TilePlacer.js`
Contiene toda la lógica de colocación y configuración de sprites.
```js
export class TilePlacer {
  constructor(scene, registry) { ... }
  place(type, gx, gy, frame, metadata, scale) { ... }
  _setupForestSprite(sprite) { ... }
  _setupBuildSprite(sprite) { ... }
  _setupFurnitureSprite(sprite) { ... }
}
```
**Beneficio:** `_placeTileDirect` (80 líneas) sale de MapManager.

---

### [NEW] `src/game/map/MapSerializer.js`
Export e import del mapa.
```js
export class MapSerializer {
  static export(mapManager) { ... }   // exportMapConfig
  static import(mapManager, config) { ... } // importMapConfig
}
```
**Beneficio:** 150 líneas salen de MapManager.

---

### [MODIFY] `MapManager.js`
Pasa de 762 → ~350 líneas. Solo mantiene:
- Constructor + grupos
- `createMap()`, `clearMap()`, `resizeMap()`
- `loadMapConfig()`, `loadServerMapConfig()`
- `calculateMapLimits()`, `updateCameraBounds()`
- Delegación a `TileRegistry`, `TilePlacer`, `MapSerializer`

---

### [MODIFY] `LobbyScene.jsx` (mínimo)
- Simplificar `_getGroupForType` y `_getTextureForType` a una sola línea de delegación (ya parcialmente hecho).
- Eliminar las funciones duplicadas del switch legacy.

---

### Bug pendiente: `_editorFillRect` sin historial atómico

> [!NOTE]
> Al pintar un rectángulo con drag, cada tile genera una entrada separada en el historial.
> Ctrl+Z solo deshace **un tile** por pulsación, no el rectángulo completo.
> Fix: agregar un `'batch'` action al historial que agrupe múltiples tiles.

## Verificación

- `npm run build` debe pasar sin errores
- Todos los tipos de tile deben colocarse correctamente
- Undo/redo debe funcionar para todos los tipos
- Export/import debe generar JSON válido
