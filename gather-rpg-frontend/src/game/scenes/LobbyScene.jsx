import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAudioStore } from '../../store/audioStore';
import { NPCSprite } from '../entities/NPCSprite';
import { loadCharacterSprites, createCharacterAnimations } from '../config/CharacterConfig';
import { loadNPCSprites, createNPCAnimations, STATE_TO_ANIM } from '../config/NPCConfig';
import { loadEnemySprites, createEnemyAnimations } from '../config/EnemyConfig';
import api from '../../services/api';
import { EnemySystem } from '../combat/EnemySystem';
import { CombatSystem } from '../combat/CombatSystem';

import { MapManager } from '../map/MapManager';
import { CameraSystem } from '../map/CameraSystem';
import { EditorController } from '../editor/EditorController';
import { PlayerManager } from '../players/PlayerManager';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { MinigameOverlayManager } from '../interactions/MinigameOverlayManager';

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
    this.npcs = [];
    this.challengePoints = [];
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
    this.onZoomEvent = null;

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
    loadCharacterSprites(this);
    loadNPCSprites(this);
    loadEnemySprites(this);

    // Generate tile textures for each type
    const tileTypes = [
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

    tileTypes.forEach(({ key, fill, stroke, label }) => {
      if (this.textures.exists(key)) return;

      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const alpha = (key === 'tile-npc' || key === 'tile-item' || key === 'tile-collider' || key === 'tile-enemy') ? 0.3 : 1;
      g.fillStyle(fill, alpha);
      g.fillRect(0, 0, 100, 100);
      g.lineStyle(4, stroke, 1);
      g.strokeRect(0, 0, 100, 100);

      const t = this.make.text({
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
      const rt = this.make.renderTexture({ width: 100, height: 100, add: false });
      rt.draw(g);
      rt.draw(t);
      rt.saveTexture(key);
      
      rt.destroy();
      g.destroy();
      t.destroy();
    });

    // Keep legacy alias for backwards compatibility
    if (!this.textures.exists('wall-texture')) {
      const gLegacy = this.make.graphics({ x: 0, y: 0, add: false });
      gLegacy.fillStyle(0x666666);
      gLegacy.fillRect(0, 0, 100, 100);
      gLegacy.lineStyle(2, 0x000000);
      gLegacy.strokeRect(0, 0, 100, 100);
      gLegacy.generateTexture('wall-texture', 100, 100);
      gLegacy.destroy();
    }

    // Load Atlases — guard with textures.exists() to prevent 'frame already exists'
    // warnings when the scene restarts (e.g., map portal transition).
    // Load Enemy assets
    loadEnemySprites(this);

    // Load Atlases — always load all atlases for map editor support and runtime stability
    if (!this.textures.exists('terrain'))
      this.load.atlas('terrain', '/terrain/terrain-spritesheet_extruido.png', '/terrain/terrain-sprites_extruido.json');
    if (!this.textures.exists('walls'))
      this.load.atlas('walls', '/wall/wall-spritesheet.png', '/wall/wall-sprites.json');

    if (!this.textures.exists('forest'))
      this.load.atlas('forest', '/forest/forest-spritesheet.png', '/forest/forest-sprites.json');
    
    if (!this.textures.exists('builds'))
      this.load.atlas('builds', '/builds/build-spritesheet.png', '/builds/build-sprites.json');

    if (!this.textures.exists('store-tiles'))
      this.load.atlas('store-tiles', '/store/tiles.png', '/store/tiles.json');
    
    if (!this.textures.exists('store-furniture'))
      this.load.atlas('store-furniture', '/store/furniture.png', '/store/furniture.json');
    if (!this.textures.exists('store-furniture2'))
      this.load.atlas('store-furniture2', '/store/furniture2.png', '/store/furniture2.json');

    // Load Audio (BGM) — guard to avoid re-loading on scene restart
    const audioKeys = [
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
    audioKeys.forEach(([key, path]) => {
      if (!this.cache.audio.exists(key)) this.load.audio(key, path);
    });
  }

  create() {
    this.enemiesGroup = this.physics.add.group();
    this.enemySystem = new EnemySystem(this);
    this.combatSystem = new CombatSystem(this, this.enemySystem);
    this.virtualInputs = {
      left: false,
      right: false,
      up: false,
      down: false,
      shift: false
    };

    // 0. Animations
    this.createAnimations();
    createEnemyAnimations(this);

    // 1. Map / Ground
    this.mapManager.createMap();

    // Initialize systems that depend on map groups
    this.interactionSystem.initialize();
    this.minigameOverlayManager.initialize();
    this.editorController.setupUI();

    // 2. Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

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
    this.npcs = []; // Array of containers or sprites
    this.npcSprites = new Map(); // npcTemplateId -> sprite/container
    this.loadNPCs();
    this.loadMapPickups();
    this.nearbyNPC = null;
    this.nearbyPickup = null;

    // Subscribe to room id changes to load NPCs properly when joining
    this.roomUnsubscribe = useGameStore.subscribe(
      (state) => state.currentRoomId,
      (roomId) => {
        if (roomId) this.loadNPCs();
      }
    );

    // Listener para cambios de estado de NPC durante el diálogo
    this.onNPCStateChange = (e) => {
      const { templateId, state } = e.detail;
      const container = this.npcSprites.get(templateId);
      if (container && container.list) {
          const npcSprite = container.list.find(obj => obj instanceof NPCSprite);
          if (npcSprite) {
              const anims = STATE_TO_ANIM[state] || STATE_TO_ANIM.idle;
              npcSprite.playAnimation(anims.body);
          }
      }
    };
    window.addEventListener('npc-state-changed', this.onNPCStateChange);

    // 4. Other Players & Missions
    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe(
      (state) => state.players,
      (players) => this.playerManager.handlePlayersUpdate(players)
    );

    this.missionUnsubscribe = useGameStore.subscribe(
        (state) => state.activeMission,
        (mission) => this.handleMissionUpdate(mission)
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

    // 5. Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Add keys for combat actions: J, K, L, U, Q, R
    this.keyJ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyU = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
    this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.keyJ.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerAttack();
    });
    this.keyK.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerCombo();
    });
    this.keyL.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerSpell();
    });
    this.keyU.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerThrow();
    });
    this.keyQ.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerPotion();
    });
    this.keyR.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerManaPotion();
    });

    // SPACE: esquivar/dash con teclado (cambiado desde ataque)
    this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dashKey.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      this.combatSystem.handlePlayerDash();
    });

    // H: abrir/cerrar popup de ayuda
    this.keyH = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyH.on('down', () => {
      if (this.isTyping() || !this._isCanvasFocused()) return;
      window.dispatchEvent(new CustomEvent('lobby-open-help'));
    });

    // Listener para botones virtuales táctiles
    this.onVirtualInput = (e) => {
      const { key, isDown } = e.detail;
      console.log(`[LobbyScene VirtualInput] key=${key}, isDown=${isDown}`);
      if (key === 'left') this.virtualInputs.left = isDown;
      else if (key === 'right') this.virtualInputs.right = isDown;
      else if (key === 'up') this.virtualInputs.up = isDown;
      else if (key === 'down') this.virtualInputs.down = isDown;
      else if (key === 'shift') this.virtualInputs.shift = isDown;
      else if (isDown) {
        if (key === 'attack') this.combatSystem.handlePlayerAttack();
        else if (key === 'combo') this.combatSystem.handlePlayerCombo();
        else if (key === 'spell') this.combatSystem.handlePlayerSpell();
        else if (key === 'throw') this.combatSystem.handlePlayerThrow();
        else if (key === 'potion') this.combatSystem.handlePlayerPotion();
        else if (key === 'manaPotion') this.combatSystem.handlePlayerManaPotion();
        else if (key === 'dash') this.combatSystem.handlePlayerDash();
        else if (key === 'interact') {
          if (this.interactionSystem) {
            this.interactionSystem.processSyncInteractions();
          }
        }
      }
    };
    window.addEventListener('virtual-input', this.onVirtualInput);

    // Stop Phaser from calling preventDefault() on WASD, Arrows, and Space.
    // This allows React input fields to receive these keystrokes normally!
    this.input.keyboard.removeCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,U,Q,R,H');

    // Track canvas focus state so we know when the game canvas is truly active
    this._canvasHasFocus = false;
    this._onCanvasFocus = () => { this._canvasHasFocus = true; };
    this._onCanvasBlur  = () => { this._canvasHasFocus = false; };

    // Listen for external disable/enable signals (admin pages, modals, etc.)
    this._onDisableCanvasInput = () => { this._canvasHasFocus = false; };
    this._onEnableCanvasInput  = () => {
      // Only re-enable if no HTML input has focus and we are on the lobby page
      if (!this.isTyping() && !window.location.pathname.startsWith('/admin')) {
        this._canvasHasFocus = true;
      }
    };
    window.addEventListener('phaser-disable-input', this._onDisableCanvasInput);
    window.addEventListener('phaser-enable-input',  this._onEnableCanvasInput);

    // Attach focus/blur to the phaser canvas element
    const canvasEl = this.game?.canvas;
    if (canvasEl) {
      canvasEl.setAttribute('tabindex', '0');
      canvasEl.addEventListener('focus', this._onCanvasFocus);
      canvasEl.addEventListener('blur',  this._onCanvasBlur);
    }

    // Register proper cleanup for when scene stops or restarts
    this.events.once('shutdown', () => this.shutdown());
    this.events.once('destroy', () => {
        this.shutdown();
        
        window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
        window.removeEventListener('chat-message-received', this.onChatMsg);
        window.removeEventListener('player-emoji-received', this.onEmojiMsg);
        window.removeEventListener('npc-speech-bubble', this.onNPCSpeech);
        window.removeEventListener('map-pickups-updated', this.onPickupsUpdated);
    });

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

    this.onZoomEvent = (e) => {
      const detail = e?.detail;
      if (detail?.sceneKey && detail.sceneKey !== 'LobbyScene') return;
      if (typeof detail?.zoom === 'number') {
        this.cameraSystem.setZoom(detail.zoom);
        return;
      }
      if (typeof detail?.delta === 'number') {
        this.cameraSystem.adjustZoom(detail.delta);
        return;
      }
      if (detail?.direction === 'in') {
        this.cameraSystem.adjustZoom(this.zoomStep);
      } else if (detail?.direction === 'out') {
        this.cameraSystem.adjustZoom(-this.zoomStep);
      }
    };
    window.addEventListener('phaser-camera-zoom', this.onZoomEvent);
    // Listen for chat messages
    this.onChatMsg = (e) => this._onChatReceived(e);
    window.addEventListener('chat-message-received', this.onChatMsg);

    // Listen for NPC speech bubbles
    this.onNPCSpeech = (e) => this._onNPCSpeechReceived(e);
    window.addEventListener('npc-speech-bubble', this.onNPCSpeech);

    // Listen for map pickup updates (from Editor save)
    this.onPickupsUpdated = () => this.loadMapPickups();
    window.addEventListener('map-pickups-updated', this.onPickupsUpdated);

    // Listen for NPC interaction states to pause movement
    this.onNPCInteractionStart = (e) => {
        const { templateId } = e.detail;
        const npc = this.npcSprites.get(templateId);
        if (npc) npc.npcData.isTalking = true;
    };
    this.onNPCInteractionEnd = (e) => {
        const { templateId } = e.detail;
        const npc = this.npcSprites.get(templateId);
        if (npc) npc.npcData.isTalking = false;
    };
    window.addEventListener('npc-interaction-start', this.onNPCInteractionStart);
    window.addEventListener('npc-interaction-end', this.onNPCInteractionEnd);

    this.onSpectate = () => this._onSpectate();
    window.addEventListener('spectate-player', this.onSpectate);

    // TAREA 2 FIX: Listener para reset explícito de estado de muerte
    // (disparado por DeathOverlay antes de solicitar cambio de mapa)
    this.onResetPlayerState = () => {
      console.log('[LobbyScene] reset-player-state received — resetting death state');
      if (this.combatSystem) {
        this.combatSystem.resetDeathState();
      }
      this.isSpectating = false;
      this.spectatorTarget = null;
      if (this.player) {
        this.player.setAlpha(1);
        this.player.clearTint && this.player.clearTint();
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      }
    };
    window.addEventListener('reset-player-state', this.onResetPlayerState);



    // TAREA 7: Clic izquierdo = ataque. (También desactivamos menú contextual por si acaso).
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.input.on('pointerdown', (pointer) => {
      // Usar clic izquierdo (0) para atacar
      if (pointer.leftButtonDown() && !this.isTyping()) {
        this.combatSystem.handlePlayerAttack();
      }
    });

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
    window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
    window.removeEventListener('chat-message-received', this.onChatMsg);
    window.removeEventListener('npc-speech-bubble', this.onNPCSpeech);
    window.removeEventListener('map-pickups-updated', this.onPickupsUpdated);
    window.removeEventListener('npc-interaction-start', this.onNPCInteractionStart);
    window.removeEventListener('npc-interaction-end', this.onNPCInteractionEnd);
    window.removeEventListener('spectate-player', this.onSpectate);
    window.removeEventListener('reset-player-state', this.onResetPlayerState);
    
    if (this.onVirtualInput) {
      window.removeEventListener('virtual-input', this.onVirtualInput);
      this.onVirtualInput = null;
    }
    // Cleanup editor controller listeners
    if (this.editorController) {
      this.editorController.destroy();
    }
    window.removeEventListener('phaser-disable-input', this._onDisableCanvasInput);
    window.removeEventListener('phaser-enable-input',  this._onEnableCanvasInput);

    // Remove canvas focus/blur listeners
    const canvasEl = this.game?.canvas;
    if (canvasEl && this._onCanvasFocus) {
      canvasEl.removeEventListener('focus', this._onCanvasFocus);
      canvasEl.removeEventListener('blur',  this._onCanvasBlur);
    }

    // CRITICAL: Clean up Phaser keyboard plugin so restarting the scene
    // doesn't cause WASD to stop responding due to detached key listeners.
    if (this.input && this.input.keyboard) {
      this.input.keyboard.removeAllKeys(true);
      this.input.keyboard.clearCaptures();
    }
  }

  _onChatReceived(e) {
    const { senderId, text } = e.detail;
    // Find sprite: could be me or another player
    let targetSprite = null;

    if (String(senderId) === String(this.myPlayerId)) {
      targetSprite = this.player;
    } else {
      targetSprite = this.playerSprites.get(String(senderId));
    }

    if (targetSprite) {
      this._showChatBubble(targetSprite, text);
    }
  }

  _onEmojiReceived(e) {
    const { user_id, emoji_id } = e.detail;
    let targetSprite = null;

    if (String(user_id) === String(this.myPlayerId)) {
        targetSprite = this.player;
    } else {
        targetSprite = this.playerSprites.get(String(user_id));
    }

    if (targetSprite) {
        targetSprite.showEmojiBubble(emoji_id);
    }
  }

  _onNPCSpeechReceived(e) {
    const { templateId, text } = e.detail;
    const targetNPC = this.npcSprites.get(templateId);
    if (targetNPC) {
      this._showChatBubble(targetNPC, text);
    }
  }

  _showChatBubble(sprite, text) {
    // 1. Cleanup existing bubble for this sprite if any
    if (sprite.chatBubble) {
      sprite.chatBubble.destroy();
    }

    // 2. Create Container
    const container = this.add.container(sprite.x, sprite.y - 60);
    container.setDepth(9999); // Topmost

    // 3. Text
    const style = {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#000000',
      align: 'center',
      wordWrap: { width: 150 }
    };
    const textObj = this.add.text(0, 0, text, style);
    textObj.setOrigin(0.5);

    // 4. Background (Comic Bubble)
    const bounds = textObj.getBounds();
    const padding = 10;
    const w = bounds.width + padding * 2;
    const h = bounds.height + padding * 2;

    const bg = this.add.graphics();
    bg.fillStyle(0xFFFFFF, 1);
    bg.lineStyle(2, 0x000000, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    // Triangle tail
    bg.fillTriangle(-5, h / 2, 5, h / 2, 0, h / 2 + 8);
    bg.strokeTriangle(-5, h / 2, 5, h / 2, 0, h / 2 + 8);

    container.add(bg);
    container.add(textObj);

    // 5. Attach to sprite for tracking (optional, or just update pos in update loop)
    sprite.chatBubble = container;

    // 6. Tween pop in
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.out'
    });

    // 7. Auto Destroy
    this.time.delayedCall(5000, () => {
      if (container.active) {
        this.tweens.add({
          targets: container,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            container.destroy();
            sprite.chatBubble = null;
          }
        });
      }
    });
  }



  createAnimations() {
    createCharacterAnimations(this);
    createNPCAnimations(this);
  }

  getRandomClass() {
    const classes = ['warrior', 'mage', 'archer'];
    return classes[Math.floor(Math.random() * classes.length)];
  }

  // Player management is now handled by this.playerManager (src/game/players/PlayerManager.js)
  // Mission logic is below in handleMissionUpdate


  async loadNPCs() {
    const roomId = this.initData?.roomId || useGameStore.getState().currentRoomId;
    if (!roomId) return;

    if (this.lastLoadedRoomId === roomId && this.lastLoadedSceneKey === this.currentMapKey) {
      console.log(`[LobbyScene] NPCs already loaded for room ${roomId} and map ${this.currentMapKey}`);
      return;
    }

    try {
      console.log(`[LobbyScene] Fetching NPCs for Room: ${roomId}, Map: ${this.currentMapKey}`);
      const response = await api.get(`/rooms/${roomId}/npcs`, {
        params: { scene_key: this.currentMapKey }
      });

      if (response.data) {
        // Clear existing NPCs
        this.npcs.forEach(npc => npc.destroy());
        this.npcs = [];
        this.npcSprites.clear();

        response.data.forEach(instance => {
          this.createNPCSprite(instance);
        });

        this.lastLoadedRoomId = roomId;
        this.lastLoadedSceneKey = this.currentMapKey;

        // Update indicators based on active mission
        this.handleMissionUpdate(useGameStore.getState().activeMission);
      }
    } catch (err) {
      console.error('[LobbyScene] Failed to load NPCs:', err);
    }
  }

  createNPCSprite(instance) {
    console.log('[LobbyScene] Raw instance from API:', instance);
    const tmpl = instance.npc_template;
    const def = tmpl?.npc_definition;
    if (!tmpl || !def) return;

    console.log(`[LobbyScene] Spawning NPC: ${def.name} at (${tmpl.position_x}, ${tmpl.position_y})`);

    // Use a container for name tags and indicators
    const container = this.add.container(tmpl.position_x, tmpl.position_y);
    container.setDepth(tmpl.position_y);

    // FIX: Si hay un marcador de editor ('tile-npc') debajo, lo ocultamos para que no haga de "fondo"
    const hideMarkersAt = (tx, ty) => {
        if (this.npcZones) {
            this.npcZones.getChildren().forEach(zone => {
                if (Math.abs(zone.x - tx) < 5 && Math.abs(zone.y - ty) < 5) zone.setVisible(false);
            });
        }
    };
    hideMarkersAt(tmpl.position_x, tmpl.position_y);

    // NPC Sprite (using NPCSprite for high-quality visuals)
    // FIX: Usamos def.character_id o def.sprite en lugar de tmpl.id para cargar el arte correcto
    const sprite = new NPCSprite(
      this,
      0, 0,
      def.character_id || def.sprite || '2',
      def.name
    );
    
    // NPC doesn't move by default, so we set it to idle facing the default direction
    const facing = tmpl.facing_direction || 'south';
    sprite.setFacing(facing);

    const defState = tmpl.default_state || def.default_state || 'idle';
    const initialAnim = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
    sprite.playAnimation(initialAnim.body);

    container.add(sprite);

    // Store essential data for interactions
    container.npcData = {
      templateId: tmpl.id,
      definitionId: def.id,
      instanceId: instance.id,
      characterId: def.character_id || def.sprite || '2',
      name: def.name,
      role: instance.role || tmpl.role || 'ambient',
      interactionMode: def.interaction_mode || 'hybrid',
      voiceType: def.voice_type || 'male',
      defaultState: defState,
      missionId: instance.mission_id,
      shopId: def.shop_id,
      roomId: instance.room_id,
      // Movement Params
      movementType: tmpl.movement_type || 'static',
      movementRange: tmpl.movement_range || 0,
      movementSpeed: tmpl.movement_speed || 50,
      spawnX: tmpl.position_x,
      spawnY: tmpl.position_y,
      targetX: tmpl.position_x,
      targetY: tmpl.position_y,
      moveTimer: 0,
      isTalking: false
    };

    this.physics.add.existing(container, false); // Dynamic body
    if (container.body) {
        container.body.setImmovable(true); // Don't let player push them
        // Increase collider size to ~70% of tile size for better presence
        container.body.setCircle(35, -35, -35); 
        // Ensure they don't move on collision
        container.body.setBounce(0);
        container.body.setFriction(1);
    }
    this.npcs.push(container);
    this.npcSprites.set(tmpl.id, container);

    // Add collision between local player and this NPC
    if (this.player && this.player.body) {
      this.physics.add.collider(this.player, container);
    }
  }

  handleMissionUpdate(mission) {
    if (!this.npcs) return;

    this.npcs.forEach(npcContainer => {
      const npcId = npcContainer.npcData.templateId;
      const status = this.getNpcMissionStatus(npcId, mission);
      this.updateNpcIndicator(npcContainer, status);
    });
  }
  
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

  getNpcMissionStatus(npcId, mission) {
      if (!mission) return null;
      
      // Check if this NPC is the source of the mission or a target
      const isStartNpc = mission.start_npc_id === npcId;
      const tasks = mission.tasks || [];
      const currentTask = tasks.find(t => !t.is_completed);
      
      if (!currentTask && isStartNpc) return 'complete'; // Ready to hand in
      
      if (currentTask) {
          if (currentTask.npc_id === npcId) {
              return currentTask.is_completed ? 'success' : 'active';
          }
      }
      
      return null;
  }

  updateNpcIndicator(container, status) {
      // Remove old indicator if exists
      if (container.indicator) {
          container.indicator.destroy();
          container.indicator = null;
      }

      let emoji = '';
      let color = '#ffffff';

      if (status === 'complete') {
          emoji = '❓';
          color = '#ffff00';
      } else if (status === 'active') {
          emoji = '❗';
          color = '#ffff00';
      } else if (status === 'success') {
          emoji = '✔';
          color = '#00ff00';
      }

      if (emoji) {
          const indicator = this.add.text(0, -45, emoji, {
              fontSize: '20px',
              fill: color,
              stroke: '#000000',
              strokeThickness: 3
          }).setOrigin(0.5);
          container.add(indicator);
          container.indicator = indicator;
          // Add a little bounce
          this.tweens.add({
              targets: indicator,
              y: -50,
              duration: 1000,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
          });
      }
  }

  async loadMapPickups() {
    try {
      console.log(`[LobbyScene] Fetching Map Pickups for scene: ${this.currentMapKey}`);
      const response = await api.get(`/inventory/pickups/${this.currentMapKey}`);
      
      if (response.data) {
        // Clear existing pickups if any (usually empty on start)
        this.activePickups?.forEach(p => p.destroy());
        this.activePickups = [];

        response.data.forEach(pickup => {
          if (!pickup.is_picked_up) {
            this.createMapPickupSprite(pickup);
          }
        });
      }
    } catch (err) {
      console.error('[LobbyScene] Failed to load map pickups:', err);
    }
  }

  createMapPickupSprite(pickup) {
    const item = pickup.item;
    if (!item) return;

    // Visual container for the item
    const container = this.add.container(pickup.x, pickup.y);
    container.setDepth(pickup.y);
    
    // Hide editor marker if exists underneath
    if (this.pickups) {
      this.pickups.getChildren().forEach(p => {
        if (Math.abs(p.x - pickup.x) < 5 && Math.abs(p.y - pickup.y) < 5) {
          p.setVisible(false);
        }
      });
    }

    const spriteKey = `item-sprite-${item.icon_key}`;
    // If not loaded yet, use a fallback circle/square
    let sprite;
    if (this.textures.exists(spriteKey)) {
      sprite = this.add.image(0, 0, spriteKey);
    } else {
      sprite = this.add.rectangle(0, 0, 32, 32, 0xffff00);
    }
    
    sprite.setDisplaySize(32, 32);
    container.add(sprite);

    // Floating animation
    this.tweens.add({
      targets: sprite,
      y: -5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    container.pickupData = pickup;
    this.activePickups.push(container);
  }

  createChallengePoints() {
    const points = [
      { id: 'challenge_1', name: 'Challenge 1', x: 600, y: 350, color: 0xff6b00 },
      { id: 'challenge_2', name: 'Challenge 2', x: 1400, y: 350, color: 0xff6b00 },
      { id: 'challenge_3', name: 'Challenge 3', x: 1000, y: 500, color: 0xff6b00 }
    ];

    points.forEach((data) => {
      const container = this.add.container(data.x, data.y);
      const marker = this.add.circle(0, 0, 18, data.color, 0.75);
      const ring = this.add.circle(0, 0, 28);
      ring.setStrokeStyle(2, data.color, 0.45);
      const label = this.add.text(0, -35, data.name, {
        fontSize: '12px',
        fill: '#ffffff',
        backgroundColor: '#000000'
      }).setOrigin(0.5);

      container.add([ring, marker, label]);
      container.setDepth(50);
      container.challengeData = data;
      container.setSize(60, 60);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => {
        const activeChallengeId = useGameStore.getState().activeChallengeId;
        if (activeChallengeId !== data.id) {
          useGameStore.getState().joinChallenge(data.id);
        }
        window.dispatchEvent(new CustomEvent('lobby-open-challenge', { detail: { challengeId: data.id } }));
      });

      this.challengePoints.push(container);
    });
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

  // Returns true if the Phaser canvas is the currently focused element
  // or if the player seems to be interacting with it (no HTML element has focus).
  _isCanvasFocused() {
    const el = document.activeElement;
    if (!el) return true;
    // If a real HTML form element has focus → canvas is NOT focused
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLButtonElement ||
      el.isContentEditable
    ) return false;
    // If we are on an admin route → never let canvas capture keys
    if (window.location.pathname.startsWith('/admin')) return false;
    // If phaser-disable-input was dispatched externally → blocked
    if (this._canvasHasFocus === false && el !== document.body && el !== this.game?.canvas) {
      return false;
    }
    return true;
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
      this.updateNPCs(time, delta);
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
    this.updateNPCs(time);

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

  updateNPCs(time) {
    if (!this.npcs) return;

    this.npcs.forEach(npc => {
        // Enforce depth sorting (Feet at container.y)
        npc.setDepth(npc.y + 1);

        const data = npc.npcData;
        if (!data || data.movementType === 'static' || data.isTalking) {
            if (npc.body) npc.body.setVelocity(0);
            const sprite = npc.list.find(item => item instanceof NPCSprite);
            if (sprite) {
                if (data.isTalking) {
                    sprite.playAnimation('talking');
                } else {
                    const defState = data.defaultState || 'idle';
                    const animConfig = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
                    sprite.playAnimation(animConfig.body || 'idle-waiting');
                }
            }
            return;
        }

        if (data.movementType === 'wander') {
            const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, data.targetX, data.targetY);
            const sprite = npc.list.find(item => item instanceof NPCSprite);

            if (distToTarget < 5) {
                // We reached the target
                if (npc.body) npc.body.setVelocity(0);
                if (sprite) {
                    const defState = data.defaultState || 'idle';
                    const animConfig = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
                    sprite.playAnimation(animConfig.body || 'idle-waiting');
                }

                // Wait before picking next target
                if (time > data.moveTimer) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * data.movementRange;
                    data.targetX = data.spawnX + Math.cos(angle) * dist;
                    data.targetY = data.spawnY + Math.sin(angle) * dist;
                    data.moveTimer = time + 2000 + Math.random() * 3000; // Wait 2-5 seconds
                }
            } else {
                // Move towards target
                this.physics.moveTo(npc, data.targetX, data.targetY, data.movementSpeed);
                if (sprite) {
                    sprite.playAnimation('walking');
                    // Flip sprite based on velocity
                    if (npc.body.velocity.x < 0) sprite.sprite.setFlipX(true);
                    else if (npc.body.velocity.x > 0) sprite.sprite.setFlipX(false);
                }
            }
        }
    });
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
    
    if (this.onChatMsg) {
      window.removeEventListener('chat-message-received', this.onChatMsg);
      this.onChatMsg = null;
    }
    if (this.onEmojiMsg) {
      window.removeEventListener('player-emoji-received', this.onEmojiMsg);
      this.onEmojiMsg = null;
    }
    if (this.onResize) {
      this.scale.off('resize', this.onResize);
      this.onResize = null;
    }
    if (this.onZoomEvent) {
      window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
      this.onZoomEvent = null;
    }
    if (this.onNPCSpeech) {
      window.removeEventListener('npc-speech-bubble', this.onNPCSpeech);
      this.onNPCSpeech = null;
    }
    if (this.onEnemyDied) {
      window.removeEventListener('enemy-died-broadcast', this.onEnemyDied);
      this.onEnemyDied = null;
    }
    if (this.onEnemyUpdate) {
      window.removeEventListener('enemies-update', this.onEnemyUpdate);
      this.onEnemyUpdate = null;
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
