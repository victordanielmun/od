/**
 * TilePlacer.js
 * Contiene toda la lógica de colocación individual de tiles en la escena Phaser,
 * incluyendo la configuración de sus cuerpos físicos y profundidades.
 *
 * Extraído de MapManager.js para mantener SRP (Single Responsibility Principle).
 */

const Phaser = window.Phaser;

/** Frame seguro a usar cuando el frame real es '__BASE' o nulo */
const SAFE_FRAME = 'sprite1';

/**
 * Sanitiza un frame de atlas: convierte '__BASE' o vacío en SAFE_FRAME.
 * @param {string|null} frame
 * @returns {string}
 */
function sanitizeFrame(frame) {
  if (!frame || frame === '__BASE') return SAFE_FRAME;
  return frame;
}

export class TilePlacer {
  /**
   * @param {Phaser.Scene} scene - La escena Phaser activa
   * @param {import('./TileRegistry').TileRegistry} registry - Instancia de TileRegistry
   */
  constructor(scene, registry) {
    this.scene  = scene;
    this.registry = registry;
  }

  /**
   * Coloca un tile del tipo dado en la posición de grilla (gx, gy).
   * @param {string} type        - Tipo de tile ('wall', 'floor', 'forest', 'build', ...)
   * @param {number} gx          - Posición X en coordenadas de mundo
   * @param {number} gy          - Posición Y en coordenadas de mundo
   * @param {string|null} frame  - Frame del atlas (null = usar default del tipo)
   * @param {Object|null} metadata - Datos adicionales (para npc, enemy, build, item)
   * @param {number|null} scale  - Escala del sprite (solo para build/exit)
   */
  place(type, gx, gy, frame = null, metadata = null, scale = null) {
    const texture = this.registry.getTexture(type);
    const group   = this.registry.getGroup(type);

    switch (type) {
      case 'wall':
        this._placeWall(group, gx, gy, frame);
        break;

      case 'floor':
      case 'store':
        this._placeFlat(group, gx, gy, frame, type === 'store' ? 'store-tiles' : 'terrain');
        break;

      case 'forest':
        this._placeForest(group, gx, gy, frame);
        break;

      case 'build':
        this._placeBuild(group, gx, gy, frame, metadata, scale);
        break;

      case 'exit':
        this._placeExit(group, gx, gy, metadata, scale);
        break;

      case 'furniture':
        this._placeFurniture(group, gx, gy, frame, metadata, 'store-furniture');
        break;

      case 'furniture2':
        this._placeFurniture(group, gx, gy, frame, metadata, 'store-furniture2');
        break;

      case 'furniture3':
        this._placeFurniture(group, gx, gy, frame, metadata, 'furniture');
        break;

      case 'npc':
        this._placeNPC(group, gx, gy, texture, metadata);
        break;

      case 'enemy':
        this._placeEnemy(group, gx, gy, texture, metadata);
        break;

      case 'item':
        this._placeItem(group, gx, gy, texture, metadata);
        break;

      case 'spawn':
      case 'void':
      case 'collider':
        this._placeHidden(group, gx, gy, texture);
        break;

      default:
        this._placeFallback(group, gx, gy, texture);
        break;
    }
  }

  // ─── Métodos privados de colocación ──────────────────────────────────────

  _placeWall(group, gx, gy, frame) {
    const f = sanitizeFrame(frame);
    const sprite = group.create(gx, gy, 'walls', f);
    if (sprite.body && typeof sprite.refreshBody === 'function') {
      sprite.refreshBody();
    }
  }

  /** Tiles planos (suelo de terrain o store) — sin física, solo imagen */
  _placeFlat(group, gx, gy, frame, atlas) {
    const f = sanitizeFrame(frame);
    const sprite = this.scene.add.image(gx, gy, atlas, f);
    sprite.setDisplaySize(this.scene.GRID_SIZE, this.scene.GRID_SIZE);
    sprite.setDepth(-10);
    group.add(sprite);
  }

