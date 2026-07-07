# 🛡️ Odyssey - Gestión de Personajes

Esta carpeta contiene los activos visuales (hojas de sprites y atlas JSON) de los personajes del juego, así como las herramientas para automatizar su integración.

## 🚀 Guía de Uso Rápido

Dependiendo de los archivos de origen de tu personaje, puedes ejecutar los siguientes scripts:

### Opción A: Tienes archivos `.txt` y `.png` (Exportado directo de Leshy)
Si exportaste las coordenadas del spritesheet en formato de texto `.txt` (ej. `5b.txt`), debes correr el pipeline completo para generar los `.json` y registrar las animaciones:
```bash
node run_pipeline.cjs
```
> [!TIP]
> También puedes usar el script de PowerShell: `.\actualizar_personajes.ps1` desde la raíz de la carpeta frontend.

### Opción B: Ya tienes los archivos `.json` y `.png` listos
Si ya posees los archivos de atlas `.json` y solo deseas actualizar o reconstruir el índice general de animaciones:
```bash
node map_character_frames.cjs
```

---

## 📐 Sistema de Auto-Escalado Dinámico (Validación de Tamaño)

> [!IMPORTANT]
> **No necesitas configurar escalas o tamaños manualmente en los scripts ni en la configuración al añadir personajes.**
>
> El motor de Odyssey (`PlayerSprite.js` y `NPCSprite.js`) realiza una **normalización de escala automática en base al tamaño de frame de la textura**:
> 1. Al cargar el personaje, el código lee el alto real (`h`) de sus frames directamente del archivo JSON.
> 2. Calcula la escala ideal usando una altura de objetivo uniforme: `TARGET_PLAYER_HEIGHT / h` (donde la altura objetivo es de `108px`).
> 3. Esto garantiza que si añades un personaje de baja resolución (frames de `72px`) se escale a `1.5` automáticamente, mientras que uno de alta resolución (frames de `300px`) se escale a `0.36`, manteniendo siempre la misma proporción visual en comparación con los NPCs del mapa.

---

## 📂 Archivos Clave

*   **`run_pipeline.cjs`**: Lee los archivos `.txt`, genera los atlas `.json` y crea el índice general de animaciones.
*   **`map_character_frames.cjs`**: Lee los atlas `.json` existentes y genera/actualiza el archivo `_animationsByCharacter_generated.js`.
*   **`_animationsByCharacter_generated.js`**: Archivo de salida auto-generado. **No lo edites manualmente**, ya que se sobrescribirá.
*   **`Xa.json`, `Xb.json`, `Xc.json`**: Atlas de texturas (Base, Combate y Avatar respectivamente).
*   **`Xa.png`, `Xb.png`, `Xc.png`**: Hojas de sprites correspondientes.

## 🛠️ Cómo añadir un personaje nuevo
1. Copia tus archivos `.png` y `.txt` (o `.json`) a esta carpeta siguiendo la nomenclatura (ej: `5a.png`/`5b.txt` para el personaje 5).
2. Ejecuta `node run_pipeline.cjs` en esta carpeta para procesar y compilar todo.
3. El personaje se integrará dinámicamente y se escalará al tamaño correcto en el juego de forma automática.

---
> [!NOTE]
> Los scripts asumen que cada animación tiene exactamente **6 frames** reales. Asegúrate de que tu herramienta de exportación (como Leshy SpriteSheet Tool) mantenga este estándar.
