/**
 * MapManager.js
 * Gestiona el estado del mapa: grupos de tiles, carga desde servidor,
 * redimensionado y cálculo de límites de cámara.
 *
 * Responsabilidades extraídas a módulos especializados:
 *  - Registro de tipos → TileRegistry.js
 *  - Colocación de tiles → TilePlacer.js
 *  - Serialización JSON → MapSerializer.js
 */

import api from '../../services/api';
import { useGameStore } from '../../store/gameStore';
import { TileRegistry }  from './TileRegistry';
import { TilePlacer }    from './TilePlacer';
import { MapSerializer } from './MapSerializer';

export class MapManager {
  constructor(scene) {
    this.scene = scene;

    // Dimensiones y metadatos del mapa
    this.mapWidth          = 3200;
    this.mapHeight         = 3200;
    this.mapDefaultSpawnX  = 1600;
    this.mapDefaultSpawnY  = 1600;
    this.mapIsPublic       = false;
    this.mapMaxUsers       = 50;

    // Estado interno
    this.currentMapLimits  = null;
    this.cameraBoundsDirty = true;

    // Objetos de escena
    this.backgroundRect = null;
    this.gridGraphics   = null;

    // Grupos de tiles (se inicializan en createMap)
    this.walls          = null;
    this.floors         = null;
    this.forest         = null;
    this.builds         = null;
    this.spawns         = null;
    this.npcZones       = null;
    this.pickups        = null;
    this.voids          = null;
    this.colliders      = null;
    this.storeTiles     = null;
    this.storeFurniture = null;
    this.enemySpawns    = null;

    // Módulos especializados (inicializados después de createMap)
    this._registry = null;
    this._placer   = null;
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  createMap() {
    const G = this.scene.GRID_SIZE;

    this.backgroundRect = this.scene.add.rectangle(
      this.mapWidth / 2, this.mapHeight / 2,
      this.mapWidth, this.mapHeight, 0x2a2a2a
    );
    this.backgroundRect.setDepth(-100);

    this.gridGraphics = this.scene.add.graphics();
    this.gridGraphics.setVisible(false);

    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
      this.walls          = this.scene.physics.add.staticGroup();
      this.floors         = this.scene.add.group();
      this.forest         = this.scene.physics.add.staticGroup();
      this.builds         = this.scene.physics.add.staticGroup();
      this.spawns         = this.scene.add.group();
      this.npcZones       = this.scene.add.group();
      this.pickups        = this.scene.add.group();
      this.voids          = this.scene.physics.add.staticGroup();
      this.colliders      = this.scene.physics.add.staticGroup();
      this.storeTiles     = this.scene.add.group();
      this.storeFurniture = this.scene.physics.add.staticGroup();
      this.enemySpawns    = this.scene.add.group();
    } else {
      console.warn('[MapManager] Physics system not found. Creating fallback groups.');
      const addGroup = () => this.scene.add.group();
      this.walls = this.floors = this.forest = this.builds = addGroup();
      this.spawns = this.npcZones = this.pickups = addGroup();
      this.voids = this.colliders = this.storeTiles = addGroup();
      this.storeFurniture = this.enemySpawns = addGroup();
    }

    // Inicializar módulos que dependen de los grupos
    this._registry = new TileRegistry(this);
    this._placer   = new TilePlacer(this.scene, this._registry);

    // Muros de ejemplo para el primer cargado
    for (let x = 200; x < 600; x += G) {
      this.walls.create(x, 400, 'tile-wall').refreshBody();
    }
  }

  clearMap() {
    const groups = [
      this.walls, this.floors, this.forest, this.builds,
      this.spawns, this.npcZones, this.pickups, this.voids,
      this.colliders, this.storeTiles, this.storeFurniture, this.enemySpawns,
    ];
    groups.forEach(g => g?.clear(true, true));
  }

  // ─── Carga desde servidor ─────────────────────────────────────────────────

