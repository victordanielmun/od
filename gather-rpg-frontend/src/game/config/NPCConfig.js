export const AVAILABLE_NPCS = ['2']; // IDs de templateId en DB

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
      if (type === 'any') return AVAILABLE_NPCS.includes(String(npcId));
      // Podríamos ser más específicos aquí si algún NPC solo tiene portrait o solo body
      return AVAILABLE_NPCS.includes(String(npcId));
  },

  // Mapeo manual basado en los JSON originales (renombrados por map_npc_frames.cjs)
  animationsByNPC: {
    '2': {
      // --- Portraits (NPC A) ---
      'portrait-idle':      { type: 'portrait', frames: ['idle'], frameRate: 1, repeat: -1 },
      'portrait-talking':   { type: 'portrait', frames: ['talking'], frameRate: 1, repeat: -1 },
      'portrait-happy':     { type: 'portrait', frames: ['happy'], frameRate: 1, repeat: -1 },
      'portrait-angry':     { type: 'portrait', frames: ['angry'], frameRate: 1, repeat: -1 },
      'portrait-sad':       { type: 'portrait', frames: ['sad'], frameRate: 1, repeat: -1 },
      'portrait-surprised': { type: 'portrait', frames: ['surprised'], frameRate: 1, repeat: -1 },
      'portrait-thinking':  { type: 'portrait', frames: ['thinking'], frameRate: 1, repeat: -1 },
      'portrait-grateful':  { type: 'portrait', frames: ['grateful'], frameRate: 1, repeat: -1 },
      'portrait-waiting':   { type: 'portrait', frames: ['waiting'], frameRate: 1, repeat: -1 },
  
      // --- Body Animations (NPC B) ---
      'body-idle':     { type: 'body', frames: ['idle-waiting_0', 'idle-waiting_1', 'idle-waiting_2', 'idle-waiting_3', 'idle-waiting_4', 'idle-waiting_5'], frameRate: 8, repeat: -1 },
      'body-talking':  { type: 'body', frames: ['talking_0', 'talking_1', 'talking_2', 'talking_3', 'talking_4', 'talking_5'], frameRate: 8, repeat: -1 },
      'body-happy':    { type: 'body', frames: ['happy-grateful_0', 'happy-grateful_1', 'happy-grateful_2', 'happy-grateful_3', 'happy-grateful_4', 'happy-grateful_5'], frameRate: 8, repeat: -1 },
      'body-sad':      { type: 'body', frames: ['sad_0', 'sad_1', 'sad_2', 'sad_3', 'sad_4', 'sad_5'], frameRate: 8, repeat: -1 },
      'body-walk':     { type: 'body', frames: ['walking_0', 'walking_1', 'walking_2', 'walking_3', 'walking_4', 'walking_5'], frameRate: 10, repeat: -1 },
      'body-die':      { type: 'body', frames: ['dying_0', 'dying_1', 'dying_2', 'dying_3', 'dying_4', 'dying_5'], frameRate: 8, repeat: 0 }
    }
  },

  // Mapeo de voces de alta calidad (edge-tts) para cada NPC
  voices: {
    '2': 'en-US-AriaNeural', // Trainer (Female)
    'default': 'en-US-GuyNeural' // Default Male
  }
};

/**
 * Mapeo de estados de la IA a nombres de animación
 */
export const STATE_TO_ANIM = {
  idle:      { portrait: 'portrait-idle',      body: 'body-idle' },
  waiting:   { portrait: 'portrait-waiting',   body: 'body-idle' },
  talking:   { portrait: 'portrait-talking',   body: 'body-talking' },
  thinking:  { portrait: 'portrait-thinking',  body: 'body-talking' },
  surprised: { portrait: 'portrait-surprised', body: 'body-talking' },
  angry:     { portrait: 'portrait-angry',     body: 'body-talking' },
  happy:     { portrait: 'portrait-happy',     body: 'body-happy' },
  grateful:  { portrait: 'portrait-grateful',  body: 'body-happy' },
  sad:       { portrait: 'portrait-sad',       body: 'body-sad' }
};

export const loadNPCSprites = (scene) => {
  NPC_CONFIG.npcs.forEach(npc => {
    npc.sheets.forEach(sheet => {
      const key = `npc-${npc.id}-${sheet.type}`;
      if (sheet.json) {
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

      if (!scene.anims.exists(animKey)) {
        scene.anims.create({
          key: animKey,
          frames: config.frames.map(f => ({ key: textureKey, frame: f })),
          frameRate: config.frameRate,
          repeat: config.repeat
        });
      }
    });
  });
};
