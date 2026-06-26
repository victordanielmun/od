import { loadCharacterSprites } from '../config/CharacterConfig';
import { loadNPCSprites } from '../config/NPCConfig';
import { loadEnemySprites } from '../config/EnemyConfig';
import { loadBossSprites } from '../config/BossConfig';

// Editor tile marker textures generated at runtime (one per tile type).
const TILE_TYPES = [
  { key: 'tile-wall', fill: 0x666666, stroke: 0x444444, label: 'W' },
  { key: 'tile-floor', fill: 0x8B7355, stroke: 0x6B5335, label: 'F' },
  { key: 'tile-spawn', fill: 0x00CC66, stroke: 0x009944, label: 'S' },
  { key: 'tile-npc', fill: 0x4488FF, stroke: 0x2266DD, label: 'N' },
  { key: 'tile-item', fill: 0xE91E63, stroke: 0xC2185B, label: 'I' },
  // Void: #2596be, stroke same as fill so no visible border
  { key: 'tile-void', fill: 0x2596be, stroke: 0x2596be, label: 'V' },
  // Collider: Gold #FFD700, semi-transparent for editor visibility
  { key: 'tile-collider', fill: 0xFFD700, stroke: 0xDAA520, label: 'C' },
  { key: 'tile-enemy', fill: 0xFF4444, stroke: 0xCC0000, label: 'E' },
];

const SEMI_TRANSPARENT_TILES = new Set(['tile-npc', 'tile-item', 'tile-collider', 'tile-enemy']);

// Map atlases — [textureKey, imagePath, jsonPath]. Always loaded so the map
// editor and runtime stay stable regardless of which map is active.
const ATLASES = [
  ['terrain', '/terrain/terrain-spritesheet_extruido.png', '/terrain/terrain-sprites_extruido.json'],
  ['walls', '/wall/wall-spritesheet.png', '/wall/wall-sprites.json'],
  ['forest', '/forest/forest-spritesheet.png', '/forest/forest-sprites.json'],
  ['builds', '/builds/build-spritesheet.png', '/builds/build-sprites.json'],
  ['store-tiles', '/store/tiles.png', '/store/tiles.json'],
  ['store-furniture', '/store/furniture.png', '/store/furniture.json'],
  ['store-furniture2', '/store/furniture2.png', '/store/furniture2.json'],
  ['furniture', '/furniture/spritesheet.png', '/furniture/sprites.json'],
];

// Background music tracks — [cacheKey, path].
const AUDIO_KEYS = [
  ['bgm_pixelated_prelude', '/music/Pixelated_Prelude.mp3'],
  ['bgm_serene_village', '/music/Serene_Village.mp3'],
  ['bgm_whispering_woods', '/music/Whispering_Woods.mp3'],
  ['bgm_whispering_woods_past', '/music/Whispering_Woods_of_Pixel_Past.mp3'],
  ['bgm_whispers_glitch', '/music/Whispers_in_the_Glitch_Garden.mp3'],
  ['bgm_cave1', '/music/cave1.mp3'],
  ['bgm_fight_level', '/music/FightLevel.mp3'],
  ['bgm_fight_boss', '/music/FightBoss.mp3'],
  ['bgm_pixel_pantry', '/music/Pixel_Pantry_Jingle.mp3'],
  ['bgm_pixelated_haven', '/music/Pixelated_Haven.mp3'],
];

function createTileTextures(scene) {
  TILE_TYPES.forEach(({ key, fill, stroke, label }) => {
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const alpha = SEMI_TRANSPARENT_TILES.has(key) ? 0.3 : 1;
    g.fillStyle(fill, alpha);
    g.fillRect(0, 0, 100, 100);
    g.lineStyle(4, stroke, 1);
    g.strokeRect(0, 0, 100, 100);

    const t = scene.make.text({
      x: 50, y: 50,
      text: label,
      style: {
        fontSize: '64px',
        fontFamily: 'Arial Black',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
      },
      add: false
    });
    t.setOrigin(0.5);

    // Use RenderTexture to combine graphics and text into a single texture
    const rt = scene.make.renderTexture({ width: 100, height: 100, add: false });
    rt.draw(g);
    rt.draw(t);
    rt.saveTexture(key);

    rt.destroy();
    g.destroy();
    t.destroy();
  });

  // Keep legacy alias for backwards compatibility
  if (!scene.textures.exists('wall-texture')) {
    const gLegacy = scene.make.graphics({ x: 0, y: 0, add: false });
    gLegacy.fillStyle(0x666666);
    gLegacy.fillRect(0, 0, 100, 100);
    gLegacy.lineStyle(2, 0x000000);
    gLegacy.strokeRect(0, 0, 100, 100);
    gLegacy.generateTexture('wall-texture', 100, 100);
    gLegacy.destroy();
  }
}

// Loads every asset the LobbyScene needs. Called from LobbyScene.preload().
// All loads are guarded with exists() checks so scene restarts (e.g. map
// portal transitions) don't trigger "frame already exists" warnings.
export function preloadLobbyAssets(scene) {
  loadCharacterSprites(scene);
  loadNPCSprites(scene);
  loadEnemySprites(scene);
  loadBossSprites(scene);

  createTileTextures(scene);

  ATLASES.forEach(([key, image, json]) => {
    if (!scene.textures.exists(key)) scene.load.atlas(key, image, json);
  });

  AUDIO_KEYS.forEach(([key, path]) => {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, path);
  });
}