  loadServerMapConfig(sceneKey) {
    console.log(`[MapManager] Loading map config for: ${sceneKey}`);
    this.scene.isMapLoading = true;
    useGameStore.setState({ isMapLoading: true });

    return api.get('/maps/config', { params: { scene_key: sceneKey } })
      .then(response => {
        const mapCfg = response.data;
        let config = {};

        try {
          config = mapCfg?.walls_json ? JSON.parse(mapCfg.walls_json) : {};
        } catch {
          config = {};
        }

        if (mapCfg?.map_data) {
          try {
            const md = typeof mapCfg.map_data === 'string' ? JSON.parse(mapCfg.map_data) : mapCfg.map_data;
            if (md?.width) config.width = md.width;
            if (md?.height) config.height = md.height;
            if (md?.defaultSpawnX != null) this.mapDefaultSpawnX = Number(md.defaultSpawnX);
            if (md?.defaultSpawnY != null) this.mapDefaultSpawnY = Number(md.defaultSpawnY);

            if (md?.furniture) config.furniture = md.furniture;
            if (md?.furniture2) config.furniture2 = md.furniture2;
            if (md?.enemySpawns) config.enemySpawns = md.enemySpawns;

            if (md?.bgmTrack && md.bgmTrack !== 'none') {
              this.scene.playBGM?.(md.bgmTrack);
            } else {
              this.scene.playBGM?.(null);
            }
          } catch (e) {
            console.error('[MapManager] Error parsing map_data', e);
          }
        } else {
          this.scene.playBGM?.(null);
        }

        if (mapCfg?.is_public !== undefined) this.mapIsPublic = !!mapCfg.is_public;
        if (mapCfg?.max_users !== undefined) this.mapMaxUsers = Number(mapCfg.max_users);

        this.loadMapConfig(JSON.stringify(config));

        if (this.scene.playerManager?.createMyPlayer) {
          this.scene.playerManager.createMyPlayer();
          this.scene.playerManager.handlePlayersUpdate(useGameStore.getState().players);
        }
      })
      .catch(err => {
        if (err?.response?.status === 404) {
          console.log('[MapManager] Map not found (new map?), clearing defaults.');
          this.clearMap();
        } else {
          console.warn('[MapManager] Failed to load map config:', err?.response?.status, err?.message);
        }

        this.scene.playBGM?.(null);

        if (this.scene.playerManager?.createMyPlayer) {
          this.scene.playerManager.createMyPlayer();
          this.scene.playerManager.handlePlayersUpdate(useGameStore.getState().players);
        }
      })
      .finally(() => {
        this.scene.isMapLoading = false;
        useGameStore.setState({ isMapLoading: false });
        window.dispatchEvent(new Event('game-ready'));
      });
  }

  /**
   * Carga la configuración del mapa desde un JSON (string o ya parseado).
   * @param {string|Object} jsonConfig
   */
  loadMapConfig(jsonConfig) {
    MapSerializer.import(this, jsonConfig);
  }

  // ─── Redimensionado ───────────────────────────────────────────────────────

  resizeMap(width, height) {
    if (this.mapWidth === width && this.mapHeight === height) return;

    console.log(`[MapManager] Resizing map to ${width}x${height}`);
    this.mapWidth  = width;
    this.mapHeight = height;

    this.scene.physics?.world?.setBounds(0, 0, width, height);
    this.scene.cameras?.main?.setBounds(0, 0, width, height);

    if (this.backgroundRect) {
      this.backgroundRect.setPosition(width / 2, height / 2).setSize(width, height);
    }
    if (this.gridGraphics && this.scene.editorMode) {
      this._rebuildEditorGrid(width, height);
    }

    this.cameraBoundsDirty = true;
    this.calculateMapLimits();
  }

  _rebuildEditorGrid(width, height) {
    if (!this.gridGraphics) return;
    const G = this.scene.GRID_SIZE;
    this.gridGraphics.clear().setVisible(true).lineStyle(1, 0x333333, 0.5);
    for (let x = 0; x <= width;  x += G) { this.gridGraphics.moveTo(x, 0).lineTo(x, height); }
    for (let y = 0; y <= height; y += G) { this.gridGraphics.moveTo(0, y).lineTo(width,  y); }
    this.gridGraphics.strokePath();
  }

  // ─── Límites y cámara ────────────────────────────────────────────────────

