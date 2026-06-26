# Carpeta `enemys/` — Sprites de enemigos

Cada **enemigo** usa **una sola hoja** (`body`), a diferencia del boss (que usa la
estructura de Character con varias hojas — ver [`../boss/README.md`](../boss/README.md)).

## Archivos por enemigo (`<id>` = número, ej. `1`, `2`, `3`, `4`)

| Archivo        | Qué es                                                              |
|----------------|--------------------------------------------------------------------|
| `<id>a.png`    | Hoja de sprites (la imagen).                                        |
| `<id>a.json`   | Atlas exportado con **[Leshy SpriteSheet Tool]** en formato JSON.   |

[Leshy SpriteSheet Tool]: https://www.leshylabs.com/apps/sstool/

La hoja debe ser una **cuadrícula de 6 filas × 6 frames**, en este orden de arriba
hacia abajo (una fila por animación):

1. `idle`
2. `walking`
3. `attack`
4. `hurt`
5. `knocked`
6. `dying`

Dentro de cada fila los frames van de **izquierda a derecha**. Frames marcadores de
`≤10×10 px` (los puntitos que mete el exportador) se ignoran automáticamente.

> El detector de filas ordena todos los frames por **Y** y los corta en bloques de 6.
> Sólo requiere que **las filas no se solapen en Y** (que haya un hueco vertical entre
> una fila y la siguiente). Por eso da igual que los sprites de una misma fila tengan
> alturas muy distintas (p. ej. `knocked` / `dying`).

## Cómo normalizar un personaje nuevo

1. **Exporta** desde Leshy SpriteSheet Tool a `<id>a.png` + `<id>a.json` y déjalos en
   esta carpeta, respetando la cuadrícula 6×6 descrita arriba.

2. **Ejecuta el script** (procesa **todos** los `<id>a.json` de la carpeta de golpe):

   ```bash
   # Desde gather-rpg-frontend/public/enemys/
   node map_enemy_frames.cjs
   ```

   Esto hace dos cosas:
   - Reescribe cada `<id>a.json` renombrando los frames a `idle_0 … dying_5`.
   - Regenera `_animationsByEnemy_generated.js` (el mapeo que consume el juego).

3. **Registra el id** en
   [`../../src/game/config/EnemyConfig.js`](../../src/game/config/EnemyConfig.js):

   ```js
   export const AVAILABLE_ENEMIES = ['1', '2', '3', '4']; // ← añade tu nuevo id
   ```

Eso es todo: `EnemyConfig.js` ya carga las hojas (`enemy-<id>-body`) y crea las
animaciones (`enemy-<id>-<anim>`) a partir del archivo generado.

## Ajustar velocidad / loop de animaciones

Los `frameRate` y `repeat` de cada animación están en `ENEMY_ANIMATIONS`, al principio de
[`map_enemy_frames.cjs`](map_enemy_frames.cjs). Cámbialos ahí y vuelve a ejecutar el script.

```js
const ENEMY_ANIMATIONS = [
    { name: 'idle',    count: 6, frameRate: 8,  repeat: -1 },
    { name: 'walking', count: 6, frameRate: 10, repeat: -1 },
    { name: 'attack',  count: 6, frameRate: 12, repeat: 0  },
    { name: 'hurt',    count: 6, frameRate: 10, repeat: 0  },
    { name: 'knocked', count: 6, frameRate: 10, repeat: 0  },
    { name: 'dying',   count: 6, frameRate: 8,  repeat: 0  },
];
```

> Si una hoja no tiene exactamente 36 frames reales, el script avisa con un `⚠️` porque el
> corte por filas puede desalinearse. Revisa el export en ese caso.

## Mapeo estado FSM → animación

Definido en `STATE_TO_ANIM` dentro de [`../../src/game/config/EnemyConfig.js`](../../src/game/config/EnemyConfig.js):

| Estado FSM (server) | Animación |
|---------------------|-----------|
| `idle`              | `idle`    |
| `chase`             | `walking` |
| `attack` / `throw` / `skill` | `attack` |
| `charge`            | `walking` |
| `hurt`              | `hurt`    |
| `knocked`           | `knocked` |
| `dead`              | `dying`   |