  _placeForest(group, gx, gy, frame) {
    const f = sanitizeFrame(frame);  // '__BASE' o null → 'sprite1'
    const sprite = group.create(gx, gy, 'forest', f);
    sprite.setScale(1.8);
    this._setupForestSprite(sprite);
  }

  _placeBuild(group, gx, gy, frame, metadata, scale) {
    const f = sanitizeFrame(frame);
    const originalScale = scale || (metadata?.buildScale) || 2.5;
    const renderedScale = originalScale * 1.25;
    const sprite = group.create(gx, gy, 'builds', f);
    sprite.setScale(renderedScale);
    sprite.data = new Phaser.Data.DataManager(sprite);
    if (metadata) {
      const keys = ['targetMap', 'targetRoute', 'targetX', 'targetY', 'interactionText', 'portalType', 'missionIds'];
      keys.forEach(k => { if (metadata[k] !== undefined) sprite.data.set(k, metadata[k]); });
    }
    sprite.data.set('buildScale', originalScale);
    this._setupBuildSprite(sprite);
  }

  /**
   * Coloca un tile 'exit' (teletransporte): un MARCADOR DE SALIDA a nivel de suelo,
   * no un edificio. Visualmente es un portal brillante con pulso para indicar que es
   * una salida; comparte el grupo `builds` para que el InteractionSystem lo detecte y
   * el jugador pueda usarlo con [E]. A diferencia de un edificio, NO bloquea el paso
   * (se puede caminar encima como un trigger de suelo).
   */
  _placeExit(group, gx, gy, metadata, scale) {
    this._ensureExitMarkerTexture();
    const s = scale || (metadata?.buildScale) || 1;
    const sprite = group.create(gx, gy, 'exit-marker');
    sprite.setDisplaySize(this.scene.GRID_SIZE * s, this.scene.GRID_SIZE * s);
    sprite.setDepth(-5); // sobre el suelo (-10), bajo jugadores/entidades
    sprite.data = new Phaser.Data.DataManager(sprite);
    sprite.data.set('isExit', true);
    if (metadata) {
      const keys = ['targetMap', 'targetRoute', 'targetX', 'targetY', 'interactionText', 'portalType', 'missionIds'];
      keys.forEach(k => { if (metadata[k] !== undefined) sprite.data.set(k, metadata[k]); });
    }
    sprite.data.set('buildScale', s);
    // Trigger de suelo: el cuerpo físico no debe empujar al jugador (se camina encima).
    if (sprite.body) sprite.body.enable = false;
    // Pulso continuo: indica visualmente que el suelo es una salida interactuable.
    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: { from: 0.6, to: 1 },
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  /** Genera (una sola vez) la textura del marcador de salida: un portal radial brillante. */
  _ensureExitMarkerTexture() {
    if (this.scene.textures.exists('exit-marker')) return;
    const size = 100;
    const c = size / 2;
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    // Halo exterior translúcido
    g.fillStyle(0xff6a00, 0.16); g.fillCircle(c, c, c * 0.92);
    g.fillStyle(0xff8c1a, 0.26); g.fillCircle(c, c, c * 0.66);
    // Anillos brillantes
    g.lineStyle(5, 0xffd34d, 0.95); g.strokeCircle(c, c, c * 0.62);
    g.lineStyle(3, 0xffffff, 0.85); g.strokeCircle(c, c, c * 0.42);
    // Núcleo
    g.fillStyle(0xffffff, 0.45); g.fillCircle(c, c, c * 0.18);
    g.generateTexture('exit-marker', size, size);
    g.destroy();
  }

  _placeFurniture(group, gx, gy, frame, metadata, atlas = 'store-furniture') {
    const f = sanitizeFrame(frame);
    const sprite = group.create(gx, gy, atlas, f);
    sprite.setScale(1.0);
    sprite.data = new Phaser.Data.DataManager(sprite);
    if (metadata) {
      if (metadata.minigameType !== undefined) sprite.data.set('minigameType', metadata.minigameType);
      if (metadata.minigameId !== undefined)   sprite.data.set('minigameId', metadata.minigameId);
      if (metadata.readText !== undefined)     sprite.data.set('readText', metadata.readText);
    }
    this._setupFurnitureSprite(sprite);
  }

  _placeNPC(group, gx, gy, texture, metadata) {
    const sprite = group.create(gx, gy, texture);
    sprite.setAlpha(0.8);
    sprite.setVisible(this.scene.editorMode);
    sprite.data = new Phaser.Data.DataManager(sprite);
    if (metadata) {
      if (metadata.definitionId !== undefined) sprite.data.set('definitionId', metadata.definitionId);
      if (metadata.role !== undefined)         sprite.data.set('role', metadata.role);
      if (metadata.state !== undefined)        sprite.data.set('state', metadata.state);
      if (metadata.facing !== undefined)       sprite.data.set('facing', metadata.facing);
      // Soportar tanto missionIds (array) como missionId (legacy singular)
      if (metadata.missionIds !== undefined) {
        sprite.data.set('missionIds', metadata.missionIds);
      } else if (metadata.missionId !== undefined) {
        sprite.data.set('missionIds', [metadata.missionId]);
        sprite.data.set('missionId', metadata.missionId);  // compat legacy
      }
    }
  }

  _placeEnemy(group, gx, gy, texture, metadata) {
    const sprite = group.create(gx, gy, texture);
    sprite.setAlpha(0.8);
    sprite.setVisible(this.scene.editorMode);
    sprite.data = new Phaser.Data.DataManager(sprite);
    if (metadata) {
      const keys = ['npcId', 'waveNum', 'hp', 'speed', 'damage', 'attackRate',
        'type', 'projectileSprite', 'manaMax', 'manaRegen', 'hpRegen', 'cardFailHealPct'];
      keys.forEach(k => { if (metadata[k] !== undefined) sprite.data.set(k, metadata[k]); });
    }
  }

  _placeItem(group, gx, gy, texture, metadata) {
    const sprite = group.create(gx, gy, texture);
    sprite.setAlpha(0.8);
    sprite.setVisible(this.scene.editorMode);
    sprite.data = new Phaser.Data.DataManager(sprite);
    if (metadata) {
      if (metadata.itemId !== undefined)   sprite.data.set('itemId', metadata.itemId);
      if (metadata.quantity !== undefined) sprite.data.set('quantity', metadata.quantity);
    }
  }

  /** Tiles invisibles en modo juego (void, collider) */
  _placeHidden(group, gx, gy, texture) {
    const sprite = group.create(gx, gy, texture);
    sprite.setVisible(this.scene.editorMode);
  }

  /** Fallback genérico para tipos no reconocidos */
  _placeFallback(group, gx, gy, texture) {
    const sprite = this.scene.add.sprite(gx, gy, texture);
    sprite.setAlpha(0.8);
    sprite.setVisible(this.scene.editorMode);
    group.add(sprite);
  }

  // ─── Setup de física y profundidad ───────────────────────────────────────

  _setupForestSprite(sprite) {
    sprite.setDepth(sprite.y + (sprite.displayHeight * 0.5));
    if (!sprite.body || typeof sprite.refreshBody !== 'function') {
      console.warn('[TilePlacer] _setupForestSprite: sprite sin body físico');
      return;
    }
    sprite.refreshBody();
    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;
    const bodyW = dw * 0.4;
    const bodyH = dh * 0.1;
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  _setupBuildSprite(sprite) {
    sprite.setDepth(sprite.y - (sprite.displayHeight * 0.1));
    if (!sprite.body || typeof sprite.refreshBody !== 'function') {
      console.warn('[TilePlacer] _setupBuildSprite: sprite sin body físico');
      return;
    }
    sprite.refreshBody();
    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;
    const bodyW = dw * 0.80;
    const bodyH = dh * 0.60;
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  _setupFurnitureSprite(sprite) {
    sprite.setDepth(sprite.y + (sprite.displayHeight * 0.5));
    if (!sprite.body || typeof sprite.refreshBody !== 'function') {
      console.warn('[TilePlacer] _setupFurnitureSprite: sprite sin body físico');
      return;
    }
    sprite.refreshBody();
    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;
    const bodyW = dw * 0.7;
    const bodyH = dh * 0.3;
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }
}
