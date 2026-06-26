# Carpeta `boss/` — Sprites de jefes

Los **bosses** usan la **misma estructura que un Character** (varias hojas), no la de
enemigo de 1 hoja (ver [`../enemys/README.md`](../enemys/README.md) para enemigos).
Convención completa en [`../SPRITES_README.md`](../SPRITES_README.md) (sección "BOSS").

## Archivos por boss (`<id>` = número, ej. `1`)

Cada hoja tiene 3 archivos: `<id><sheet>.png`, `<id><sheet>.txt` (export de **Leshy**) y
`<id><sheet>.json` (generado por el script a partir del `.txt`).

| Sheet | Sufijo | Clave interna | Contenido (6 frames por fila) |
|-------|--------|---------------|-------------------------------|
| Base   | `b` | `base`   | `idle, walk, hurt, die, block, potion` |
| Combat | `a` | `combat` | `combo1, combo2, combo3_finisher, special, projectile` |
| Avatar | `c` | `avatar` | retratos (1 frame por estado de ánimo) |
| Combo  | `d` | `combo`  | *(opcional)* `combo1, combo2, combo3_finisher, kick, strong, block_combo` |

> Mínimo obligatorio: **`<id>a` (combat) y `<id>b` (base)**. `c` y `d` son opcionales.

Cada `.txt` es export de **[Leshy SpriteSheet Tool]**: una línea `nombre,x,y,w,h` por
sprite. 6 frames por fila ordenados izq→der; las filas en el orden de la tabla.

[Leshy SpriteSheet Tool]: https://www.leshylabs.com/apps/sstool/

## Cómo normalizar un personaje nuevo

1. **Exporta** desde Leshy a `.png` + `.txt` por cada hoja (`<id>a`, `<id>b`, y si las
   tienes `<id>c` / `<id>d`) y déjalos en esta carpeta.

2. **Ejecuta el pipeline** (`txt → json → _animationsByCharacter_generated.js`):

   ```bash
   # Desde gather-rpg-frontend/public/boss/

   node run_pipeline.cjs            # procesa TODOS los .txt de la carpeta
   node run_pipeline.cjs 1 a        # procesa SOLO el boss 1, hoja a (1a.txt)
   node run_pipeline.cjs --only-map # salta el txt→json, sólo regenera el .js
   ```

   El script:
   - Convierte cada `<id><sheet>.txt` → `<id><sheet>.json` (hace `.backup.json` si ya existía).
   - Regenera `_animationsByCharacter_generated.js` (el mapeo que consume el juego).

3. **No hace falta tocar config**: [`../../src/game/config/BossConfig.js`](../../src/game/config/BossConfig.js)
   lee `AVAILABLE_BOSSES` directamente de las claves del archivo generado, así que el
   nuevo boss queda disponible en cuanto regeneras el `.js`.

## Ajustar velocidad / loop de animaciones

Los `frameRate` y `repeat` por animación están en `ANIM_SETTINGS`, al principio de
[`run_pipeline.cjs`](run_pipeline.cjs). Cámbialos ahí y vuelve a ejecutar (`--only-map` basta
si los `.json` ya existen). El detector de filas usa `ROW_TOLERANCE = 80` px y
`FRAMES_PER_ACTION = 6`.

## Mapeo estado del boss → animación

Definido en `BOSS_STATE_TO_ANIM` dentro de [`../../src/game/config/BossConfig.js`](../../src/game/config/BossConfig.js):

| Estado FSM (server) | Animación    |
|---------------------|--------------|
| `idle`              | `idle`       |
| `chase`             | `walk`       |
| `attack`            | `combo1`     |
| `skill` (AoE)       | `special`    |
| `throw`             | `projectile` |
| `charge` (tacleo)   | `walk`       |
| `hurt`              | `hurt`       |
| `knocked`           | `hurt`       |
| `dead`              | `die`        |
