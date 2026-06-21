import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAudioStore } from '../../store/audioStore';
import { createCharacterAnimations } from '../config/CharacterConfig';
import { createNPCAnimations } from '../config/NPCConfig';
import { createEnemyAnimations } from '../config/EnemyConfig';
import { createBossAnimations } from '../config/BossConfig';
import api from '../../services/api';
import { EnemySystem } from '../combat/EnemySystem';
import { CombatSystem } from '../combat/CombatSystem';

import { MapManager } from '../map/MapManager';
import { CameraSystem } from '../map/CameraSystem';
import { EditorController } from '../editor/EditorController';
import { PlayerManager } from '../players/PlayerManager';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { MinigameOverlayManager } from '../interactions/MinigameOverlayManager';
import { preloadLobbyAssets } from './LobbyAssets';
import { ChatBubbleManager } from './ChatBubbleManager';
import { NPCManager } from './NPCManager';
import { PickupManager } from './PickupManager';
import { LobbyInputController } from './LobbyInputController';
import { LobbyEventBridge } from './LobbyEventBridge';

const Phaser = window.Phaser;

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.player = null;
    this.cursors = null;
    this.interactKey = null;
    this.currentBgm = null;
    this.currentBgmTrackId = null;
    this.audioUnsubscribe = null;
    this.nearbyNPC = null;
    this.playerSprites = new Map();
    this.enemySystem = null;
    this.combatSystem = null;
    this.lastNetworkUpdate = 0;
    this.lastSyncUpdate = 0;
    this.myPlayerId = null;
    this.mapWidth = 800;
    this.mapHeight = 800;
    this.backgroundRect = null;
    this.zoom = 1.0;
    this.zoomMin = 0.5;
    this.zoomMax = 2.0;
    this.zoomStep = 0.1;
    this.onResize = null;

    // Editor state
    this.editorMode = false;
    this.editorMoveMode = 'camera'; // 'camera' | 'character'
    this.editorTool = 'brush';      // 'brush' | 'eraser' | 'rect'
    this.editorTileType = 'wall';   // 'wall' | 'floor' | 'spawn' | 'npc'
    this.editorTextureFrame = 'sprite1'; // Default terrain sprite
    this.editorHistory = [];
    this.editorRedoStack = [];
    this.cursorPreview = null;
    this.editorGridOverlay = null;
    this.isDragging = false;
    this.dragStartGrid = null;
    this.rectPreview = null;
    this.onEditorEvent = null;
    this.isSpectating = false;
    this.spectatorTarget = null;
    this.GRID_SIZE = 100;
    this.editorBuildScale = 2.5; // default 2.5× (range 1–3)
    // Default metadata for newly-placed builds — must match the UI's default (portalType: 'map')
    this.editorBuildMetadata = { portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' };

    this.mapManager = new MapManager(this);
    this.cameraSystem = new CameraSystem(this);
    this.interactionSystem = new InteractionSystem(this);
    this.minigameOverlayManager = new MinigameOverlayManager(this);
    this.playerManager = new PlayerManager(this);
    this.npcManager = new NPCManager(this);
    this.pickupManager = new PickupManager(this);
    this.chatBubbleManager = new ChatBubbleManager(this);
    this.inputController = new LobbyInputController(this);
    this.eventBridge = new LobbyEventBridge(this);
    this.editorController = new EditorController(this);
    this.editor = this.editorController;

    Object.defineProperties(this, {
      mapWidth: { get: () => this.mapManager.mapWidth },
      mapHeight: { get: () => this.mapManager.mapHeight },
      mapDefaultSpawnX: { get: () => this.mapManager.mapDefaultSpawnX },
      mapDefaultSpawnY: { get: () => this.mapManager.mapDefaultSpawnY },
      backgroundRect: { get: () => this.mapManager.backgroundRect },
      gridGraphics: { get: () => this.mapManager.gridGraphics },
      walls: { get: () => this.mapManager.walls },
      floors: { get: () => this.mapManager.floors },
      forest: { get: () => this.mapManager.forest },
      builds: { get: () => this.mapManager.builds },
      spawns: { get: () => this.mapManager.spawns },
      npcZones: { get: () => this.mapManager.npcZones },
      pickups: { get: () => this.mapManager.pickups },
      voids: { get: () => this.mapManager.voids },
      colliders: { get: () => this.mapManager.colliders },
      storeTiles: { get: () => this.mapManager.storeTiles },
      storeFurniture: { get: () => this.mapManager.storeFurniture },
      enemySpawns: { get: () => this.mapManager.enemySpawns },
      playerSprites: { get: () => this.playerManager.sprites },
      npcs: {
        get: () => this.npcManager.npcs,
        set: (v) => { this.npcManager.npcs = v; }
      },
      npcSprites: { get: () => this.npcManager.npcSprites },
      activePickups: {
        get: () => this.pickupManager.activePickups,
        set: (v) => { this.pickupManager.activePickups = v; }
      },
      activeEnemies: {
        get: () => this.enemySystem?.activeEnemies,
        set: (v) => { if (this.enemySystem) this.enemySystem.activeEnemies = v; }
      },
      isDead: {
        get: () => this.combatSystem?.isDead || false,
        set: (v) => { if (this.combatSystem) this.combatSystem.isDead = v; }
      },
      isStunned: {
        get: () => this.combatSystem?.isStunned || false,
        set: (v) => { if (this.combatSystem) this.combatSystem.isStunned = v; }
      },
      playerHp: {
        get: () => this.combatSystem?.playerHp || 100,
        set: (v) => { if (this.combatSystem) this.combatSystem.playerHp = v; }
      },
      playerMaxHp: {
        get: () => this.combatSystem?.playerMaxHp || 100,
        set: (v) => { if (this.combatSystem) this.combatSystem.playerMaxHp = v; }
      },
      playerMp: {
        get: () => this.combatSystem?.playerMp || 100,
        set: (v) => { if (this.combatSystem) this.combatSystem.playerMp = v; }
      },
      playerMaxMp: {
        get: () => this.combatSystem?.playerMaxMp || 100,
        set: (v) => { if (this.combatSystem) this.combatSystem.playerMaxMp = v; }
      },
      playerAttackIFrames: {
        get: () => this.combatSystem?.playerAttackIFrames || 0,
        set: (v) => { if (this.combatSystem) this.combatSystem.playerAttackIFrames = v; }
      }
    });

    // State management unsubscribers
    this.unsubscribe = null;
    this.audioUnsubscribe = null;

    // Data passed via scene.restart({ map, spawnX, spawnY })
    this.initData = null;
    this.isMapLoading = true;
  }

  init(data) {
    // Capture data passed when restarting the scene
    this.initData = data || {};

    // Clear references in mapManager to avoid keeping destroyed physics groups from previous runs
    if (this.mapManager) {
      this.mapManager.walls = null;
      this.mapManager.floors = null;
      this.mapManager.forest = null;
      this.mapManager.builds = null;
      this.mapManager.spawns = null;
      this.mapManager.npcZones = null;
      this.mapManager.pickups = null;
      this.mapManager.voids = null;
      this.mapManager.colliders = null;
      this.mapManager.storeTiles = null;
      this.mapManager.storeFurniture = null;
      this.mapManager.enemySpawns = null;
    }

    // STABILIZATION: Initialize myPlayerId as early as possible from authStore
    // to prevent race conditions during the first positions_snapshot.
    const user = useAuthStore.getState().user;
    this.myPlayerId = user?.id ? String(user.id) : null;
    console.log(`[LobbyScene] Initialized with myPlayerId: ${this.myPlayerId}`);

    // TAREA 2 FIX: Resetear estado de muerte en cada reinicio de escena.
    // scene.restart() llama init() pero NO el constructor, por lo que sin este reset
    // el jugador quedaba muerto después de hacer 'Regresar' desde el DeathOverlay.
    this.isDead = false;
    this.isSpectating = false;
    this.spectatorTarget = null;
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerMp = 100;
    this.playerMaxMp = 100;
    this.playerAttackIFrames = 0;

    if (!this.editorController) {
      this.editorController = new EditorController(this);
      this.editor = this.editorController;
    }
  }

  preload() {
    preloadLobbyAssets(this);
  }

  create() {
    this.enemiesGroup = this.physics.add.group();
    this.enemySystem = new EnemySystem(this);
    this.combatSystem = new CombatSystem(this, this.enemySystem);

    // 0. Animations
    this.createAnimations();
    createEnemyAnimations(this);
    createBossAnimations(this);

    // 1. Map / Ground
    this.mapManager.createMap();

    // Initialize systems that depend on map groups
    this.interactionSystem.initialize();
    this.minigameOverlayManager.initialize();
    this.editorController.setupUI();

    // 2. Input — keyboard, virtual buttons, pointer and canvas-focus tracking
    this.inputController.setup();

    // 1.5 Load saved map from server (overrides default walls)
    // IMPORTANT: createMyPlayer() is called INSIDE loadServerMapConfig()
    // after the async map fetch resolves, so mapDefaultSpawnX/Y are set first.
    const urlParams = new URLSearchParams(window.location.search);
    // Prioritize initData (from portal) -> URL param -> default 'lobby'
    this.currentMapKey = this.initData?.map || urlParams.get('map') || urlParams.get('edit_map') || 'lobby';
    
    // Sync with gameStore for UI components
    useGameStore.setState({ currentSceneKey: this.currentMapKey });

    this.mapManager.loadServerMapConfig(this.currentMapKey);

    // 3. NPCs (Dynamic from Backend)
    this.npcManager.reset();
    this.npcManager.loadNPCs();
    this.pickupManager.resetAndLoadMapPickups();
    this.nearbyNPC = null;
    this.nearbyPickup = null;

    // Subscribe to room id changes to load NPCs properly when joining
    this.roomUnsubscribe = useGameStore.subscribe(
      (state) => state.currentRoomId,
      (roomId) => {
        if (roomId) this.npcManager.loadNPCs();
      }
    );

    // 4. Other Players & Missions
    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe(
      (state) => state.players,
      (players) => this.playerManager.handlePlayersUpdate(players)
    );

    this.missionUnsubscribe = useGameStore.subscribe(
        (state) => state.activeMission,
        (mission) => this.npcManager.handleMissionUpdate(mission)
    );

    // Initial render of existing players (in case they loaded before scene)
    this.playerManager.handlePlayersUpdate(useGameStore.getState().players);

    // Audio Subscriptions
    this.audioUnsubscribe = useAudioStore.subscribe(
      (state) => ({
        master: state.masterVolume,
        music: state.musicVolume,
        sfx: state.sfxVolume
      }),
      ({ master, music }) => {
        // Apply global master volume to the Phaser Sound Manager
        this.sound.volume = master;
        this.sound.mute = (master === 0);

        // Apply specific music volume to the current playing BGM
        if (this.currentBgm && this.currentBgm.isPlaying) {
          this.currentBgm.setVolume(music);
        }
      }
    );

    // Register proper cleanup for when scene stops or restarts.
    // Window listeners are torn down by eventBridge.destroy() in _cleanupListeners.
    this.events.once('shutdown', () => this.shutdown());
    this.events.once('destroy', () => this.shutdown());

    // Ensure playerSprites is fresh if restarting
    this.playerSprites.clear();

    // Interaction Prompt Text (Premium Bubbles)
    this.interactionPrompt = this.add.text(0, 0, '', {
      fontSize: '20px',
      fill: '#FFE600',
      stroke: '#000000',
      strokeThickness: 6,
      fontFamily: '"Outfit", sans-serif',
      fontWeight: '900',
      backgroundColor: '#000000CC', // Slightly darker bubble
      padding: { x: 16, y: 10 },
      align: 'center'
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(100000); // Top-most depth for UI elements
    this.interactionPrompt.setShadow(2, 2, 'rgba(0,0,0,0.8)', 2);
    this.interactionPrompt.setVisible(false);
    this.interactionPrompt.setScrollFactor(0); // Fixed on screen

    // 6. Camera
    this.cameraSystem.setZoom(this.zoom);
    this.onResize = (gameSize) => this.cameraSystem.configureCamera(gameSize);
    this.scale.on('resize', this.onResize);

    // 7. Window CustomEvent listeners (chat, NPC, camera zoom, spectate, etc.)
    this.eventBridge.setup();

    // Cleanup when scene is destroyed or stopped
    this.events.on('shutdown', this._cleanupListeners, this);
    this.events.on('destroy', this._cleanupListeners, this);
  }



  _onSpectate() {
    console.log("[LobbyScene] Entering spectator mode");
    this.isSpectating = true;
    
    // Find someone to watch
    const otherPlayers = Array.from(this.playerSprites.values());
    if (otherPlayers.length > 0) {
      this.spectatorTarget = otherPlayers[0];
      console.log(`[LobbyScene] Spectating player: ${this.spectatorTarget.id}`);
      this.cameras.main.startFollow(this.spectatorTarget, true, 0.1, 0.1);
    } else {
      console.log("[LobbyScene] No other players to spectate");
      // Maybe show a message or just stay on our corpse
      useNotificationStore.getState().addNotification('info', 'No hay otros jugadores para observar.');
    }
  }

  _cleanupListeners() {
    console.log('[LobbyScene] Cleaning up combat and editor listeners');
    if (this.enemySystem) {
      this.enemySystem.destroy();
      this.enemySystem = null;
    }
    if (this.combatSystem) {
      this.combatSystem.destroy();
      this.combatSystem = null;
    }
    // All window CustomEvent listeners
    this.eventBridge.destroy();

    // Keyboard, virtual buttons, pointer and canvas-focus listeners
    this.inputController.destroy();

    // Cleanup editor controller listeners
    if (this.editorController) {
      this.editorController.destroy();
    }
  }

  createAnimations() {
    createCharacterAnimations(this);
    createNPCAnimations(this);
  }

  // NPC lifecycle (load/spawn/mission indicators/movement) is handled by
  // this.npcManager (src/game/scenes/NPCManager.js). Player management is in
  // this.playerManager (src/game/players/PlayerManager.js).

  playBGM(trackId) {
    if (this.currentBgmTrackId === trackId) return;

    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
    }

    this.currentBgmTrackId = trackId;

    if (trackId && trackId !== 'none') {
      if (this.cache.audio.exists(trackId)) {
        const { musicVolume } = useAudioStore.getState();
        const volume = (typeof musicVolume === 'number' && isFinite(musicVolume)) ? musicVolume : 0.5;
        this.currentBgm = this.sound.add(trackId, {
          loop: true,
          volume: volume
        });

        if (!this.sound.locked) {
          this.currentBgm.play();
        } else {
          this.sound.once('unlocked', () => {
            if (this.currentBgm) this.currentBgm.play();
          });
        }
      } else {
        console.warn(`[LobbyScene] Audio track '${trackId}' not found in cache.`);
      }
    }
  }

  // ── Editor Proxies ──────────────────────────────────────────────────
  createMyPlayer() {
    if (this.playerManager && typeof this.playerManager.createMyPlayer === 'function') {
      this.playerManager.createMyPlayer();
    }
  }

  toggleEditorMode(enabled) {
    console.log(`[LobbyScene] Toggling Editor Mode: ${enabled}`);
    // Delegate entirely to EditorController — it handles player alpha,
    // camera follow, grid, markers, and physics debug all in one place.
    if (this.editorController && typeof this.editorController.toggleEditorMode === 'function') {
      this.editorController.toggleEditorMode(enabled);
    }
  }

  resizeMap(w, h) {
    if (this.mapManager && typeof this.mapManager.resizeMap === 'function') {
      this.mapManager.resizeMap(w, h);
    }
  }

  exportMapConfig() {
    if (this.mapManager && typeof this.mapManager.exportMapConfig === 'function') {
      return this.mapManager.exportMapConfig();
    }
    return null;
  }

  importMapConfig(config) {
    if (this.mapManager && typeof this.mapManager.importMapConfig === 'function') {
      this.mapManager.importMapConfig(config);
    }
    if (this.editorController && typeof this.editorController.emitStats === 'function') {
      this.editorController.emitStats();
    }
  }

  updateMapMetadata(settings) {
    if (this.mapManager && typeof this.mapManager.updateMapMetadata === 'function') {
      this.mapManager.updateMapMetadata(settings);
    }
  }

  _rebuildEditorGrid(w, h) {
    if (this.mapManager && typeof this.mapManager._rebuildEditorGrid === 'function') {
      this.mapManager._rebuildEditorGrid(w, h);
    }
  }

  _findAllTilesAt(x, y) {
    if (this.mapManager && typeof this.mapManager._findAllTilesAt === 'function') {
      return this.mapManager._findAllTilesAt(x, y);
    }
    return [];
  }

  _findTileAt(x, y, type) {
    if (this.mapManager && typeof this.mapManager._findTileAt === 'function') {
      return this.mapManager._findTileAt(x, y, type);
    }
    return null;
  }

  _placeTileDirect(type, x, y, frame, metadata, scale) {
    if (this.mapManager && typeof this.mapManager._placeTileDirect === 'function') {
      this.mapManager._placeTileDirect(type, x, y, frame, metadata, scale);
    }
  }

  clearMap() {
    if (this.mapManager && typeof this.mapManager.clearMap === 'function') {
      this.mapManager.clearMap();
    }
  }

  _getTextureForType(type) {
    return this.mapManager ? this.mapManager._getTextureForType(type) : 'tile-floor';
  }

  _getGroupForType(type) {
    return this.mapManager ? this.mapManager._getGroupForType(type) : null;
  }

  isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    if (el instanceof HTMLInputElement) return true;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLSelectElement) return true;
    if (el.isContentEditable) return true;
    // Also treat as typing if we're on an admin page
    if (window.location.pathname.startsWith('/admin')) return true;
    return false;
  }

  update(time, delta) {
    if (!this.player) return;

    if (this.combatSystem) {
      this.combatSystem.update(delta);
    }

    // 1. Spectator Camera Tracking
    if (this.isSpectating && this.spectatorTarget) {
      this.cameras.main.startFollow(this.spectatorTarget, true, 0.1, 0.1);
      // Still allow syncing NPCs and other players
      this.npcManager.update(time);
      if (time - this.lastSyncUpdate > 1000) {
        const storePlayers = useGameStore.getState().players;
        this.playerManager.handlePlayersUpdate(storePlayers);
        this.lastSyncUpdate = time;
      }
      return; // Skip local player logic
    }

    // 2. Dead state: stop everything for local player
    const hasNinjaCard = useGameStore.getState().ninjaCardData != null;
    if (this.isDead || hasNinjaCard || this.isStunned) {
      if (this.player.body) this.player.body.setVelocity(0, 0);
      return; 
    }

    // Update NPCs
    this.npcManager.update(time);

    // Periodic Sync (every 1 second) to ensure Store and Scene match
    if (time - this.lastSyncUpdate > 1000) {
      const storePlayers = useGameStore.getState().players;
      // Proactively reconcile sprites without assuming 'self' is always in the store initially
      this.playerManager.handlePlayersUpdate(storePlayers);
      this.lastSyncUpdate = time;
    }

    // Ensure enemies have player as target (needed if player respawns or scene restarts)
    if (this.activeEnemies && this.player) {
      this.activeEnemies.forEach(sprite => {
        if (!sprite.target) sprite.target = this.player;
      });
    }

    // ─── Editor movement modes ───────────────────────────────────────────────
    if (this.editorMode) {
      if (this.editorMoveMode === 'camera') {
        // CAMERA PAN: WASD/Arrows scroll the viewport freely
        if (!this.isTyping()) {
          const panSpeed = 20; 
          const cam = this.cameras.main;
          
          // Ensure follow is stopped
          if (cam._follow) cam.stopFollow();

          const left = this.cursors.left.isDown || this.wasd.left.isDown;
          const right = this.cursors.right.isDown || this.wasd.right.isDown;
          const up = this.cursors.up.isDown || this.wasd.up.isDown;
          const down = this.cursors.down.isDown || this.wasd.down.isDown;
          
          if (left) cam.scrollX -= panSpeed;
          else if (right) cam.scrollX += panSpeed;
          if (up) cam.scrollY -= panSpeed;
          else if (down) cam.scrollY += panSpeed;
        }
        return; 
      } else {
        // Character mode: ensure follow is active
        const cam = this.cameras.main;
        if (!cam._follow && this.player) {
          cam.startFollow(this.player, true, 0.1, 0.1);
        }
      }
    }

    // Skip normal movement if dashing
    if (this.isDashing) {
      if (this.player && this.player.body) {
        this.player.body.setVelocity(this.dashVelocity.x, this.dashVelocity.y);
      }
      this.player.setDepth(this.player.y + 0.1);
      this.player.updateMovement(this.player.body.velocity);
      
      const timeNow = this.time.now;
      if (timeNow - this.lastNetworkUpdate > 60) {
        const direction = this.player.body.velocity.x < 0 ? 'left' : 'right';
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, 'walk');
        this.lastNetworkUpdate = timeNow;
      }
      return;
    }

    // Dynamic Depth Sorting: Local Player (Snap base to feet)
    this.player.setDepth(this.player.y + 1);

    // Sprint check (SHIFT)
    const isSprinting = (this.cursors.shift.isDown || (this.virtualInputs && this.virtualInputs.shift)) && !this.isTyping();
    const speed = isSprinting ? 240 : 160;
    const body = this.player.body;
    body.setVelocity(0);

    if (!this.isTyping()) {
      const left = this.cursors.left.isDown || this.wasd.left.isDown || (this.virtualInputs && this.virtualInputs.left);
      const right = this.cursors.right.isDown || this.wasd.right.isDown || (this.virtualInputs && this.virtualInputs.right);
      const up = this.cursors.up.isDown || this.wasd.up.isDown || (this.virtualInputs && this.virtualInputs.up);
      const down = this.cursors.down.isDown || this.wasd.down.isDown || (this.virtualInputs && this.virtualInputs.down);

      if (left) {
        body.setVelocityX(-speed);
      } else if (right) {
        body.setVelocityX(speed);
      }
      
      if (up) {
        body.setVelocityY(-speed);
      } else if (down) {
        body.setVelocityY(speed);
      }
    }

    // Update Animation State for Self
    this.player.updateMovement(body.velocity);

    // Network Update
    const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;

    // Determine direction from velocity
    if (body.velocity.x < 0) this._lastDirection = 'left';
    else if (body.velocity.x > 0) this._lastDirection = 'right';
    const direction = this._lastDirection || 'right';
    
    // Si el jugador está ejecutando una animación bloqueada (slash, hurt, die), enviamos esa
    let anim = isMoving ? 'walk' : 'idle';
    if (this.player._animLocked && this.player.currentAnim) {
        // currentAnim tiene el formato "char-1-slash", extraemos la última parte
        const parts = this.player.currentAnim.split('-');
        anim = parts[parts.length - 1];
    }

    // Network Update: throttled at ~15 FPS while moving or acting
    if (isMoving || this.player._animLocked) {
      if (time - this.lastNetworkUpdate > 60) {
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, anim);
        this.lastNetworkUpdate = time;
      }
    } else {
      // Send a final 'idle' update when the player just stopped
      if (!this._wasPreviouslyMoving) {
        // already idle – do nothing
      } else {
        // Transitioned from moving -> idle: broadcast stop immediately
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, anim);
        this.lastNetworkUpdate = time;
      }

      // Also handle rubber-banding / teleport sync
      if (!this.lastSyncedPos) {
        this.lastSyncedPos = { x: this.player.x, y: this.player.y };
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lastSyncedPos.x, this.lastSyncedPos.y);
      if (dist > 50) {
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, anim);
        this.lastSyncedPos = { x: this.player.x, y: this.player.y };
        this.lastNetworkUpdate = time;
      }
    }
    this._wasPreviouslyMoving = isMoving;

    if (!this.isTyping()) {
      this.interactionSystem.update();
    }

    // Continuously calculate and enforce X-axis bounds based on Void walls
    this.mapManager.updateCameraBounds();
  }

  async _handleMapEntry(targetMap, targetX, targetY) {
    try {
      const response = await api.get('/maps/config', { params: { scene_key: targetMap } });
      const mapCfg = response.data;

      let pin = '';
      if (mapCfg && !mapCfg.is_public) {
        const hasPIN = window.confirm(
          `El mapa "${targetMap}" es PRIVADO.\n\n` +
          `¿Tienes un PIN de acceso?\n` +
          `(Cancelar = crear nueva sala privada)`
        );
        if (hasPIN) {
          const entered = window.prompt('Introduce el PIN de 4 dígitos:');
          if (entered === null) return; 
          pin = entered.trim();
        }
      }

      window.dispatchEvent(new CustomEvent('lobby-change-map', {
        detail: {
          targetMap,
          targetX,
          targetY,
          pin, 
        },
      }));

    } catch (error) {
      console.warn('[LobbyScene] Could not fetch map metadata, assuming public:', error.message);
      window.dispatchEvent(new CustomEvent('lobby-change-map', {
        detail: { targetMap, targetX, targetY, pin: '' },
      }));
    }
  }

  shutdown() {
    console.log('[LobbyScene] Shutting down scene...');
    if (this.minigameOverlayManager) {
      this.minigameOverlayManager.shutdown();
    }

    // Clear references in mapManager to avoid keeping destroyed physics groups
    if (this.mapManager) {
      this.mapManager.walls = null;
      this.mapManager.floors = null;
      this.mapManager.forest = null;
      this.mapManager.builds = null;
      this.mapManager.spawns = null;
      this.mapManager.npcZones = null;
      this.mapManager.pickups = null;
      this.mapManager.voids = null;
      this.mapManager.colliders = null;
      this.mapManager.storeTiles = null;
      this.mapManager.storeFurniture = null;
      this.mapManager.enemySpawns = null;
    }
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.missionUnsubscribe) {
      this.missionUnsubscribe();
      this.missionUnsubscribe = null;
    }
    if (this.roomUnsubscribe) {
      this.roomUnsubscribe();
      this.roomUnsubscribe = null;
    }
    
    // Window CustomEvent listeners are removed by eventBridge.destroy()
    // (in _cleanupListeners). Here we only detach the Phaser scale 'resize'
    // handler, which lives on this.scale rather than window.
    if (this.onResize) {
      this.scale.off('resize', this.onResize);
      this.onResize = null;
    }

    if (this.editorController) {
      if (typeof this.editorController.destroy === 'function') {
        this.editorController.destroy();
      }
      this.editorController = null;
    }

    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm = null;
    }

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.playerSprites) {
      this.playerSprites.forEach((sprite, id) => {
        console.log(`[LobbyScene] Destroying ghost sprite for ${id} on shutdown`);
        sprite.destroy();
      });
      this.playerSprites.clear();
    }
  }
}
