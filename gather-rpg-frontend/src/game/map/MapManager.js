import * as Phaser from 'phaser';
import api from '../../services/api';
import { useGameStore } from '../../store/gameStore';

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    
    this.mapWidth = 3200;
    this.mapHeight = 3200;
    this.mapDefaultSpawnX = 1600;
    this.mapDefaultSpawnY = 1600;
    this.mapIsPublic = false;
    this.mapMaxUsers = 50;
    
    this.currentMapLimits = null;
    this.cameraBoundsDirty = true;
    
    this.backgroundRect = null;
    this.gridGraphics = null;

    this.walls = null;
    this.floors = null;
    this.forest = null;
    this.builds = null;
    this.spawns = null;
    this.npcZones = null;
    this.pickups = null;
    this.voids = null;
    this.colliders = null;
    this.storeTiles = null;
    this.storeFurniture = null;
    this.enemySpawns = null;
  }

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
      this.walls = this.scene.physics.add.staticGroup();
      this.floors = this.scene.add.group();
      this.forest = this.scene.physics.add.staticGroup();
      this.builds = this.scene.physics.add.staticGroup();
      this.spawns = this.scene.add.group();
      this.npcZones = this.scene.add.group();
      this.pickups = this.scene.add.group();
      this.voids = this.scene.physics.add.staticGroup();
      this.colliders = this.scene.physics.add.staticGroup();
      this.storeTiles = this.scene.add.group();
      this.storeFurniture = this.scene.physics.add.staticGroup();
      this.enemySpawns = this.scene.add.group();
    } else {
      console.warn('[MapManager] Physics system not found in scene. Creating fallback groups.');
      this.walls = this.scene.add.group();
      this.floors = this.scene.add.group();
      this.forest = this.scene.add.group();
      this.builds = this.scene.add.group();
      this.spawns = this.scene.add.group();
      this.npcZones = this.scene.add.group();
      this.pickups = this.scene.add.group();
      this.voids = this.scene.add.group();
      this.colliders = this.scene.add.group();
      this.storeTiles = this.scene.add.group();
      this.storeFurniture = this.scene.add.group();
      this.enemySpawns = this.scene.add.group();
    }

    // Default walls for first load
    for (let x = 200; x < 600; x += G) {
      this.walls.create(x, 400, 'tile-wall').refreshBody();
    }
  }

  clearMap() {
    this.walls.clear(true, true);
    this.floors.clear(true, true);
    this.forest.clear(true, true);
    this.builds.clear(true, true);
    this.spawns.clear(true, true);
    this.npcZones.clear(true, true);
    this.pickups.clear(true, true); 
    this.voids.clear(true, true);
    this.colliders.clear(true, true);
    this.storeTiles?.clear(true, true);
    this.storeFurniture?.clear(true, true);
    this.enemySpawns?.clear(true, true);
  }

  loadServerMapConfig(sceneKey) {
    console.log(`[MapManager] Loading map config for: ${sceneKey}`);

    return api.get('/maps/config', { params: { scene_key: sceneKey } })
      .then(response => {
        if (response.data) {
          console.log('[MapManager] Loaded map config from server', response.data);

          let config = {};
          try {
            config = response.data.walls_json ? JSON.parse(response.data.walls_json) : {};
          } catch { config = {}; }

          if (response.data.map_data) {
            try {
              const md = typeof response.data.map_data === 'string' ? JSON.parse(response.data.map_data) : response.data.map_data;
              if (md.width) config.width = md.width;
              if (md.height) config.height = md.height;
              if (md.defaultSpawnX != null) this.mapDefaultSpawnX = Number(md.defaultSpawnX);
              if (md.defaultSpawnY != null) this.mapDefaultSpawnY = Number(md.defaultSpawnY);

              if (md.bgmTrack && md.bgmTrack !== 'none') {
                this.scene.playBGM(md.bgmTrack);
              } else {
                this.scene.playBGM(null);
              }
            } catch (e) { console.error('Error parsing map_data', e); }
          } else {
            this.scene.playBGM(null);
          }

          this.loadMapConfig(JSON.stringify(config));

          if (this.scene.player) {
            if (this.walls) this.scene.physics.add.collider(this.scene.player, this.walls);
            if (this.forest) this.scene.physics.add.collider(this.scene.player, this.forest);
            if (this.builds) this.scene.physics.add.collider(this.scene.player, this.builds);
          }
        }
      })
      .catch(err => {
        if (err.response?.status === 404) {
          console.log('[MapManager] Map not found (new map?), clearing defaults.');
          this.clearMap();
        } else {
          console.warn('[MapManager] Failed to load map config from server:', err.message);
        }
        this.scene.playBGM(null);
      })
      .finally(() => {
        this.scene.isMapLoading = false;
        // Sync with store for UI components
        useGameStore.setState({ isMapLoading: false });

        if (this.scene.playerManager) {
            this.scene.playerManager.createMyPlayer();
            this.scene.playerManager.handlePlayersUpdate(useGameStore.getState().players);
        }

        // Notify React that the world is loaded and ready
        console.log('[MapManager] World fully loaded. Dispatching game-ready.');
        window.dispatchEvent(new Event('game-ready'));
      });
  }

  loadMapConfig(jsonConfig) {
    if (!jsonConfig) return;
    try {
      const data = JSON.parse(jsonConfig);

      if (Array.isArray(data)) {
        this.resizeMap(800, 800);
        this.clearMap();
        data.forEach(w => this.walls.create(w.x, w.y, 'tile-wall').refreshBody());
        return;
      }

      const w = data.width || 800;
      const h = data.height || 800;
      this.resizeMap(w, h);

      if (data.defaultSpawnX != null) this.mapDefaultSpawnX = Number(data.defaultSpawnX);
      if (data.defaultSpawnY != null) this.mapDefaultSpawnY = Number(data.defaultSpawnY);

      this.clearMap();

      (data.walls || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        this.walls.create(w.x, w.y, 'walls', frame).refreshBody();
      });
      (data.floors || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        const s = this.scene.add.image(w.x, w.y, 'terrain', frame);
        s.setDisplaySize(this.scene.GRID_SIZE, this.scene.GRID_SIZE);
        s.setDepth(-10);
        this.floors.add(s);
      });
      (data.forest || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        const s = this.forest.create(w.x, w.y, 'forest', frame);
        s.setScale(1.8);
        this._setupForestSprite(s);
      });
      (data.builds || []).forEach((w, idx) => {
        const frame = w.frame || 'sprite1';
        const scale = w.scale || 2.5;
        const s = this.builds.create(w.x, w.y, 'builds', frame);
        s.setScale(scale);
        s.data = new Phaser.Data.DataManager(s);
        s.data.set('buildScale', scale);
        
        if (w.targetMap !== undefined) s.data.set('targetMap', w.targetMap);
        if (w.targetRoute !== undefined) s.data.set('targetRoute', w.targetRoute);
        if (w.targetX !== undefined) s.data.set('targetX', w.targetX);
        if (w.targetY !== undefined) s.data.set('targetY', w.targetY);
        if (w.interactionText !== undefined) s.data.set('interactionText', w.interactionText);
        if (w.portalType !== undefined) s.data.set('portalType', w.portalType);
        
        this._setupBuildSprite(s);
      });
      (data.spawns || []).forEach(w => { const s = this.scene.add.sprite(w.x, w.y, 'tile-spawn'); s.setAlpha(0.8); s.setVisible(this.scene.editorMode); this.spawns.add(s); });
      (data.npcZones || []).forEach(w => {
        const s = this.scene.add.sprite(w.x, w.y, 'tile-npc');
        s.setAlpha(0.8);
        s.setVisible(this.scene.editorMode);
        s.data = new Phaser.Data.DataManager(s);
        if (w.definitionId !== undefined) s.data.set('definitionId', w.definitionId);
        if (w.role !== undefined) s.data.set('role', w.role);
        if (w.missionIds !== undefined) {
          s.data.set('missionIds', w.missionIds);
        } else if (w.missionId !== undefined) {
          s.data.set('missionIds', [w.missionId]);
          s.data.set('missionId', w.missionId);
        }
        if (w.templateId !== undefined) s.data.set('templateId', w.templateId);
        this.npcZones.add(s);
      });
      (data.enemySpawns || []).forEach(w => {
        const s = this.scene.add.sprite(w.x, w.y, 'tile-enemy');
        s.setAlpha(0.8);
        s.setVisible(this.scene.editorMode);
        s.data = new Phaser.Data.DataManager(s);
        if (w.npcId !== undefined) s.data.set('npcId', w.npcId);
        if (w.waveNum !== undefined) s.data.set('waveNum', w.waveNum);
        if (w.hp !== undefined) s.data.set('hp', w.hp);
        if (w.speed !== undefined) s.data.set('speed', w.speed);
        if (w.damage !== undefined) s.data.set('damage', w.damage);
        if (w.attackRate !== undefined) s.data.set('attackRate', w.attackRate);
        this.enemySpawns.add(s);
      });
      (data.pickups || []).forEach(w => {
        const s = this.scene.add.sprite(w.x, w.y, 'tile-item');
        s.setAlpha(0.8);
        s.setVisible(this.scene.editorMode);
        s.data = new Phaser.Data.DataManager(s);
        if (w.itemId !== undefined) s.data.set('itemId', w.itemId);
        if (w.quantity !== undefined) s.data.set('quantity', w.quantity);
        this.pickups.add(s);
      });
      (data.voids || []).forEach(w => { this.voids.create(w.x, w.y, 'tile-void').refreshBody().setVisible(this.scene.editorMode); });
      
      const colls = data.colliders || data.collider || [];
      colls.forEach(w => { 
        this.colliders.create(w.x, w.y, 'tile-collider').refreshBody().setVisible(this.scene.editorMode); 
      });

      (data.storeTiles || []).forEach(w => {
        const sprite = this.scene.add.image(w.x, w.y, 'store-tiles', w.frame || 'sprite1');
        sprite.setDisplaySize(this.scene.GRID_SIZE, this.scene.GRID_SIZE);
        sprite.setDepth(-10);
        this.storeTiles.add(sprite);
      });

      (data.furniture || []).forEach(w => {
        const sprite = this.storeFurniture.create(w.x, w.y, 'store-furniture', w.frame || 'sprite1');
        this._setupFurnitureSprite(sprite);
      });

      this.calculateMapLimits();
    } catch (e) {
      console.error('[MapManager] Failed to load map config', e);
    }
  }

  resizeMap(width, height) {
    if (this.mapWidth === width && this.mapHeight === height) return;

    console.log(`[MapManager] Resizing map to ${width}x${height}`);
    this.mapWidth = width;
    this.mapHeight = height;

    if (this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.setBounds(0, 0, width, height);
    }
    
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.setBounds(0, 0, width, height);
    }

    if (this.backgroundRect) {
      this.backgroundRect.setPosition(width / 2, height / 2);
      this.backgroundRect.setSize(width, height);
    }

    if (this.gridGraphics && this.scene.editorMode) {
      this._rebuildEditorGrid(width, height);
    }
    
    this.cameraBoundsDirty = true;
    this.calculateMapLimits();
  }

  _rebuildEditorGrid(width, height) {
    if (!this.gridGraphics) return;
    this.gridGraphics.clear();
    this.gridGraphics.setVisible(true);
    this.gridGraphics.lineStyle(1, 0x333333, 0.5);

    const G = this.scene.GRID_SIZE;
    for (let x = 0; x <= width; x += G) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += G) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(width, y);
    }
    this.gridGraphics.strokePath();
  }

  calculateMapLimits() {
    let minX = this.mapWidth, maxX = 0, minY = this.mapHeight, maxY = 0;
    let found = false;

    const groups = [
      this.floors, this.walls, this.forest, this.builds, 
      this.spawns, this.npcZones, this.pickups, this.colliders,
      this.storeTiles, this.storeFurniture, this.enemySpawns
    ];

    groups.forEach(group => {
      if (!group) return;
      const children = group.getChildren ? group.getChildren() : [];
      children.forEach(child => {
        const xMin = child.x - 50;
        const xMax = child.x + 50;
        const yMin = child.y - 50;
        const yMax = child.y + 50;
        
        if (xMin < minX) minX = xMin;
        if (xMax > maxX) maxX = xMax;
        if (yMin < minY) minY = yMin;
        if (yMax > maxY) maxY = yMax;
        found = true;
      });
    });

    if (!found) {
      this.currentMapLimits = { minX: 0, maxX: this.mapWidth, minY: 0, maxY: this.mapHeight };
    } else {
      this.currentMapLimits = {
        minX: Math.max(0, Math.floor(minX)),
        maxX: Math.min(this.mapWidth, Math.ceil(maxX)),
        minY: Math.max(0, Math.floor(minY)),
        maxY: Math.min(this.mapHeight, Math.ceil(maxY))
      };
    }
    this.cameraBoundsDirty = true;
  }

  updateMapMetadata(settings) {
    if (!settings) return;
    if (settings.isPublic !== undefined) this.mapIsPublic = !!settings.isPublic;
    if (settings.maxUsers !== undefined) this.mapMaxUsers = Number(settings.maxUsers);
    if (settings.defaultSpawnX !== undefined) this.mapDefaultSpawnX = Number(settings.defaultSpawnX);
    if (settings.defaultSpawnY !== undefined) this.mapDefaultSpawnY = Number(settings.defaultSpawnY);
    
    if (settings.bgmTrack && settings.bgmTrack !== 'none') {
        if (this.scene && typeof this.scene.playBGM === 'function') {
            this.scene.playBGM(settings.bgmTrack);
        }
    }
  }

  exportMapConfig() {
    const data = {
      width: this.mapWidth,
      height: this.mapHeight,
      defaultSpawnX: this.mapDefaultSpawnX,
      defaultSpawnY: this.mapDefaultSpawnY,
      bgmTrack: this.scene.currentBgmTrackId || 'none',
      isPublic: this.mapIsPublic || false,
      maxUsers: this.mapMaxUsers || 50,
      walls: this.walls.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: (t.frame.name === '__BASE' || t.texture.key === 'tile-wall') ? 'sprite1' : t.frame.name
      })),
      floors: this.floors.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      forest: this.forest.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      builds: this.builds.getChildren().map(t => ({
        x: t.x, y: t.y, frame: t.frame.name,
        scale: t.data?.get('buildScale') || t.scaleX || 1,
        ...(t.data?.get('targetMap') !== undefined ? { targetMap: t.data.get('targetMap') } : {}),
        ...(t.data?.get('targetRoute') !== undefined ? { targetRoute: t.data.get('targetRoute') } : {}),
        ...(t.data?.get('targetX') !== undefined ? { targetX: t.data.get('targetX') } : {}),
        ...(t.data?.get('targetY') !== undefined ? { targetY: t.data.get('targetY') } : {}),
        ...(t.data?.get('interactionText') !== undefined ? { interactionText: t.data.get('interactionText') } : {}),
        ...(t.data?.get('portalType') !== undefined ? { portalType: t.data.get('portalType') } : {}),
      })),
      spawns: this.spawns.getChildren().map(t => ({ x: t.x, y: t.y })),
      npcZones: this.npcZones.getChildren().map(t => ({
        x: t.x, y: t.y,
        definitionId: t.data?.get('definitionId'),
        role: t.data?.get('role'),
        missionIds: t.data?.get('missionIds'),
        missionId: t.data?.get('missionId'), 
        templateId: t.data?.get('templateId')
      })),
      pickups: this.pickups.getChildren().map(t => ({
        x: t.x, y: t.y,
        itemId: t.data?.get('itemId'),
        quantity: t.data?.get('quantity') || 1
      })),
      voids: this.voids.getChildren().map(t => ({ x: t.x, y: t.y })),
      colliders: this.colliders.getChildren().map(t => ({ x: t.x, y: t.y })),
      storeTiles: this.storeTiles.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      furniture: this.storeFurniture.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      enemySpawns: this.enemySpawns.getChildren().map(t => ({
        x: t.x, y: t.y,
        npcId: t.data?.get('npcId'),
        waveNum: t.data?.get('waveNum') || 1,
        hp: t.data?.get('hp'),
        speed: t.data?.get('speed'),
        damage: t.data?.get('damage'),
        attackRate: t.data?.get('attackRate')
      })),
    };
    return JSON.stringify(data, null, 2);
  }

  importMapConfig(config) {
    if (!config) return;
    try {
      const data = typeof config === 'string' ? JSON.parse(config) : config;
      this.scene.editor?.clearAllTiles();
      if (data.width) this.mapWidth = data.width;
      if (data.height) this.mapHeight = data.height;
      this.resizeMap(this.mapWidth, this.mapHeight);
      
      if (data.defaultSpawnX != null) this.mapDefaultSpawnX = Number(data.defaultSpawnX);
      if (data.defaultSpawnY != null) this.mapDefaultSpawnY = Number(data.defaultSpawnY);
      if (data.isPublic !== undefined) this.mapIsPublic = !!data.isPublic;
      if (data.maxUsers !== undefined) this.mapMaxUsers = Number(data.maxUsers);
      
      if (data.bgmTrack && data.bgmTrack !== 'none') {
        this.scene.currentBgmTrackId = data.bgmTrack;
      }
      
      this.scene.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
      if (this.backgroundRect) {
        this.backgroundRect.setSize(this.mapWidth, this.mapHeight);
        this.backgroundRect.setPosition(this.mapWidth / 2, this.mapHeight / 2);
      }
      
      if (this.gridGraphics) {
        this._rebuildEditorGrid(this.mapWidth, this.mapHeight);
      }

      if (data.floors) data.floors.forEach(t => this._placeTileDirect('floor', t.x, t.y, t.frame));
      if (data.walls) data.walls.forEach(t => this._placeTileDirect('wall', t.x, t.y, t.frame));
      if (data.forest) data.forest.forEach(t => this._placeTileDirect('forest', t.x, t.y, t.frame));
      if (data.builds) data.builds.forEach(t => {
        const metadata = {
          targetMap: t.targetMap,
          targetRoute: t.targetRoute,
          targetX: t.targetX,
          targetY: t.targetY,
          interactionText: t.interactionText,
          portalType: t.portalType,
          buildScale: t.scale
        };
        this._placeTileDirect('build', t.x, t.y, t.frame, metadata);
      });
      if (data.spawns) data.spawns.forEach(t => this._placeTileDirect('spawn', t.x, t.y));
      if (data.npcZones) data.npcZones.forEach(t => {
        const metadata = {
          definitionId: t.definitionId,
          role: t.role,
          missionId: t.missionId
        };
        this._placeTileDirect('npc', t.x, t.y, null, metadata);
      });
      if (data.pickups) data.pickups.forEach(t => {
        const metadata = {
          itemId: t.itemId,
          quantity: t.quantity
        };
        this._placeTileDirect('item', t.x, t.y, null, metadata);
      });
      if (data.voids) data.voids.forEach(t => this._placeTileDirect('void', t.x, t.y));
      if (data.colliders) data.colliders.forEach(t => this._placeTileDirect('collider', t.x, t.y));
      if (data.collider && !data.colliders) data.collider.forEach(t => this._placeTileDirect('collider', t.x, t.y)); 
      if (data.storeTiles) data.storeTiles.forEach(t => this._placeTileDirect('store', t.x, t.y, t.frame));
      if (data.furniture) data.furniture.forEach(t => this._placeTileDirect('furniture', t.x, t.y, t.frame));
      if (data.enemySpawns) data.enemySpawns.forEach(t => {
        const metadata = {
          npcId: t.npcId,
          waveNum: t.waveNum,
          hp: t.hp,
          speed: t.speed,
          attackRate: t.attackRate,
          damage: t.damage
        };
        this._placeTileDirect('enemy', t.x, t.y, null, metadata);
      });

      console.log('[MapManager] Map imported successfully');
      if (this.scene.editor) this.scene.editor.emitStats();
      this.scene.cameras.main.flash(300, 0, 150, 255);
    } catch (err) {
      console.error('[MapManager] Error importing map config:', err);
    }
  }

  _placeTileDirect(type, gx, gy, frame = null, metadata = null) {
    const texture = this.scene._getTextureForType(type);
    const group = this.scene._getGroupForType(type);

    if (type === 'wall') {
      const f = frame || 'sprite1';
      const sprite = group.create(gx, gy, 'walls', f);
      sprite.refreshBody();

    } else if (type === 'floor' || type === 'store') {
      const atlas = type === 'store' ? 'store-tiles' : 'terrain';
      const f = frame || 'sprite1';
      const sprite = this.scene.add.image(gx, gy, atlas, f);
      sprite.setDisplaySize(this.scene.GRID_SIZE, this.scene.GRID_SIZE);
      sprite.setDepth(-10);
      group.add(sprite);
    } else if (type === 'furniture') {
      const f = frame || 'sprite1';
      const sprite = group.create(gx, gy, 'store-furniture', f);
      sprite.setScale(1.0);
      this._setupFurnitureSprite(sprite);
    } else if (type === 'forest') {
      const f = frame || 'sprite1';
      const sprite = group.create(gx, gy, 'forest', f);
      sprite.setScale(1.8);
      this._setupForestSprite(sprite);
    } else if (type === 'build') {
      const f = frame || 'sprite1';
      const scale = (metadata && metadata.buildScale) || 2.5;
      const sprite = group.create(gx, gy, 'builds', f);
      sprite.setScale(scale);
      sprite.data = new Phaser.Data.DataManager(sprite);
      if (metadata) {
        if (metadata.targetMap !== undefined) sprite.data.set('targetMap', metadata.targetMap);
        if (metadata.targetRoute !== undefined) sprite.data.set('targetRoute', metadata.targetRoute);
        if (metadata.targetX !== undefined) sprite.data.set('targetX', metadata.targetX);
        if (metadata.targetY !== undefined) sprite.data.set('targetY', metadata.targetY);
        if (metadata.interactionText !== undefined) sprite.data.set('interactionText', metadata.interactionText);
        if (metadata.portalType !== undefined) sprite.data.set('portalType', metadata.portalType);
        sprite.data.set('buildScale', scale);
      }
      this._setupBuildSprite(sprite);
    } else if (type === 'npc') {
      const sprite = group.create(gx, gy, texture);
      sprite.setAlpha(0.8);
      sprite.setVisible(this.scene.editorMode);
      sprite.data = new Phaser.Data.DataManager(sprite);
      if (metadata) {
        sprite.data.set('definitionId', metadata.definitionId);
        sprite.data.set('role', metadata.role);
        sprite.data.set('missionId', metadata.missionId);
      }
    } else if (type === 'enemy') {
      const sprite = group.create(gx, gy, texture);
      sprite.setAlpha(0.8);
      sprite.setVisible(this.scene.editorMode);
      sprite.data = new Phaser.Data.DataManager(sprite);
      if (metadata) {
        sprite.data.set('npcId', metadata.npcId);
        sprite.data.set('waveNum', metadata.waveNum);
        sprite.data.set('hp', metadata.hp);
        sprite.data.set('speed', metadata.speed);
        sprite.data.set('damage', metadata.damage);
      }
    } else if (type === 'void') {
      const sprite = group.create(gx, gy, texture);
      sprite.setVisible(this.scene.editorMode);
    } else if (type === 'collider') {
      const sprite = group.create(gx, gy, texture);
      sprite.setVisible(this.scene.editorMode);
    } else {
      const sprite = this.scene.add.sprite(gx, gy, texture);
      sprite.setAlpha(0.8);
      sprite.setVisible(this.scene.editorMode);
      group.add(sprite);
    }
  }

  _setupForestSprite(sprite) {
    sprite.setDepth(sprite.y + (sprite.displayHeight * 0.5));
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
    sprite.refreshBody();
    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;
    const bodyW = dw * 0.7;
    const bodyH = dh * 0.3;
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  updateCameraBounds() {
    if (!this.cameraBoundsDirty) return;
    if (!this.scene.player || !this.currentMapLimits) return;
    if (this.scene.editorMode && this.scene.editorMoveMode === 'camera') return;

    const { minX, maxX, minY, maxY } = this.currentMapLimits;
    
    let leftBound = minX;
    let rightBound = maxX;
    let topBound = minY;
    let bottomBound = maxY;

    const camZoom = this.scene.cameras.main.zoom || 1;
    const camWidth = this.scene.cameras.main.width / camZoom;
    const camHeight = this.scene.cameras.main.height / camZoom;

    if (rightBound - leftBound < camWidth) {
      const midX = (leftBound + rightBound) / 2;
      leftBound = midX - camWidth / 2;
      rightBound = midX + camWidth / 2;
    }
    if (bottomBound - topBound < camHeight) {
      const midY = (topBound + bottomBound) / 2;
      topBound = midY - camHeight / 2;
      bottomBound = midY + camHeight / 2;
    }

    this.scene.cameras.main.setBounds(
      leftBound,
      topBound,
      rightBound - leftBound,
      bottomBound - topBound
    );
    this.cameraBoundsDirty = false;
  }

  _getTextureForType(type) {
    const map = { wall: 'tile-wall', floor: 'tile-floor', spawn: 'tile-spawn', npc: 'tile-npc', enemy: 'tile-enemy', forest: 'forest', build: 'builds', void: 'tile-void', collider: 'tile-collider' };
    return map[type] || 'tile-wall';
  }

  _getGroupForType(type) {
    switch (type) {
      case 'wall': return this.walls;
      case 'floor': return this.floors;
      case 'forest': return this.forest;
      case 'build': return this.builds;
      case 'spawn': return this.spawns;
      case 'npc': return this.npcZones;
      case 'item': return this.pickups;
      case 'void': return this.voids;
      case 'collider': return this.colliders;
      case 'store': return this.storeTiles;
      case 'furniture': return this.storeFurniture;
      case 'enemy': return this.enemySpawns;
      default: return this.walls;
    }
  }

  _findTileAt(gx, gy, targetType = null) {
    const searchOrder = [
      { group: this.storeFurniture, type: 'furniture' },
      { group: this.builds, type: 'build' },
      { group: this.npcZones, type: 'npc' },
      { group: this.pickups, type: 'item' },
      { group: this.forest, type: 'forest' },
      { group: this.walls, type: 'wall' },
      { group: this.spawns, type: 'spawn' },
      { group: this.storeTiles, type: 'store' },
      { group: this.floors, type: 'floor' },
      { group: this.voids, type: 'void' },
      { group: this.colliders, type: 'collider' },
      { group: this.enemySpawns, type: 'enemy' }
    ];

    for (const item of searchOrder) {
      if (!item.group) continue;
      if (targetType && item.type !== targetType) continue;
      const children = item.group.getChildren();
      const found = children.find(t => Math.abs(t.x - gx) < 1 && Math.abs(t.y - gy) < 1);
      if (found) return { tile: found, type: item.type, group: item.group };
    }
    return null;
  }

  _findAllTilesAt(gx, gy) {
    const groups = [this.walls, this.floors, this.forest, this.builds, this.spawns, this.npcZones, this.pickups, this.voids, this.colliders, this.storeTiles, this.storeFurniture, this.enemySpawns];
    const types = ['wall', 'floor', 'forest', 'build', 'spawn', 'npc', 'item', 'void', 'collider', 'store', 'furniture', 'enemy'];
    const found = [];
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      const children = groups[i].getChildren();
      const tile = children.find(t => Math.abs(t.x - gx) < 1 && Math.abs(t.y - gy) < 1);
      if (tile) found.push({ tile, type: types[i], group: groups[i] });
    }
    return found;
  }
}

