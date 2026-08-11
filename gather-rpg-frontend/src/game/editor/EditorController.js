import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import api from '../../services/api';

export class EditorController {
  constructor(scene) {
    this.scene = scene;

    // Editor state
    this.enabled = false;
    this.moveMode = 'camera'; // 'camera' | 'character'
    this.tool = 'brush';      // 'brush' | 'eraser' | 'rect' | 'marker' | 'inspector'
    this.tileType = 'wall';   // 'wall' | 'floor' | 'spawn' | 'npc'
    this.textureFrame = 'sprite1'; // Default terrain sprite
    this.history = [];
    this.redoStack = [];
    this._currentBatch = null;

    // Editor UI state
    this.cursorPreview = null;
    this.gridOverlay = null;
    this.isDragging = false;
    this.dragStartGrid = null;
    // Herramienta inspector: al hacer pointerdown sobre un tile existente se
    // agarra aquí para poder arrastrarlo (ver setupInput/_finishMovingTile).
    // null mientras no se está arrastrando nada.
    this._movingTile = null;
    this.rectPreview = null;
    this.cursorCoordLabel = null;
    this.tiles = new Map();

    this.buildScale = 2.5;
    this.buildMetadata = { portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '', missionIds: [] };
    this.npcMetadata = null;
    this.isEditingNPCRouteMode = false;
    this.routeOverlayGraphics = null;
    this.routeLabels = [];
    this.enemyMetadata = null;
    this.pickupMetadata = null;
    this.furnitureMetadata = null;

    this.GRID_SIZE = 100;

    this.onEditorEvent = this._handleEditorEvent.bind(this);
    window.addEventListener('editor-command', this.onEditorEvent);

    // Broadcast that we are ready to receive state sync from UI
    window.dispatchEvent(new CustomEvent('editor-controller-ready'));
  }

  pauseEnemies() {
    if (this.scene.activeEnemies) {
      this.scene.activeEnemies.forEach(enemy => {
        enemy.paused = true;
      });
    }
    window.dispatchEvent(new CustomEvent('editor-enemies-paused', { detail: { paused: true } }));
  }

  resumeEnemies() {
    if (this.scene.activeEnemies) {
      this.scene.activeEnemies.forEach(enemy => {
        enemy.paused = false;
      });
    }
    window.dispatchEvent(new CustomEvent('editor-enemies-paused', { detail: { paused: false } }));
  }

  destroy() {
    window.removeEventListener('editor-command', this.onEditorEvent);
  }

  setupUI() {
    const G = this.GRID_SIZE;

    // Cursor preview
    this.cursorPreview = this.scene.add.rectangle(0, 0, G, G, 0xffffff, 0.3);
    this.cursorPreview.setStrokeStyle(2, 0xffff00, 0.8);
    this.cursorPreview.setDepth(900);
    this.cursorPreview.setVisible(false);

    // Rect preview
    this.rectPreview = this.scene.add.graphics();
    this.rectPreview.setDepth(899);
    this.rectPreview.setVisible(false);

    // Coord label
    this.cursorCoordLabel = this.scene.add.text(0, 0, '', {
      fontSize: '10px', fill: '#ffff00',
      backgroundColor: '#00000088', padding: { x: 3, y: 2 }
    });
    this.cursorCoordLabel.setDepth(901);
    this.cursorCoordLabel.setVisible(false);

    this.setupInput();
  }

