/**
 * TileRegistry.js
 * Centraliza el registro de tipos de tile:
 *  - mapeo tipo → textura atlas
 *  - mapeo tipo → grupo Phaser
 *  - búsqueda de tiles por posición
 *
 * Extraído de MapManager.js para mantener SRP (Single Responsibility Principle).
 */

/** Tolerancia en píxeles para búsqueda de tiles (cubre offsets de physics static groups) */
const FIND_TOLERANCE = 2;

/** Map de tipo de tile → clave de textura en el TextureManager de Phaser */
const TEXTURE_MAP = {
  wall:      'tile-wall',
  floor:     'tile-floor',
  spawn:     'tile-spawn',
  npc:       'tile-npc',
  enemy:     'tile-enemy',
  forest:    'forest',
  build:     'builds',
  exit:      'builds',       // exit comparte atlas con build
  void:      'tile-void',
  collider:  'tile-collider',
  store:     'store-tiles',
  furniture: 'store-furniture',
  furniture2: 'store-furniture2',
  item:      'tile-item',
};

export class TileRegistry {
  /**
   * @param {MapManager} mapManager - Instancia de MapManager que provee los grupos
   */
  constructor(mapManager) {
    this.mm = mapManager;
  }

  /**
   * Retorna la clave de textura para el tipo de tile dado.
   * @param {string} type
   * @returns {string}
   */
  getTexture(type) {
    return TEXTURE_MAP[type] || 'tile-wall';
  }

  /**
   * Retorna el grupo Phaser correspondiente al tipo de tile.
   * @param {string} type
   * @returns {Phaser.GameObjects.Group|Phaser.Physics.Arcade.StaticGroup|null}
   */
  getGroup(type) {
    const mm = this.mm;
    switch (type) {
      case 'wall':      return mm.walls;
      case 'floor':     return mm.floors;
      case 'forest':    return mm.forest;
      case 'build':
      case 'exit':      return mm.builds;   // exit usa el mismo grupo que build
      case 'spawn':     return mm.spawns;
      case 'npc':       return mm.npcZones;
      case 'item':      return mm.pickups;
      case 'void':      return mm.voids;
      case 'collider':  return mm.colliders;
      case 'store':     return mm.storeTiles;
      case 'furniture':
      case 'furniture2': return mm.storeFurniture;
      case 'enemy':     return mm.enemySpawns;
      default:          return mm.walls;
    }
  }

  /**
   * Busca el primer tile en la posición (gx, gy).
   * Si se especifica targetType, solo busca ese tipo.
   * @param {number} gx
   * @param {number} gy
   * @param {string|null} targetType
   * @returns {{ tile: Phaser.GameObjects.GameObject, type: string, group: Phaser.GameObjects.Group }|null}
   */
  findAt(gx, gy, targetType = null) {
    const mm = this.mm;
    // El orden define la prioridad: los más "superiores" se buscan primero
    const searchOrder = [
      { group: mm.storeFurniture, type: 'furniture' },
      { group: mm.builds,         type: 'build' },
      { group: mm.npcZones,       type: 'npc' },
      { group: mm.pickups,        type: 'item' },
      { group: mm.forest,         type: 'forest' },
      { group: mm.walls,          type: 'wall' },
      { group: mm.spawns,         type: 'spawn' },
      { group: mm.storeTiles,     type: 'store' },
      { group: mm.floors,         type: 'floor' },
      { group: mm.voids,          type: 'void' },
      { group: mm.colliders,      type: 'collider' },
      { group: mm.enemySpawns,    type: 'enemy' },
    ];

    for (const item of searchOrder) {
      if (!item.group) continue;
      if (targetType && item.type !== targetType) continue;
      const found = item.group.getChildren().find(
        t => Math.abs(t.x - gx) <= FIND_TOLERANCE && Math.abs(t.y - gy) <= FIND_TOLERANCE
      );
      if (found) {
        let actualType = item.type;
        if (actualType === 'furniture' && found.texture.key === 'store-furniture2') {
          actualType = 'furniture2';
        }
        return { tile: found, type: actualType, group: item.group };
      }
    }
    return null;
  }

  /**
   * Retorna todos los tiles en la posición (gx, gy), de todos los grupos.
   * @param {number} gx
   * @param {number} gy
   * @returns {Array<{ tile: Phaser.GameObjects.GameObject, type: string, group: Phaser.GameObjects.Group }>}
   */
  findAll(gx, gy) {
    const mm = this.mm;
    const entries = [
      { group: mm.walls,          type: 'wall' },
      { group: mm.floors,         type: 'floor' },
      { group: mm.forest,         type: 'forest' },
      { group: mm.builds,         type: 'build' },
      { group: mm.spawns,         type: 'spawn' },
      { group: mm.npcZones,       type: 'npc' },
      { group: mm.pickups,        type: 'item' },
      { group: mm.voids,          type: 'void' },
      { group: mm.colliders,      type: 'collider' },
      { group: mm.storeTiles,     type: 'store' },
      { group: mm.storeFurniture, type: 'furniture' },
      { group: mm.enemySpawns,    type: 'enemy' },
    ];

    const result = [];
    for (const { group, type } of entries) {
      if (!group) continue;
      const tile = group.getChildren().find(
        t => Math.abs(t.x - gx) <= FIND_TOLERANCE && Math.abs(t.y - gy) <= FIND_TOLERANCE
      );
      if (tile) {
        let actualType = type;
        if (actualType === 'furniture' && tile.texture.key === 'store-furniture2') {
          actualType = 'furniture2';
        }
        result.push({ tile, type: actualType, group });
      }
    }
    return result;
  }
}
