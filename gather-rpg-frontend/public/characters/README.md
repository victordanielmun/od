# 🛡️ Odyssey - Gestión de Personajes

Esta carpeta contiene los activos visuales (hojas de sprites y atlas JSON) de los personajes del juego, así como las herramientas para automatizar su integración.

## 🚀 Guía de Uso Rápido

Cada vez que añadas un nuevo personaje o modifiques uno existente, solo necesitas ejecutar **un comando**:

```bash
node map_character_frames.cjs
```

### ¿Qué hace este comando?
1.  **Normalización Vertical**: Ajusta automáticamente los archivos JSON para que todos los personajes "pisen" el mismo suelo y elimina saltos visuales (jitter).
2.  **Mapeo de Animaciones**: Lee los atlas y genera el archivo `_animationsByCharacter_generated.js` con las configuraciones de frames para Phaser.

---

## 📂 Archivos Clave

*   **`map_character_frames.cjs`**: El script principal. Ejecútalo siempre que haya cambios.
*   **`_animationsByCharacter_generated.js`**: Archivo auto-generado. **No lo edites manualmente**, ya que se sobrescribirá.
*   **`Xa.json`, `Xb.json`, `Xc.json`**: Atlas de texturas (Base, Combate y Avatar respectivamente).
*   **`Xa.png`, `Xb.png`, `Xc.png`**: Hojas de sprites correspondientes.

## 🛠️ Cómo añadir un personaje nuevo
1.  Copia tus archivos `.png` y `.json` a esta carpeta siguiendo la nomenclatura (ej: `5a.json`, `5b.json`, etc.).
2.  Abre `src/game/config/CharacterConfig.js` y añade el nuevo ID (ej: `'5'`) al array `AVAILABLE_CHARACTERS`.
3.  Ejecuta `node map_character_frames.cjs` en esta carpeta.
4.  ¡Listo! El personaje estará disponible en el juego con sus animaciones alineadas.

---
> [!NOTE]
> Los scripts asumen que cada animación tiene exactamente **6 frames** reales. Asegúrate de que tu herramienta de exportación (como Leshy SpriteSheet Tool) mantenga este estándar.