  setupInput() {
    const G = this.GRID_SIZE;

    this.scene.input.on('pointermove', (pointer) => {
      if (!this.enabled) return;
      const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gx = Math.floor(wp.x / G) * G + G / 2;
      const gy = Math.floor(wp.y / G) * G + G / 2;

      this.cursorPreview.setPosition(gx, gy);
      this.cursorCoordLabel.setPosition(gx + G / 2 + 4, gy - G / 2);
      this.cursorCoordLabel.setText(`${Math.floor(wp.x / G)},${Math.floor(wp.y / G)}`);

      if (this.isDragging && this.tool !== 'rect' && this.tool !== 'inspector') {
        this._editorPlaceOrErase(gx, gy);
      }

      if (this.isDragging && this.tool === 'rect' && this.dragStartGrid) {
        this._drawRectPreview(this.dragStartGrid.x, this.dragStartGrid.y, gx, gy);
      }

      // Arrastrando un tile agarrado con el inspector: lo seguimos con el
      // cursor, encajado a grilla, hasta soltar (ver pointerup).
      if (this.isDragging && this.tool === 'inspector' && this._movingTile) {
        this._movingTile.tile.setPosition(gx, gy);
      }
    });

    this.scene.input.on('pointerdown', (pointer) => {
      if (!this.enabled) {
        // console.log('[Editor] pointerdown ignored: editor not enabled');
        return;
      }
      if (pointer.rightButtonDown()) return;
      
      const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gx = Math.floor(wp.x / G) * G + G / 2;
      const gy = Math.floor(wp.y / G) * G + G / 2;

      if (this.isEditingNPCRouteMode) {
        if (gx < 0 || gx > this.scene.mapWidth || gy < 0 || gy > this.scene.mapHeight) return;
        const currentWaypoints = [...(this.npcMetadata?.waypoints || [])];
        currentWaypoints.push({ x: gx, y: gy, message: '', pauseMs: 0 });
        if (!this.npcMetadata) this.npcMetadata = {};
        this.npcMetadata.waypoints = currentWaypoints;
        window.dispatchEvent(new CustomEvent('editor-sync-npc-waypoints', { detail: currentWaypoints }));
        this.drawRoutePreview();
        return;
      }

      console.log(`[Editor] pointerdown at (${gx}, ${gy}) | mapSize: ${this.scene.mapWidth}x${this.scene.mapHeight}`);

      if (gx < 0 || gx > this.scene.mapWidth || gy < 0 || gy > this.scene.mapHeight) {
        return;
      }

      this.isDragging = true;
      this.dragStartGrid = { x: gx, y: gy };

      if (this.tool === 'marker') {
        window.dispatchEvent(new CustomEvent('editor-picked-coord', { detail: { x: gx, y: gy } }));
        const txt = this.scene.add.text(gx, gy, `📍 ${gx}, ${gy}`, {
          fontSize: '12px', fill: '#00ffcc', backgroundColor: '#000000bb', padding: { x: 4, y: 2 }
        });
        txt.setOrigin(0.5, 1);
        txt.setDepth(1005);
        this.scene.tweens.add({
          targets: txt,
          y: gy - 30,
          alpha: 0,
          duration: 1500,
          ease: 'Power2',
          onComplete: () => txt.destroy()
        });
        return;
      }

      if (this.tool !== 'rect') {
        if (this.tool === 'inspector') {
          this._pickObjectAt(gx, gy);
          // Si había un tile en esta celda, queda agarrado para arrastrarlo:
          // pointermove lo va siguiendo y pointerup decide dónde se suelta.
          const found = this.scene._findTileAt(gx, gy);
          if (found) {
            this._movingTile = { tile: found.tile, type: found.type, fromX: gx, fromY: gy, originalAlpha: found.tile.alpha };
            found.tile.setAlpha?.(0.6);
          }
        } else {
          console.log(`[Editor] Interaction: ${this.tool} on (${gx}, ${gy}) with tileType: ${this.tileType}`);
          this._editorPlaceOrErase(gx, gy);
        }
      }
    });

    this.scene.input.on('pointerup', () => {
      if (!this.enabled || !this.isDragging) return;
      this.isDragging = false;

      if (this.tool === 'rect' && this.dragStartGrid) {
        const wp = this.scene.cameras.main.getWorldPoint(
          this.scene.input.activePointer.x, this.scene.input.activePointer.y
        );
        const gx = Math.floor(wp.x / G) * G + G / 2;
        const gy = Math.floor(wp.y / G) * G + G / 2;
        this._editorFillRect(this.dragStartGrid.x, this.dragStartGrid.y, gx, gy);
        this.rectPreview.clear();
        this.rectPreview.setVisible(false);
      }

      if (this._movingTile) {
        this._finishMovingTile();
      }

      this.dragStartGrid = null;
    });
  }

