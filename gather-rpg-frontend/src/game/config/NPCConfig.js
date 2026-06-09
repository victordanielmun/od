import { animationsByNPC as generatedAnims } from '../../../public/npcs/_animationsByNPC_generated.js';

export const AVAILABLE_NPCS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']; // IDs de templateId en DB

export const NPC_CONFIG = {
  npcs: AVAILABLE_NPCS.map(id => ({
    id,
    sheets: [
      { type: 'portrait', path: `/npcs/${id}a.png`, json: `/npcs/${id}a.json` },
      { type: 'body', path: `/npcs/${id}b.png`, json: `/npcs/${id}b.json` }
    ]
  })),

  // Función de utilidad para verificar si un NPC tiene recursos de atlas
  hasAssets: (npcId, type = 'any') => {
      const stringId = String(npcId).replace('sprite', '');
      if (type === 'any') return AVAILABLE_NPCS.includes(stringId);
      return AVAILABLE_NPCS.includes(stringId);
  },

  // Mapeo dinámico generado por map_npc_frames.cjs
  animationsByNPC: generatedAnims,

  // Mapeo de voces de alta calidad (edge-tts) para cada NPC
  voices: {
    '1': 'en-US-GuyNeural',
    '2': 'en-US-AriaNeural',
    '3': 'en-US-GuyNeural',
    '4': 'en-GB-SoniaNeural',
    '5': 'en-US-GuyNeural',
    '6': 'en-US-AriaNeural',
    '7': 'en-US-GuyNeural',
    '8': 'en-GB-SoniaNeural',
    '9': 'en-US-GuyNeural',
    '10': 'en-US-AriaNeural',
    '11': 'en-US-GuyNeural',
    '12': 'en-GB-SoniaNeural',
    '13': 'en-US-GuyNeural',
    'default': 'en-US-GuyNeural'
  }
};

/**
 * Mapeo de estados de la IA a nombres de animación
 */
export const STATE_TO_ANIM = {
  idle:      { portrait: 'portrait-idle',      body: 'idle-waiting' },
  waiting:   { portrait: 'portrait-waiting',   body: 'idle-waiting' },
  talking:   { portrait: 'portrait-talking',   body: 'talking' },
  thinking:  { portrait: 'portrait-thinking',  body: 'talking' },
  surprised: { portrait: 'portrait-surprised', body: 'talking' },
  angry:     { portrait: 'portrait-angry',     body: 'talking' },
  happy:     { portrait: 'portrait-happy',     body: 'happy-grateful' },
  grateful:  { portrait: 'portrait-grateful',  body: 'happy-grateful' },
  sad:       { portrait: 'portrait-sad',       body: 'sad' }
};

export const loadNPCSprites = (scene) => {
  NPC_CONFIG.npcs.forEach(npc => {
    npc.sheets.forEach(sheet => {
      const key = `npc-${npc.id}-${sheet.type}`;
      
      // Only queue if the texture is not already in the cache.
      // Phaser's loader automatically skips files already loaded.
      if (sheet.json && !scene.textures.exists(key)) {
        console.log(`[NPCConfig] Queueing atlas: ${key}`);
        scene.load.atlas(key, sheet.path, sheet.json);
      }
    });
  });
};

export const createNPCAnimations = (scene) => {
  NPC_CONFIG.npcs.forEach(npc => {
    const npcAnims = NPC_CONFIG.animationsByNPC[npc.id];
    if (!npcAnims) return;

    Object.entries(npcAnims).forEach(([animName, config]) => {
      const textureKey = `npc-${npc.id}-${config.type}`;
      const animKey = `npc-${npc.id}-${animName}`;

      // SAFETY: Don't create animation if texture is missing
      if (!scene.textures.exists(textureKey)) {
        console.warn(`[NPCConfig] Cannot create animation ${animKey}: Texture ${textureKey} not found`);
        return;
      }

      if (!scene.anims.exists(animKey)) {
        const frames = config.frames.map(f => ({ key: textureKey, frame: f }));
        
        // Filter out frames that don't exist in the texture to avoid Phaser crashes
        const validFrames = frames.filter(f => {
            const texture = scene.textures.get(f.key);
            return texture && texture.has(f.frame);
        });

        if (validFrames.length > 0) {
          scene.anims.create({
            key: animKey,
            frames: validFrames,
            frameRate: config.frameRate,
            repeat: config.repeat
          });
        } else {
          console.warn(`[NPCConfig] Animation ${animKey} has no valid frames in texture ${textureKey}`);
        }
      }
    });
  });
};

