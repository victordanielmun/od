import { animationsByCharacter } from '../../../public/characters/_animationsByCharacter_generated.js';

// Agrega aquí los IDs de los nuevos personajes que vayas subiendo a /public/characters/
const AVAILABLE_CHARACTERS = ['1', '2', '3', '4'];

export const CHARACTER_CONFIG = {
  // Configuración base para todos los spritesheets de personajes
  // No se usa frameWidth/Height porque usamos Texture Atlas (JSON)
  base: {
    scale: 1,
  },

  // Generamos la lista de personajes dinámicamente basada en los IDs
  characters: AVAILABLE_CHARACTERS.map(id => ({
    id,
    sheets: [
      { type: 'base', path: `/characters/${id}a.png`, json: `/characters/${id}a.json` },
      { type: 'combat', path: `/characters/${id}b.png`, json: `/characters/${id}b.json` },
      { type: 'avatar', path: `/characters/${id}c.png`, json: `/characters/${id}c.json` }
    ]
  })),

  // ⚙️  AUTO-GENERADO por map_character_frames.cjs  — node map_character_frames.cjs para regenerar
  animationsByCharacter: animationsByCharacter
};

/**
 * Helper para cargar todos los sprites definidos como Atlas
 * @param {Phaser.Scene} scene 
 */
export const loadCharacterSprites = (scene) => {
  CHARACTER_CONFIG.characters.forEach(char => {
    char.sheets.forEach(sheet => {
      // Key format: char-{id}-{type} -> e.g., char-1-base, char-1-combat
      const key = `char-${char.id}-${sheet.type}`;

      // Only queue load if key is not already in texture cache
      if (!scene.textures.exists(key)) {
        if (sheet.json) {
          // Carga como Atlas (Textura + JSON)
          scene.load.atlas(key, sheet.path, sheet.json);
        } else {
          // Fallback a spritesheet clásico si no hay JSON (no usado actualmente)
          scene.load.spritesheet(key, sheet.path, {
            frameWidth: 48, frameHeight: 48
          });
        }
      }
    });
  });
};

/**
 * Helper para crear animaciones para todos los personajes cargados
 * @param {Phaser.Scene} scene 
 */
export const createCharacterAnimations = (scene) => {
  CHARACTER_CONFIG.characters.forEach(char => {
    // Obtener las animaciones específicas del personaje o las del personaje '1' como fallback
    const charAnimations =
      CHARACTER_CONFIG.animationsByCharacter[char.id] ||
      CHARACTER_CONFIG.animationsByCharacter['1'];

    Object.entries(charAnimations).forEach(([animName, config]) => {
      // Texture key to use for this animation
      const textureKey = `char-${char.id}-${config.sheetType}`;

      // Animation key: char-{id}-{animName} -> e.g., char-1-walk, char-1-slash
      const animKey = `char-${char.id}-${animName}`;

      if (!scene.anims.exists(animKey)) {
        // Generar frames usando los nombres del JSON
        const frames = config.frames.map(frameName => ({
          key: textureKey,
          frame: frameName
        }));

        scene.anims.create({
          key: animKey,
          frames: frames,
          frameRate: config.frameRate,
          repeat: config.repeat
        });
      }
    });
  });
};