  _handleEditorEvent(e) {
    const { action, value } = e.detail || {};
    console.log(`[EditorController] Event: ${action}`, value);
    
    switch (action) {
      case 'setTool': this.setTool(value); break;
      case 'setTileType': this.setTileType(value); break;
      case 'setTexture': this.setTexture(value); break;
      case 'setBuildMetadata': this.buildMetadata = value; break;
      case 'setBuildScale': this.buildScale = parseFloat(value) || 1; break;
      case 'setNPCMetadata': 
        this.npcMetadata = value; 
        if (this.isEditingNPCRouteMode) {
          this.drawRoutePreview();
        }
        break;
      case 'setEnemyMetadata': this.enemyMetadata = value; break;
      case 'setPickupMetadata': this.pickupMetadata = value; break;
      case 'setFurnitureMetadata': this.furnitureMetadata = value; break;
      case 'setMoveMode': this.setMoveMode(value); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'clearAll': this.clearAllTiles(); break;
      case 'importMap': this.importMapConfig(value); break;
      case 'applyBuildMetadata': this.applyBuildMetadataToAll(); break;
      case 'pauseEnemies': this.pauseEnemies(); break;
      case 'resumeEnemies': this.resumeEnemies(); break;
      case 'setEditingNpcRouteMode': this.setEditingNpcRouteMode(value); break;
    }
  }

  setEditingNpcRouteMode(enabled) {
    console.log(`[EditorController] setEditingNpcRouteMode: ${enabled}`);
    this.isEditingNPCRouteMode = enabled;
    if (enabled) {
      this.drawRoutePreview();
    } else {
      if (this.routeOverlayGraphics) {
        this.routeOverlayGraphics.clear();
      }
      if (this.routeLabels) {
        this.routeLabels.forEach(txt => txt.destroy());
      }
      this.routeLabels = [];
    }
  }

  drawRoutePreview() {
    if (!this.routeOverlayGraphics) {
      this.routeOverlayGraphics = this.scene.add.graphics().setDepth(10000);
    }
    this.routeOverlayGraphics.clear();
    
    if (this.routeLabels) {
      this.routeLabels.forEach(txt => txt.destroy());
    }
    this.routeLabels = [];
    
    const waypoints = this.npcMetadata?.waypoints || [];
    if (waypoints.length === 0) return;
    
    this.routeOverlayGraphics.lineStyle(3, 0xffa500, 0.8);
    this.routeOverlayGraphics.fillStyle(0xffa500, 1.0);
    
    for (let i = 0; i < waypoints.length; i++) {
      const pt = waypoints[i];
      this.routeOverlayGraphics.fillCircle(pt.x, pt.y, 8);
      
      const txt = this.scene.add.text(pt.x, pt.y - 18, `Pt ${i + 1}`, {
        fontSize: '10px',
        color: '#ffa500',
        backgroundColor: '#111111cc',
        padding: { x: 3, y: 1 }
      }).setOrigin(0.5).setDepth(10001);
      this.routeLabels.push(txt);
      
      if (i > 0) {
        const prev = waypoints[i - 1];
        this.routeOverlayGraphics.lineBetween(prev.x, prev.y, pt.x, pt.y);
      }
    }
  }

