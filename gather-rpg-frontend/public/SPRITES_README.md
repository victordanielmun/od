# 🎨 Convención de Sprites — Odyssey

Documento de referencia para crear sprites de **personajes/jugador**, **boss** y **enemigos**.

---

## 0. Regla universal

- Cada hoja de sprites es un **grid**: **6 frames por fila (columnas)** y **1 fila = 1 animación**.
- El **orden de las filas (de arriba hacia abajo) ES el orden de las animaciones** definidas más abajo. Respetarlo es obligatorio.
- Cada frame de una misma animación debe tener el **mismo tamaño** y estar alineado.
- Exportación con **Leshy SpriteSheet Tool** → un **`.png`** + un **`.txt`**.

### Formato del `.txt` de Leshy
Una línea por frame, separada por comas:
```
nombre,x,y,w,h
```
- `x,y` = esquina superior izquierda del frame dentro del PNG; `w,h` = ancho/alto.
- Líneas vacías o que empiezan con `#` se ignoran.
- Frames con `w` o `h` < 10 px se descartan (ruido).
- El pipeline **ordena por fila (Y) y luego por X** (izq→der), así que basta con que las filas estén separadas verticalmente.

---

## 1. Player / Character  (👉 el BOSS usa EXACTAMENTE esta misma estructura)

El personaje usa **2 hojas obligatorias** (+2 opcionales). Cada fila = 6 frames.

### Hoja BASE — archivo `<id>b.png` + `<id>b.txt`  (6 filas)
| Fila | Animación | frameRate | repeat |
|------|-----------|-----------|--------|
| 1 | `idle`   | 8  | loop (-1) |
| 2 | `walk`   | 10 | loop (-1) |
| 3 | `hurt`   | 10 | 0 |
| 4 | `die`    | 8  | 0 |
| 5 | `block`  | 10 | 0 |
| 6 | `potion` | 10 | 0 |

### Hoja COMBAT — archivo `<id>a.png` + `<id>a.txt`  (5 filas)
| Fila | Animación | UI | frameRate | repeat |
|------|-----------|----|-----------|--------|
| 1 | `combo1`           | Combo 1 (Jab)      | 14 | 0 |
| 2 | `combo2`           | Combo 2 (Cross)    | 13 | 0 |
| 3 | `combo3_finisher`  | Combo 3 (Finisher) | 11 | 0 |
| 4 | `special`          | **Spell**          | 12 | 0 |
| 5 | `projectile`       | **Throw**          | 12 | 0 |

> Total jugable: **11 animaciones** (6 base + 5 combat).
> Hojas opcionales: `<id>c` (avatar/retratos) y `<id>d` (combos extra). No son necesarias para el boss.

---

## 2. BOSS

El boss es, en estructura de animación, **idéntico a un Character**: usa las **mismas 2 hojas** (`base` 6 filas + `combat` 5 filas) con los mismos nombres de animación.

- Carpeta propia (nueva): `public/bosses/` con `<id>b.(png|txt)` y `<id>a.(png|txt)`.
- El boss se **renderiza como enemigo** (FSM del servidor), así que sus estados se mapean a estas animaciones:

| Estado FSM (server) | Animación del boss |
|---------------------|--------------------|
| `idle`   | `idle` |
| `chase`  | `walk` |
| `attack` (combo melee) | `combo1` / `combo2` / `combo3_finisher` |
| `skill`  (AoE)  | `special` (Spell) |
| `throw`  (arrojadizo) | `projectile` (Throw) |
| `charge` (tacleo) | `walk` (o un `dash` dedicado si se añade fila) |
| `hurt`   | `hurt` |
| `knocked`| `hurt` (o `die` parcial) |
| `dead`   | `die` |

> Animaciones extra del set base que el boss puede aprovechar: `block` (telegraph), `potion` (enrage). Opcionales.

---

## 3. Enemigos  (melee / fast / thrower)

Los **3 tipos comparten EXACTAMENTE la misma hoja y filas**. Una sola hoja.

### Hoja ENEMY — archivo `<id>a.png` + `<id>a.txt`  (6 filas)
| Fila | Animación | frameRate | repeat |
|------|-----------|-----------|--------|
| 1 | `idle`    | 8  | loop (-1) |
| 2 | `walking` | 10 | loop (-1) |
| 3 | `attack`  | 12 | 0 |
| 4 | `hurt`    | 10 | 0 |
| 5 | `knocked` | 10 | 0 |
| 6 | `dying`   | 8  | 0 |

### Diferencias por tipo (mismo layout, distinto arte/comportamiento)
| Tipo | Hoja | Fila `attack` representa | Notas |
|------|------|--------------------------|-------|
| **melee** (existente) | misma | un golpe cuerpo a cuerpo | comportamiento base |
| **fast** | misma | un golpe cuerpo a cuerpo | mismo set; solo ataca/mueve **más rápido** (config del server) |
| **thrower** | misma | un **lanzamiento (throw)** | la fila `attack` debe dibujarse como **gesto de lanzar** (el server usa estado `throw` → reproduce esta fila) |

> Es decir: para el `thrower` **no se añade fila nueva**; se reutiliza la fila 3 (`attack`) pero el arte es un lanzamiento. El daño real lo produce un proyectil generado por código.

---

## 4. Cómo generar (pipeline)

### Characters / Boss
1. Colocar `<id>b.png`+`<id>b.txt` y `<id>a.png`+`<id>a.txt` en la carpeta (`public/characters/` o `public/bosses/`).
2. Ejecutar:
   ```
   node run_pipeline.cjs            # todos
   node run_pipeline.cjs 1 a        # solo personaje 1, hoja a
   ```
   Esto convierte `.txt → .json` y regenera `_animationsByCharacter_generated.js`.

### Enemigos
1. Colocar `<id>a.png` + `<id>a.txt` en `public/enemys/` y convertir a `<id>a.json` (mismo formato Leshy).
2. Ejecutar `node map_enemy_frames.cjs` → regenera `_animationsByEnemy_generated.js`.
   - El mapeador agrupa filas por posición Y (tolerancia ~30 px), así que **separa bien las filas verticalmente**.

---

## 5. Checklist rápido al crear un sprite

- [ ] Cada animación en **su propia fila**, **6 frames**, mismo tamaño.
- [ ] Filas en el **orden exacto** de las tablas de arriba.
- [ ] Exportar **PNG + TXT** desde Leshy (`nombre,x,y,w,h`).
- [ ] Frames de cada fila ordenados **izquierda→derecha** (orden de reproducción).
- [ ] Nombrar archivos según convención: `<id>a` (combat/enemy), `<id>b` (base).

---

## 6. Archivos a crear para el contenido nuevo (pendiente de confirmar)

**Boss** (carpeta `public/bosses/`, estructura = character):
- `<id>b.png` + `<id>b.txt`  → base: idle, walk, hurt, die, block, potion
- `<id>a.png` + `<id>a.txt`  → combat: combo1, combo2, combo3_finisher, special, projectile

**Enemigos nuevos** (carpeta `public/enemys/`, una hoja cada uno):
- `<id>a.png` + `<id>a.txt`  → idle, walking, attack, hurt, knocked, dying
- Tipos: **fast** (arte normal en `attack`) y **thrower** (arte de lanzamiento en `attack`).
- El **melee** ya existe; fast/thrower pueden reusar arte o tener el suyo.
