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
      
      // Simple check: if it's already in the texture manager, don't load again.
      // Phaser's internal loader handles "already in queue" automatically by key.
      if (sheet.json && !scene.textures.exists(key)) {
        console.log(`[NPCConfig] Loading atlas: ${key} from ${sheet.path}`);
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