  toggleEditorMode(enabled) {
    if (enabled && !useAuthStore.getState().isAdmin()) {
      console.warn('[LobbyScene] Unauthorized editor activation attempt.');
      return;
    }
    console.log(`[EditorController] toggleEditorMode: ${enabled}`);
    this.enabled = enabled;
    this.scene.editorMode = enabled;

    if (this.scene.physics && this.scene.physics.world) {
      if (enabled) {
        this.scene.physics.world.drawDebug = true;
        if (!this.scene.physics.world.debugGraphic) {
          this.scene.physics.world.createDebugGraphic();
        }
        this.scene.physics.world.debugGraphic.setVisible(true);
      } else {
        this.scene.physics.world.drawDebug = false;
        if (this.scene.physics.world.debugGraphic) {
          this.scene.physics.world.debugGraphic.setVisible(false);
        }
      }
    }
    
    this.cursorPreview?.setVisible(enabled);
    this.cursorCoordLabel?.setVisible(enabled);
    
    if (this.scene.gridGraphics) {
      if (enabled) {
        this.scene._rebuildEditorGrid(this.scene.mapWidth, this.scene.mapHeight);
      } else {
        this.scene.gridGraphics.setVisible(false);
      }
    }

    const markerGroups = [this.scene.spawns, this.scene.npcZones, this.scene.pickups, this.scene.voids, this.scene.colliders, this.scene.enemySpawns];
    markerGroups.forEach(group => {
      if (group) {
        group.getChildren().forEach(child => {
          if (child.setVisible) child.setVisible(enabled);
        });
      }
    });

    if (this.scene.player) {
      if (enabled) {
        // Default to 'camera' mode: editar (sobre todo colocar/inspeccionar
        // enemigos) es más cómodo con la cámara libre que atado al personaje.
        // El usuario puede pasar a 'character' mode desde la UI si lo necesita.
        this.moveMode = 'camera';
        this._applyMoveMode('camera');
        this.scene.preEditorPos = { x: this.scene.player.x, y: this.scene.player.y };
        // Sync the React UI to 'camera' mode
        window.dispatchEvent(new CustomEvent('editor-move-mode-changed', { detail: { mode: 'camera' } }));
      } else {
        this.moveMode = 'character';
        this.scene.player.setAlpha(1);
        if (this.scene.player.body) {
          this.scene.player.body.setEnable(true);
          this.scene.player.body.setVelocity(0, 0);
        }
        this.scene.cameras.main.startFollow(this.scene.player, true, 0.1, 0.1);
      }
    }

    if (!enabled) {
      this.isDragging = false;
      this.dragStartGrid = null;
      this.rectPreview?.clear();
      this.rectPreview?.setVisible(false);
      this.resumeEnemies();
    } else {
      this.pauseEnemies();
    }
    this.emitStats();
  }

  setMoveMode(mode) {
    if (!this.enabled) return;
    this.moveMode = mode;
    this.scene.editorMoveMode = mode;
    this._applyMoveMode(mode);
    window.dispatchEvent(new CustomEvent('editor-move-mode-changed', { detail: { mode } }));
  }

  _applyMoveMode(mode) {
    if (!this.scene.player) return;
    this.scene.editorMoveMode = mode;

    const markersVisible = this.enabled;
    if (this.scene.gridGraphics) this.scene.gridGraphics.setVisible(markersVisible);

    const markerGroups = [this.scene.spawns, this.scene.npcZones, this.scene.pickups, this.scene.voids, this.scene.colliders, this.scene.enemySpawns];
    markerGroups.forEach(group => {
      if (group) {
        group.getChildren().forEach(child => {
          if (child.setVisible) child.setVisible(markersVisible);
        });
      }
    });

    if (mode === 'camera') {
      this.scene.player.setAlpha(0.4);
      if (this.scene.player.body) {
        this.scene.player.body.setEnable(false);
        this.scene.player.body.setVelocity(0, 0);
      }
      this.scene.cameras.main.removeBounds();
      this.scene.cameras.main.stopFollow();
    } else {
      this.scene.player.setAlpha(1);
      if (this.scene.player.body) {
        this.scene.player.body.setEnable(true);
      }
      this.scene.cameras.main.startFollow(this.scene.player, true, 0.1, 0.1);
      this.scene.cameras.main.setBounds(0, 0, this.scene.mapWidth, this.scene.mapHeight);
    }
  }

  setTool(tool) {
    this.tool = tool;
    const colors = { brush: 0x00ff88, eraser: 0xff4444, rect: 0xffff00, marker: 0x00ffff, inspector: 0xff00ff };
    this.cursorPreview?.setStrokeStyle(2, colors[tool] || 0xffffff, 0.8);
  }

  setTileType(type) {
    this.tileType = type;
    const colors = { 
      wall: 0x666666, floor: 0x8B7355, forest: 0x228B22, build: 0xCD853F, 
      spawn: 0x00CC66, npc: 0x4488FF, void: 0x2596be, collider: 0xFFD700,
      store: 0x556270, furniture: 0xFF6B6B, furniture2: 0xFF8E8E, furniture3: 0xFFB3B3, enemy: 0xFF4444
    };
    this.cursorPreview?.setFillStyle(colors[type] || 0xffffff, 0.3);
  }

  setTexture(frame) {
    this.textureFrame = frame;
  }