/**
 * Definiciones de ataques del jugador para el sistema de combate Beat 'em up
 * 
 * activeFrames : índices de frame (en la animación) donde el hitbox está activo
 * damage       : HP que quita al enemigo
 * offsetX/Y    : posición del hitbox relativa al jugador
 * width/height : tamaño del hitbox
 * knockback    : dirección/fuerza del empuje
 * hitStopMs    : milisegundos de hitstop al conectar
 * screenShake  : true = cámara vibra al conectar
 * linkFrame    : frame desde el cual se acepta el siguiente input del combo
 */
export const PLAYER_ATTACKS = {
  // ── Combo de puños (Final Fight) ─────────────────────────────────────────
  combo1: {
    activeFrames: [2, 3],           // Jab — frames de contacto rápidos
    damage:       10,
    offsetX:      46, offsetY: -8,
    width:        50, height: 34,
    knockback:    { x: 0.4, y: -0.05 },
    hitStopMs:    50,
    linkFrame:    4,                // Input siguiente aceptado desde frame 4
  },
  combo2: {
    activeFrames: [2, 3],           // Cross — mismo rango, más daño
    damage:       13,
    offsetX:      50, offsetY: -6,
    width:        54, height: 36,
    knockback:    { x: 0.6, y: -0.1 },
    hitStopMs:    60,
    linkFrame:    4,
  },
  combo3_finisher: {
    activeFrames: [3, 4, 5],        // Uppercut — más frames activos, más peso
    damage:       30,               // Supera knockThreshold (20) → KNOCKED
    offsetX:      44, offsetY: -14,
    width:        62, height: 46,
    knockback:    { x: 1.8, y: -0.6 },
    hitStopMs:    100,
    screenShake:  true,
  },
  // ── Ataques independientes ────────────────────────────────────────────────
  kick: {
    activeFrames: [2, 3, 4],
    damage:       22,
    offsetX:      52, offsetY: 0,
    width:        58, height: 40,
    knockback:    { x: 1.2, y: -0.3 },
    hitStopMs:    70,
  },
  strong: {
    activeFrames: [4, 5],
    damage:       35,               // Supera knockThreshold → KNOCKED
    offsetX:      44, offsetY: -4,
    width:        64, height: 44,
    knockback:    { x: 1.8, y: -0.5 },
    hitStopMs:    100,
    screenShake:  true,
  },
  block_combo: {
    activeFrames: [],               // Sin hitbox — animación defensiva
    damage:       0,
    offsetX:      0, offsetY: 0,
    width:        1, height: 1,
    knockback:    { x: 0, y: 0 },
    hitStopMs:    0,
  },

  // ── Habilidades del sheet 1b ─────────────────────────────────────────────
  /**
   * special = Spell — explosión mágica frontal corta
   * El SpellSystem dispara el efecto visual; aquí solo ponemos un hitbox
   * de apoyo para el frame de impacto (~frame 3).
   */
  special: {
    activeFrames: [2, 3, 4],
    damage:       35,
    offsetX:      60, offsetY: -10,
    width:        80, height:  55,
    knockback:    { x: 1.2, y: -0.4 },
    hitStopMs:    90,
    screenShake:  true,
  },

  /**
   * projectile = Throw — lanzamiento de proyectil, daño al primer enemigo tocado.
   * El frame activo es amplio (toda la fase de vuelo); HitboxSystem activa un
   * hitbox delante del jugador mientras la animación lo indica.
   */
  projectile: {
    activeFrames: [1, 2, 3, 4, 5],
    damage:       28,
    offsetX:      90, offsetY: -5,
    width:        30, height:  30,
    knockback:    { x: 1.5, y: -0.2 },
    hitStopMs:    70,
  },

  /**
   * block — bloqueo activo del jugador (sheet 1a fila 5)
   * Sin daño; el PlayerController usa este nombre para activar la animación
   * y reducir el daño entrante mientras se mantiene la tecla.
   */
  block: {
    activeFrames: [],
    damage:       0,
    offsetX:      0, offsetY: 0,
    width:        1, height:  1,
    knockback:    { x: 0, y: 0 },
    hitStopMs:    0,
  },
};

