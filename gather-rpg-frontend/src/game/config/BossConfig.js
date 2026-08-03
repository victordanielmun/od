// Configuración de sprites del BOSS. Usa la MISMA estructura que un Character
// (hojas base/combat/avatar), pero cargada desde /boss/ y registrada con claves
// 'boss-<id>-<sheet>' / animaciones 'boss-<id>-<anim>'.
import { animationsByCharacter as animationsByBoss } from '../../../public/boss/_animationsByCharacter_generated.js';
import { versioned } from './assetVersion';

export const AVAILABLE_BOSSES = Object.keys(animationsByBoss);

// Mapeo de estado FSM del boss → animación (set de character).
export const BOSS_STATE_TO_ANIM = {
  idle:    'idle',
  wander:  'walk',
  chase:   'walk',
  attack:  'combo1',
  skill:   'special',
  throw:   'projectile',
  charge:  'walk',
  hurt:    'hurt',
  knocked: 'hurt',
  dead:    'die',
};

export const BOSS_CONFIG = {
  bosses: AVAILABLE_BOSSES.map(id => ({
    id,
    // Fallback de escala. En partida, EnemySprite normaliza el boss por el alto real
    // de su frame a 1.25× el objetivo del personaje (ver BOSS_SIZE_FACTOR). Este valor
    // solo se usa si no se puede leer el frame base.
    scale: 0.375,
    sheets: [
      { type: 'base',   path: `/boss/${id}b.png`, json: `/boss/${id}b.json` },
      { type: 'combat', path: `/boss/${id}a.png`, json: `/boss/${id}a.json` },
      { type: 'avatar', path: `/boss/${id}c.png`, json: `/boss/${id}c.json` },
    ],
  })),
  animationsByBoss,
};

export const loadBossSprites = (scene) => {
  BOSS_CONFIG.bosses.forEach(boss => {
    boss.sheets.forEach(sheet => {
      const key = `boss-${boss.id}-${sheet.type}`;
      if (!scene.textures.exists(key)) {
        scene.load.atlas(key, versioned(sheet.path), versioned(sheet.json));
      }
    });
  });
};

export const createBossAnimations = (scene) => {
  BOSS_CONFIG.bosses.forEach(boss => {
    const anims = BOSS_CONFIG.animationsByBoss[boss.id];
    if (!anims) return;
    Object.entries(anims).forEach(([animName, cfg]) => {
      const textureKey = `boss-${boss.id}-${cfg.sheetType}`;
      const animKey = `boss-${boss.id}-${animName}`;
      if (!scene.anims.exists(animKey) && scene.textures.exists(textureKey)) {
        scene.anims.create({
          key: animKey,
          frames: cfg.frames.map(f => ({ key: textureKey, frame: f })),
          frameRate: cfg.frameRate,
          repeat: cfg.repeat,
        });
      }
    });
  });
};

// Escala de render del boss (para el sprite interno de alta resolución).
export const getBossScale = (id) => {
  const b = BOSS_CONFIG.bosses.find(x => String(x.id) === String(id));
  return b ? b.scale : 0.375;
};
