import { animationsByEnemy as generatedAnims } from '../../../public/enemys/_animationsByEnemy_generated.js';
import { versioned } from './assetVersion';

export const AVAILABLE_ENEMIES = ['1', '2', '3', '4', '5', '6'];

export const ENEMY_CONFIG = {
  enemies: AVAILABLE_ENEMIES.map(id => ({
    id,
    sheets: [
      { type: 'body', path: `/enemys/${id}a.png`, json: `/enemys/${id}a.json` }
    ]
  })),

  // Mapeo dinámico generado por map_enemy_frames.cjs
  animationsByEnemy: generatedAnims,

  // Mapeo de estados de la FSM a animaciones
  STATE_TO_ANIM: {
    idle:    'idle',
    chase:   'walking',
    attack:  'attack',
    throw:   'attack',
    skill:   'attack',
    charge:  'walking',
    hurt:    'hurt',
    knocked: 'knocked',
    dead:    'dying'
  }
};

export const loadEnemySprites = (scene) => {
  ENEMY_CONFIG.enemies.forEach(enemy => {
    enemy.sheets.forEach(sheet => {
      const key = `enemy-${enemy.id}-${sheet.type}`;
      if (sheet.json && !scene.textures.exists(key)) {
        scene.load.atlas(key, versioned(sheet.path), versioned(sheet.json));
      }
    });
  });
};

export const createEnemyAnimations = (scene) => {
  ENEMY_CONFIG.enemies.forEach(enemy => {
    const enemyAnims = ENEMY_CONFIG.animationsByEnemy[enemy.id];
    if (!enemyAnims) return;

    Object.entries(enemyAnims).forEach(([animName, config]) => {
      const textureKey = `enemy-${enemy.id}-${config.type}`;
      const animKey = `enemy-${enemy.id}-${animName}`;

      if (scene.textures.exists(textureKey) && !scene.anims.exists(animKey)) {
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