  _pickObjectAt(gx, gy) {
    const found = this.scene._findTileAt(gx, gy);
    if (!found) return;

    const { tile, type } = found;
    let metadata = {};
    if (tile.data) {
      metadata = tile.data.getAll();
    }

    const detail = {
      type: type,
      frame: tile.frame.name,
      scale: (type === 'build' ? (tile.data?.get('buildScale') || tile.scaleX / 1.25) : tile.scaleX) || 1,
      metadata: metadata,
      x: gx,
      y: gy
    };

    window.dispatchEvent(new CustomEvent('editor-picked-object', { detail }));

    const flash = this.scene.add.graphics();
    flash.lineStyle(2, 0xffffff, 1);
    flash.strokeRect(gx - this.GRID_SIZE/2, gy - this.GRID_SIZE/2, this.GRID_SIZE, this.GRID_SIZE);
    flash.setDepth(2000);
    this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
    });
  }

  // Suelta el tile agarrado con el inspector (ver pointerdown/pointermove).
  // pointermove ya lo fue moviendo en vivo; acá solo se decide si el destino
  // es válido o si hay que devolverlo a su celda original.
  _finishMovingTile() {
    const moving = this._movingTile;
    this._movingTile = null;
    if (!moving) return;

    moving.tile.setAlpha?.(moving.originalAlpha ?? 1);

    const G = this.GRID_SIZE;
    const pointer = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gx = Math.floor(wp.x / G) * G + G / 2;
    const gy = Math.floor(wp.y / G) * G + G / 2;

    const outOfBounds = gx < 0 || gx > this.scene.mapWidth || gy < 0 || gy > this.scene.mapHeight;
    const sameCell = gx === moving.fromX && gy === moving.fromY;
    // Ya hay OTRO tile del mismo tipo en el destino: cancelar en vez de dejar
    // dos superpuestos en silencio (el propio `moving.tile` ya está ahí por el
    // arrastre en vivo, así que se excluye de la comparación).
    const collides = !sameCell && this.scene._findAllTilesAt(gx, gy)
      .some(t => t.type === moving.type && t.tile !== moving.tile);

    if (outOfBounds || collides) {
      moving.tile.setPosition(moving.fromX, moving.fromY);
      if (collides) {
        useNotificationStore.getState().addNotification('error', 'Ya hay un objeto del mismo tipo en esa celda.');
      }
      return;
    }

    if (sameCell) return; // soltado donde mismo: no-op

    moving.tile.setPosition(gx, gy);
    this._pushHistory({ action: 'move', type: moving.type, fromX: moving.fromX, fromY: moving.fromY, toX: gx, toY: gy });
    this.redoStack = [];
    this.emitStats();
  }

  applyBuildMetadataToAll() {
    if (!this.buildMetadata) return;
    const { targetMap, targetX, targetY, targetRoute, interactionText } = this.buildMetadata;
    this.scene.builds?.getChildren().forEach(gObj => {
      if (targetMap !== undefined) gObj.data.set('targetMap', targetMap);
      if (targetRoute !== undefined) gObj.data.set('targetRoute', targetRoute);
      if (this.buildMetadata.portalType !== undefined) gObj.data.set('portalType', this.buildMetadata.portalType);
      if (targetX !== undefined) gObj.data.set('targetX', targetX);
      if (targetY !== undefined) gObj.data.set('targetY', targetY);
      if (interactionText !== undefined) gObj.data.set('interactionText', interactionText);
      
      const scale = this.buildMetadata.buildScale || 2;
      gObj.setScale(scale * 1.25);
      gObj.data.set('buildScale', scale);
    });
    this.scene.cameras.main.flash(200, 0, 255, 0);
  }

  _pushHistory(entry) {
    if (this._currentBatch) {
      this._currentBatch.push(entry);
    } else {
      this.history.push(entry);
    }
  }

  // Removes a live NPC (a backend instance, with or without an editor marker)
  // at the given grid cell. Deletes it locally for instant feedback and from
  // the DB via DELETE /admin/npcs/:templateId so the map won't respawn it.
  // Returns true if an NPC was found and removed locally.
  _eraseLiveNPCAt(gx, gy) {
    const npc = this.scene.npcs.find(
      n => Math.abs(n.x - gx) < this.GRID_SIZE && Math.abs(n.y - gy) < this.GRID_SIZE
    );
    if (!npc) return false;

    const tid = npc.npcData?.templateId;

    // Remove locally first for instant feedback
    if (tid != null) this.scene.npcSprites.delete(tid);
    npc.destroy();
    this.scene.npcs = this.scene.npcs.filter(n => n !== npc);

    // Persist deletion to the backend (template + room instances + mission roles)
    if (tid != null) {
      api.delete(`/admin/npcs/${tid}`)
        .then(() => console.log(`[Editor] NPC template ${tid} deleted from DB`))
        .catch((err) => {
          const msg = err?.response?.data?.error || 'No se pudo borrar el NPC en el servidor.';
          console.error('[Editor] Failed to delete NPC template:', msg);
          useNotificationStore.getState().addNotification('error', msg);
        });
    }
    return true;
  }

  _editorPlaceOrErase(gx, gy) {
    if (gx < 0 || gx > this.scene.mapWidth || gy < 0 || gy > this.scene.mapHeight) return;

    const existingTiles = this.scene._findAllTilesAt(gx, gy);

    if (this.tool === 'eraser') {
      // A live NPC (backend instance) is deleted directly — even when it has no
      // coincident editor marker tile — and removed from the DB so the map
      // won't respawn it on reload.
      const npcErased = this._eraseLiveNPCAt(gx, gy);

      if (existingTiles.length > 0) {
        const floorIndex = existingTiles.findIndex(t => t.type === 'floor');
        let toErase = null;
        if (existingTiles.length > 1 && floorIndex !== -1) {
          toErase = existingTiles.find(t => t.type !== 'floor');
        } else {
          toErase = existingTiles[existingTiles.length - 1];
        }

        // If we just deleted a live NPC and the only tile here is floor, keep
        // the floor — the admin's intent was to remove the NPC, not the ground.
        if (toErase && npcErased && toErase.type === 'floor') {
          toErase = null;
        }

        if (toErase) {
          this._pushHistory({ action: 'remove', type: toErase.type, x: gx, y: gy });
          this.redoStack = [];

          toErase.tile.destroy();

          if (toErase.type === 'item') {
            const pickupToRemove = this.scene.activePickups.find(p => Math.abs(p.x - gx) < this.GRID_SIZE && Math.abs(p.y - gy) < this.GRID_SIZE);
            if (pickupToRemove) {
              pickupToRemove.destroy();
              this.scene.activePickups = this.scene.activePickups.filter(p => p !== pickupToRemove);
            }
          }
          // NPC container + DB deletion is handled by _eraseLiveNPCAt above.
        }
      }

      if (npcErased || existingTiles.length > 0) {
        this.emitStats();
      }
      return;
    }

    const isFloor = this.tileType === 'floor';
    let replacing = null;

    if (isFloor || this.tileType === 'store') {
      replacing = existingTiles.find(t => t.type === 'floor' || t.type === 'store');
    } else {
      replacing = existingTiles.find(t => t.type !== 'floor' && t.type !== 'store' && t.type !== 'void');
    }

    if (replacing) {
      if (this.tool === 'inspector') return;

      const sameType = replacing.type === this.tileType;
      const sameFrame = (replacing.tile.frame.name === this.textureFrame) || (!this.textureFrame && replacing.tile.frame.name === 'sprite1');
      
      if (sameType && sameFrame) {
        return; 
      }
      
      const oldMetadata = replacing.tile.data ? JSON.parse(JSON.stringify(replacing.tile.data.getAll())) : null;
      let newMetadata = null;
      if (this.tileType === 'build') newMetadata = this.buildMetadata;
      else if (this.tileType === 'npc') newMetadata = this.npcMetadata;
      else if (this.tileType === 'enemy') newMetadata = this.enemyMetadata;
      else if (this.tileType === 'furniture' || this.tileType === 'furniture2' || this.tileType === 'furniture3') newMetadata = this.furnitureMetadata;

      this._pushHistory({ 
        action: 'replace', 
        oldType: replacing.type, 
        oldMetadata: oldMetadata,
        newType: this.tileType, 
        newMetadata: newMetadata,
        x: gx, y: gy 
      });
      replacing.tile.destroy();
    } else {
      if (this.tileType === 'void') {
        if (existingTiles.find(t => t.type === 'void')) return;
      }

      let currentMetadata = null;
      if (this.tileType === 'build' || this.tileType === 'exit') currentMetadata = this.buildMetadata;
      else if (this.tileType === 'npc') currentMetadata = this.npcMetadata;
      else if (this.tileType === 'enemy') {
        currentMetadata = this.enemyMetadata;
        console.log(`[Editor] Placing enemy spawn with metadata:`, currentMetadata);
      }
      else if (this.tileType === 'item') currentMetadata = this.pickupMetadata;
      else if (this.tileType === 'furniture' || this.tileType === 'furniture2' || this.tileType === 'furniture3') currentMetadata = this.furnitureMetadata;

      this._pushHistory({ 
        action: 'place', 
        type: this.tileType, 
        x: gx, y: gy, 
        frame: this.textureFrame || this._getDefaultFrameForType(this.tileType), 
        metadata: currentMetadata, 
        scale: this.buildScale 
      });
    }
    this.redoStack = [];

    // Determinar el frame efectivo según el tipo de tile
    const effectiveFrame = this.textureFrame || this._getDefaultFrameForType(this.tileType);

    this.scene._placeTileDirect(this.tileType, gx, gy, effectiveFrame,
      (this.tileType === 'build' || this.tileType === 'exit') ? this.buildMetadata :
      this.tileType === 'npc' ? this.npcMetadata : 
      this.tileType === 'enemy' ? this.enemyMetadata : 
      this.tileType === 'item' ? this.pickupMetadata :
      (this.tileType === 'furniture' || this.tileType === 'furniture2' || this.tileType === 'furniture3') ? this.furnitureMetadata : null,
      this.buildScale);

    this.emitStats();
  }

  /** Retorna el frame por defecto para cada tipo de tile con atlas propio.
   *  NOTA: En los atlases de furniture, 'sprite1' (y algunos más) son placeholders
   *  de 1×1 px invisibles. Usamos el primer frame real visible de cada atlas.
   *  - furniture.json  → primer frame visible es 'sprite2'
   *  - furniture2.json → primer frame visible es 'sprite7'
   */
  _getDefaultFrameForType(type) {
    switch (type) {
      case 'forest':    return 'sprite1';
      case 'wall':      return 'sprite1';
      case 'build':     return 'sprite1';
      case 'store':     return 'sprite1';
      case 'furniture':  return 'sprite2';   // sprite1 es 1×1 px invisible
      case 'furniture2': return 'sprite7';   // sprite1-6 son 1×1 px invisibles
      case 'furniture3': return 'sprite1';   // sprite1 (118×275) es un frame visible real
      default:          return 'sprite1';
    }
  }

  _editorFillRect(x1, y1, x2, y2) {
    const G = this.GRID_SIZE;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    this._currentBatch = [];

    for (let x = minX; x <= maxX; x += G) {
      for (let y = minY; y <= maxY; y += G) {
        this._editorPlaceOrErase(x, y);
      }
    }

    if (this._currentBatch.length > 0) {
      this.history.push({
        action: 'batch',
        entries: this._currentBatch
      });
      this.redoStack = [];
    }
    this._currentBatch = null;
    this.emitStats();
  }

  _drawRectPreview(x1, y1, x2, y2) {
    const G = this.GRID_SIZE;
    const minX = Math.min(x1, x2) - G / 2;
    const maxX = Math.max(x1, x2) + G / 2;
    const minY = Math.min(y1, y2) - G / 2;
    const maxY = Math.max(y1, y2) + G / 2;

    this.rectPreview.clear();
    this.rectPreview.setVisible(true);
    this.rectPreview.lineStyle(2, 0xffff00, 0.8);
    this.rectPreview.fillStyle(0xffff00, 0.1);
    this.rectPreview.fillRect(minX, minY, maxX - minX, maxY - minY);
    this.rectPreview.strokeRect(minX, minY, maxX - minX, maxY - minY);
  }

  undo() {
    if (this.history.length === 0) return;
    const entry = this.history.pop();
    this.redoStack.push(entry);

    this._executeUndoEntry(entry);
    this.emitStats();
  }

  _executeUndoEntry(entry) {
    if (entry.action === 'batch') {
      // Undo batch in reverse order
      for (let i = entry.entries.length - 1; i >= 0; i--) {
        this._executeUndoEntry(entry.entries[i]);
      }
      return;
    }

    if (entry.action === 'place') {
      const found = this.scene._findTileAt(entry.x, entry.y, entry.type);
      if (found) found.tile.destroy();
    } else if (entry.action === 'remove') {
      this.scene._placeTileDirect(entry.type, entry.x, entry.y);
    } else if (entry.action === 'replace') {
      const found = this.scene._findTileAt(entry.x, entry.y, entry.newType);
      if (found) found.tile.destroy();
      this.scene._placeTileDirect(entry.oldType, entry.x, entry.y);
    } else if (entry.action === 'move') {
      const found = this.scene._findTileAt(entry.toX, entry.toY, entry.type);
      if (found) found.tile.setPosition(entry.fromX, entry.fromY);
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const entry = this.redoStack.pop();
    this.history.push(entry);

    this._executeRedoEntry(entry);
    this.emitStats();
  }

  _executeRedoEntry(entry) {
    if (entry.action === 'batch') {
      // Redo batch in original order
      for (let i = 0; i < entry.entries.length; i++) {
        this._executeRedoEntry(entry.entries[i]);
      }
      return;
    }

    if (entry.action === 'place') {
      this.scene._placeTileDirect(entry.type, entry.x, entry.y, entry.frame, entry.metadata);
    } else if (entry.action === 'remove') {
      const found = this.scene._findTileAt(entry.x, entry.y, entry.type);
      if (found) found.tile.destroy();
    } else if (entry.action === 'replace') {
      const found = this.scene._findTileAt(entry.x, entry.y, entry.oldType);
      if (found) found.tile.destroy();
      this.scene._placeTileDirect(entry.newType, entry.x, entry.y);
    } else if (entry.action === 'move') {
      const found = this.scene._findTileAt(entry.fromX, entry.fromY, entry.type);
      if (found) found.tile.setPosition(entry.toX, entry.toY);
    }
  }

  clearAllTiles() {
    this.scene.clearMap();
    
    this.scene.npcs.forEach(n => n.destroy());
    this.scene.npcs = [];
    if (this.scene.npcSprites) this.scene.npcSprites.clear();
    
    if (this.scene.activePickups) {
      this.scene.activePickups.forEach(p => p.destroy());
      this.scene.activePickups = [];
    }

    this.history = [];
    this.redoStack = [];
    this.emitStats();
  }

  exportMapConfig() {
    return this.scene.exportMapConfig();
  }

  importMapConfig(config) {
    this.scene.importMapConfig(config);
  }

  emitStats() {
    window.dispatchEvent(new CustomEvent('editor-stats', {
      detail: {
        walls: this.scene.walls?.getChildren()?.length || 0,
        floors: this.scene.floors?.getChildren()?.length || 0,
        forest: this.scene.forest?.getChildren()?.length || 0,
        builds: this.scene.builds?.getChildren()?.filter(t => !t.data?.get?.('isExit'))?.length || 0,
        exits: this.scene.builds?.getChildren()?.filter(t => t.data?.get?.('isExit'))?.length || 0,
        spawns: this.scene.spawns?.getChildren()?.length || 0,
        npcZones: this.scene.npcZones?.getChildren()?.length || 0,
        pickups: this.scene.pickups?.getChildren()?.length || 0,
        voids: this.scene.voids?.getChildren()?.length || 0,
        colliders: this.scene.colliders?.getChildren()?.length || 0,
        storeTiles: this.scene.storeTiles?.getChildren()?.length || 0,
        furniture: this.scene.storeFurniture?.getChildren()?.filter(t => t.texture.key === 'store-furniture')?.length || 0,
        furniture2: this.scene.storeFurniture?.getChildren()?.filter(t => t.texture.key === 'store-furniture2')?.length || 0,
        furniture3: this.scene.storeFurniture?.getChildren()?.filter(t => t.texture.key === 'furniture')?.length || 0,
        enemySpawns: this.scene.enemySpawns?.getChildren()?.length || 0,
        historySize: this.history?.length || 0,
        redoSize: this.redoStack?.length || 0,
      }
    }));
  }
}
