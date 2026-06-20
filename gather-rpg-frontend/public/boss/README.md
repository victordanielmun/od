# Carpeta `boss/` — Sprites de jefes

Los **bosses** usan la **misma estructura que un Character** (no la de enemigo de 1 hoja).
Ver la convención completa en [`../SPRITES_README.md`](../SPRITES_README.md) (sección "BOSS").

## Archivos por boss (`<id>` = número, ej. `1`)
- `<id>b.png` + `<id>b.txt` → **Base** (6 filas, 6 frames c/u):
  `idle, walk, hurt, die, block, potion`
- `<id>a.png` + `<id>a.txt` → **Combat** (5 filas, 6 frames c/u):
  `combo1, combo2, combo3_finisher, special (Spell), projectile (Throw)`

Cada `.txt` es export de **Leshy**: `nombre,x,y,w,h` por línea. 6 frames por fila, ordenados izq→der; las filas en el orden de arriba.

## Mapeo estado del boss → animación
| Estado FSM (server) | Animación |
|---------------------|-----------|
| `idle` | `idle` |
| `chase` | `walk` |
| `attack` | `combo1` / `combo2` / `combo3_finisher` |
| `skill` (AoE) | `special` |
| `throw` | `projectile` |
| `charge` (tacleo) | `walk` |
| `hurt` | `hurt` |
| `dead` | `die` |

## Pendiente de cableado (E5)
Hoy el boss se renderiza con animaciones **placeholder** del set de enemigo (`enemys/`).
Cuando se suban aquí los PNG/TXT reales, falta:
1. Cargar las 2 hojas del boss desde `/boss/<id>a|b.(png|json)` (pipeline `run_pipeline.cjs`).
2. Registrar sus animaciones estilo character y apuntar el `STATE_TO_ANIM` del boss a ellas.
