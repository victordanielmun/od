# Documentación de Implementación en Phaser 3 - Gather RPG

Esta documentación describe cómo se han aplicado los conceptos de Phaser 3 en el proyecto **Gather RPG**, basándose en la documentación oficial y las mejores prácticas obtenidas a través de Context7.

## 1. Sistema de Personajes y Animaciones

### Conceptos de Phaser Utilizados
*   **Sprite Sheets**: Carga de imágenes que contienen múltiples cuadros (frames) de animación.
*   **Animation Manager (`this.anims`)**: Sistema global para crear y gestionar animaciones reutilizables.
*   **Game Objects (Container)**: Uso de contenedores para agrupar el sprite del personaje, su etiqueta de nombre y otros elementos UI.
*   **Dynamic ID Loading**: Carga dinámica de recursos basada en configuración.

### Implementación en el Proyecto

#### A. Configuración Centralizada (`CharacterConfig.js`)
En lugar de cargar sprites manualmente en cada escena, utilizamos un archivo de configuración (`src/game/config/CharacterConfig.js`) que define:
1.  Los **personajes disponibles** (IDs y rutas de archivos).
2.  Las **hojas de sprites** asociadas a cada personaje (Base, Combate).
3.  Las **animaciones** y sus rangos de frames.

```javascript
// Ejemplo de configuración
export const CHARACTER_CONFIG = {
  characters: [
    { 
      id: '1', 
      sheets: [
        { type: 'base', path: '/characters/1a.png' },
        { type: 'combat', path: '/characters/1b.png' }
      ]
    }
  ],
  animations: {
    walk: { sheetType: 'base', start: 0, end: 3, frameRate: 8, repeat: -1 },
    slash: { sheetType: 'combat', start: 0, end: 3, frameRate: 10, repeat: 0 }
  }
};
```

#### B. Clase `PlayerSprite`
Esta clase extiende `Phaser.GameObjects.Container` y maneja la lógica visual del jugador.
*   **Cambio Dinámico de Texturas**: Al reproducir una animación (ej. ataque), la clase detecta automáticamente qué hoja de sprites usar (`base` vs `combat`) y actualiza la textura del sprite.
*   **Generación de Claves**: Las animaciones se generan con claves únicas como `char-1-walk` o `char-1-slash`, permitiendo tener múltiples personajes con diferentes assets.

```javascript
// Uso en PlayerSprite.js
playAnimation(key) {
  // Prefijo automático con ID del personaje
  const fullKey = `char-${this.characterId}-${key}`;
  this.sprite.play(fullKey, true);
}
```

## 2. Niveles y Colisiones (Lobby)

### Conceptos de Phaser Utilizados
*   **Arcade Physics**: Sistema de física ligero para colisiones AABB (Axis-Aligned Bounding Box).
*   **Static Groups**: Grupos de objetos físicos que no se mueven ni son afectados por la gravedad (ideales para muros, suelo, obstáculos).
*   **Colliders**: Objetos que monitorean y resuelven colisiones entre dos objetos o grupos.

### Implementación en el Proyecto

#### A. Muros y Obstáculos (`staticGroup`)
En `LobbyScene.js`, utilizamos `this.physics.add.staticGroup()` para gestionar todos los muros del mapa. Esto es mucho más eficiente que crear cuerpos físicos individuales.

```javascript
// Creación del grupo
this.walls = this.physics.add.staticGroup();

// Añadir un muro
this.walls.create(x, y, 'wall-texture').refreshBody();

// Habilitar colisión con el jugador
this.physics.add.collider(this.player, this.walls);
```

#### B. Editor de Mapas Integrado (Admin Only)
Para facilitar el diseño de niveles sin herramientas externas, implementamos un editor completo dentro del juego, accesible solo para administradores:

**4 Tipos de Tile:**
| Tipo | Textura | Física | Color |
|---|---|---|---|
| Wall | `tile-wall` | `staticGroup` (colisionable) | `#666666` |
| Floor | `tile-floor` | `add.group()` (visual) | `#8B7355` |
| Spawn | `tile-spawn` | `add.group()` (marcador) | `#00CC66` |
| NPC Zone | `tile-npc` | `add.group()` (marcador) | `#4488FF` |

**Herramientas:**
1.  **Brush** (`B`): Click o arrastra para colocar tiles.
2.  **Eraser** (`E`): Click o arrastra para borrar tiles.
3.  **Rectangle** (`R`): Click-drag para previsualizar un área, fill al soltar.

**Cursor Preview**: Un fantasma del tile sigue el mouse, mostrando coordenadas de grid.

**Undo/Redo**: Historial de acciones con `Ctrl+Z` / `Ctrl+Y`. Soporta place, remove y replace.

**Comunicación React ↔ Phaser**: Via `CustomEvent` (`editor-command` y `editor-stats`).

**Exportación**: Multi-tipo JSON `{walls, floors, spawns, npcZones}` — retrocompatible con el formato antiguo de array.

```javascript
// Ejemplo de texturas generadas en preload()
const tileTypes = [
  { key: 'tile-wall',  fill: 0x666666, stroke: 0x444444 },
  { key: 'tile-floor', fill: 0x8B7355, stroke: 0x6B5335 },
];
tileTypes.forEach(({ key, fill, stroke }) => {
  const g = this.make.graphics({ add: false });
  g.fillStyle(fill);
  g.fillRect(0, 0, 50, 50);
  g.lineStyle(2, stroke);
  g.strokeRect(0, 0, 50, 50);
  g.generateTexture(key, 50, 50);
  g.destroy();
});
```

## 3. Resumen de Flujo de Carga

1.  **Preload**:
    *   `MainScene` o `LobbyScene` llaman a `loadCharacterSprites(this)`.
    *   Se iteran todos los personajes en `CharacterConfig` y se cargan sus imágenes.
2.  **Create**:
    *   Se llama a `createCharacterAnimations(this)` para registrar todas las animaciones en el `AnimationManager` global.
    *   Se inicializan los grupos físicos (`staticGroup` para muros).
    *   Se instancian los jugadores (`PlayerSprite`) y se configuran sus colisionadores.

## Referencias Oficiales
*   [Phaser 3 API Documentation - Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade)
*   [Phaser 3 Examples - Static Groups](https://phaser.io/examples/v3/view/physics/arcade/static-group)
*   [Phaser 3 API - Animation Manager](https://docs.phaser.io/phaser/concepts/gameobjects/group)
