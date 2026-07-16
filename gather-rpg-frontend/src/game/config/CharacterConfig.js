import { animationsByCharacter } from '../../../public/characters/_animationsByCharacter_generated.js';

// Los IDs de los personajes se detectan automáticamente desde el script generado
const AVAILABLE_CHARACTERS = Object.keys(animationsByCharacter);

export const DEFAULT_CHARACTER_SCALE = 1.5; // Escala global base de personajes (original + 0.5 de aumento)
export const TARGET_PLAYER_HEIGHT = 90;    // Altura objetivo en píxeles en el canvas (72px original * 1.25)

export const CHARACTER_CONFIG = {
  // Configuración base para todos los spritesheets de personajes
  // No se usa frameWidth/Height porque usamos Texture Atlas (JSON)
  base: {
    scale: DEFAULT_CHARACTER_SCALE,
    targetHeight: TARGET_PLAYER_HEIGHT,
    npcTargetHeight: 86, // Altura objetivo para NPCs (un poco más pequeños que los jugadores)
  },

  // Generamos la lista de personajes dinámicamente basada en los IDs
  characters: AVAILABLE_CHARACTERS.map(id => ({
    id,
    // Escala del personaje en el mapa
    scale: DEFAULT_CHARACTER_SCALE,
    sheets: [
      { type: 'base', path: `/characters/${id}b.png`, json: `/characters/${id}b.json` },
      { type: 'combat', path: `/characters/${id}a.png`, json: `/characters/${id}a.json` },
      { type: 'avatar', path: `/characters/${id}c.png`, json: `/characters/${id}c.json` },
      // Combo sheet (Xd.png) — solo personajes que lo tengan; se omite silenciosamente si no existe
      { type: 'combo', path: `/characters/${id}d.png`, json: `/characters/${id}d.json`, optional: true }
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
      // Key format: char-{id}-{type} -> e.g., char-1-base, char-1-combo
      const key = `char-${char.id}-${sheet.type}`;

      // Only queue load if key is not already in texture cache
      if (!scene.textures.exists(key)) {
        if (sheet.optional) {
          // Check if this sheet type is actually used in the character's animations
          const charAnims = CHARACTER_CONFIG.animationsByCharacter[char.id] || CHARACTER_CONFIG.animationsByCharacter['1'] || {};
          const isUsed = Object.values(charAnims).some(anim => anim.sheetType === sheet.type);
          if (!isUsed) {
            // Skip loading optional sheets that aren't defined in the animations
            return;
          }
        }
        if (sheet.json) {
          scene.load.atlas(key, sheet.path, sheet.json);
        } else {
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