  calculateMapLimits() {
    let minX = this.mapWidth, maxX = 0, minY = this.mapHeight, maxY = 0;
    let found = false;
    const groups = [
      this.floors, this.walls, this.forest, this.builds,
      this.spawns, this.npcZones, this.pickups, this.colliders,
      this.storeTiles, this.storeFurniture, this.enemySpawns,
    ];
    groups.forEach(group => {
      group?.getChildren?.().forEach(child => {
        if (child.x - 50 < minX) minX = child.x - 50;
        if (child.x + 50 > maxX) maxX = child.x + 50;
        if (child.y - 50 < minY) minY = child.y - 50;
        if (child.y + 50 > maxY) maxY = child.y + 50;
        found = true;
      });
    });
    this.currentMapLimits = found
      ? { minX: Math.max(0, Math.floor(minX)), maxX: Math.min(this.mapWidth, Math.ceil(maxX)),
          minY: Math.max(0, Math.floor(minY)), maxY: Math.min(this.mapHeight, Math.ceil(maxY)) }
      : { minX: 0, maxX: this.mapWidth, minY: 0, maxY: this.mapHeight };
    this.cameraBoundsDirty = true;
  }

  updateCameraBounds() {
    if (!this.cameraBoundsDirty || !this.scene.player) return;
    if (this.scene.editorMode && this.scene.editorMoveMode === 'camera') return;

    const cam = this.scene.cameras.main;
    const zoom = cam.zoom || 1;
    let [left, right, top, bottom] = [0, this.mapWidth, 0, this.mapHeight];
    const cw = cam.width / zoom, ch = cam.height / zoom;

    if (right - left   < cw) { const mx = (left + right)   / 2; left  = mx - cw / 2; right  = mx + cw / 2; }
    if (bottom - top   < ch) { const my = (top  + bottom)  / 2; top   = my - ch / 2; bottom = my + ch / 2; }

    cam.setBounds(left, top, right - left, bottom - top);
    this.cameraBoundsDirty = false;
  }

  // ─── Metadatos del mapa ───────────────────────────────────────────────────

  updateMapMetadata(settings) {
    if (!settings) return;
    if (settings.isPublic    !== undefined) this.mapIsPublic       = !!settings.isPublic;
    if (settings.maxUsers    !== undefined) this.mapMaxUsers       = Number(settings.maxUsers);
    if (settings.defaultSpawnX !== undefined) this.mapDefaultSpawnX = Number(settings.defaultSpawnX);
    if (settings.defaultSpawnY !== undefined) this.mapDefaultSpawnY = Number(settings.defaultSpawnY);
    if (settings.bgmTrack && settings.bgmTrack !== 'none') {
      this.scene.playBGM?.(settings.bgmTrack);
    }
  }

  // ─── Delegaciones a módulos especializados ────────────────────────────────

  /** @see TilePlacer#place */
  _placeTileDirect(type, gx, gy, frame = null, metadata = null, scale = null) {
    this._placer.place(type, gx, gy, frame, metadata, scale);
  }

  /** @see TileRegistry#getTexture */
  _getTextureForType(type) {
    return this._registry.getTexture(type);
  }

  /** @see TileRegistry#getGroup */
  _getGroupForType(type) {
    return this._registry.getGroup(type);
  }

  /** @see TileRegistry#findAt */
  _findTileAt(gx, gy, targetType = null) {
    return this._registry.findAt(gx, gy, targetType);
  }

  /** @see TileRegistry#findAll */
  _findAllTilesAt(gx, gy) {
    return this._registry.findAll(gx, gy);
  }

  /** @see MapSerializer#export */
  exportMapConfig() {
    return MapSerializer.export(this);
  }

  /** @see MapSerializer#import */
  importMapConfig(config) {
    MapSerializer.import(this, config);
  }

  // Setup helpers expuestos para loadMapConfig (que los llama directamente)
  _setupForestSprite(sprite)    { this._placer._setupForestSprite(sprite); }
  _setupBuildSprite(sprite)     { this._placer._setupBuildSprite(sprite); }
  _setupFurnitureSprite(sprite) { this._placer._setupFurnitureSprite(sprite); }
}
