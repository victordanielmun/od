import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAudioStore } from '../../store/audioStore';
import { PlayerSprite } from '../entities/PlayerSprite';
import { NPCSprite } from '../entities/NPCSprite';
import { loadCharacterSprites, createCharacterAnimations } from '../config/CharacterConfig';
import { loadNPCSprites, createNPCAnimations, STATE_TO_ANIM } from '../config/NPCConfig';
import EnemySprite from '../entities/EnemySprite';
import { loadEnemySprites, createEnemyAnimations } from '../config/EnemyConfig';
import api from '../../services/api';
import i18n from '../../i18n';

import { MapManager } from '../map/MapManager';
import { CameraSystem } from '../map/CameraSystem';
import { EditorController } from '../editor/EditorController';
import { PlayerManager } from '../players/PlayerManager';
import { InteractionSystem } from '../interactions/InteractionSystem';

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
    this.activeEnemies = new Map(); // instanceId -> EnemySprite
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
    this.isDead = false;
    this.isSpectating = false;
    this.spectatorTarget = null;
    this.GRID_SIZE = 100;
    this.editorBuildScale = 2.5; // default 2.5× (range 1–3)
    // Default metadata for newly-placed builds — must match the UI's default (portalType: 'map')
    this.editorBuildMetadata = { portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' };

    this.mapManager = new MapManager(this);
    this.cameraSystem = new CameraSystem(this);
    this.interactionSystem = new InteractionSystem(this);
    this.playerManager = new PlayerManager(this);
    this.editorController = new EditorController(this);

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
      playerSprites: { get: () => this.playerManager.sprites }
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
    this.playerAttackIFrames = 0;
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
    // --- Optimized Asset Loading ---
    // Only load what's needed for the current map, or everything if admin (for editor)
    const sceneKey = this.initData?.map || 'lobby';
    
    // Load Enemy assets
    loadEnemySprites(this);
    
    const isStoreMap = sceneKey.toLowerCase().includes('store') || sceneKey.toLowerCase().includes('pantry') || sceneKey.toLowerCase().includes('shop');
    const isNatureMap = sceneKey.toLowerCase().includes('forest') || sceneKey.toLowerCase().includes('woods') || sceneKey.toLowerCase().includes('garden') || sceneKey === 'lobby';
    const isAdmin = useAuthStore.getState().isAdmin();

    // Core Atlases — always needed
    if (!this.textures.exists('terrain'))
      this.load.atlas('terrain', '/terrain/terrain-spritesheet.png', '/terrain/terrain-sprites.json');
    if (!this.textures.exists('walls'))
      this.load.atlas('walls', '/wall/wall-spritesheet.png', '/wall/wall-sprites.json');

    // Conditional Atlases
    if ((isNatureMap || isAdmin) && !this.textures.exists('forest'))
      this.load.atlas('forest', '/forest/forest-spritesheet.png', '/forest/forest-sprites.json');
    
    if ((isNatureMap || isAdmin) && !this.textures.exists('builds'))
      this.load.atlas('builds', '/builds/build-spritesheet.png', '/builds/build-sprites.json');

    if ((isStoreMap || isAdmin) && !this.textures.exists('store-tiles'))
      this.load.atlas('store-tiles', '/store/tiles.png', '/store/tiles.json');
    
    if ((isStoreMap || isAdmin) && !this.textures.exists('store-furniture'))
      this.load.atlas('store-furniture', '/store/furniture.png', '/store/furniture.json');

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
    // 0. Animations
    this.createAnimations();
    createEnemyAnimations(this);
    this.interactionSystem.initialize();
    this.editorController.setupUI();

    // 1. Map / Ground
    this.mapManager.createMap();

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
      ({ master, music, sfx }) => {
        // Apply global master volume to the Phaser Sound Manager
        this.sound.volume = master;
        this.sound.mute = (master === 0 || music === 0);

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

    // Stop Phaser from calling preventDefault() on WASD, Arrows, and Space.
    // This allows React input fields to receive these keystrokes normally!
    this.input.keyboard.removeCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT');

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

    this.onEnemyUpdate = (e) => this._onEnemiesUpdate(e);
    window.addEventListener('enemies-update', this.onEnemyUpdate);

    this.onEnemyDied = (e) => this._onEnemyDied(e);
    window.addEventListener('enemy-died-broadcast', this.onEnemyDied);

    this.onSpectate = () => this._onSpectate();
    window.addEventListener('spectate-player', this.onSpectate);

    // TAREA 2 FIX: Listener para reset explícito de estado de muerte
    // (disparado por DeathOverlay antes de solicitar cambio de mapa)
    this.onResetPlayerState = () => {
      console.log('[LobbyScene] reset-player-state received — resetting death state');
      this.isDead = false;
      this.isSpectating = false;
      this.spectatorTarget = null;
      if (this.player) {
        this.player.setAlpha(1);
        this.player.clearTint && this.player.clearTint();
      }
    };
    window.addEventListener('reset-player-state', this.onResetPlayerState);

    // Player Health Bar (Local UI in Canvas)
    this.hpBar = this.add.graphics();
    this.hpBar.setScrollFactor(0);
    this.hpBar.setDepth(200000);
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerAttackIFrames = 0;
    this._updateHpBar();

    // Listen for enemy attacks
    this.events.on('enemy-attack', (data) => {
      if (this.isDead || this.isSpectating) return;
      if (this.playerAttackIFrames > 0) return;
      
      console.log(`[LobbyScene] Recibiendo ataque de enemigo: ${data.damage} de daño`);
      this.playerHp = Math.max(0, this.playerHp - data.damage);
      this.playerAttackIFrames = 800; // 0.8s iFrames
      this._updateHpBar();
      
      if (this.playerHp <= 0) {
        this._onPlayerDeath();
        return;
      }

      // TAREA 3: Animar hurt del jugador + tint rojo
      if (this.player) {
        this.player.playAnimation('hurt', 400); // 400ms lock
        if (this.player.sprite) {
          this.player.sprite.setTint(0xff4444);
        }
        // Limpiar tint y volver a idle al terminar la animacion hurt (~400ms)
        this.time.delayedCall(400, () => {
          if (this.player?.sprite) this.player.sprite.clearTint();
          if (!this.isDead && this.player) {
            this.player._animLocked = false;
            this.player.playAnimation('idle');
          }
        });
      }
    });

    // SPACE: ataque con teclado (existente)
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.attackKey.on('down', () => this.handlePlayerAttack());

    // TAREA 7: Clic izquierdo = ataque. (También desactivamos menú contextual por si acaso).
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.input.on('pointerdown', (pointer) => {
      // Usar clic izquierdo (0) para atacar
      if (pointer.leftButtonDown() && !this.isTyping()) {
        this.handlePlayerAttack();
      }
    });

    // Cooldown de ataque del jugador (ms) para evitar spam
    this.attackCooldownMs = 0;

    // Cleanup when scene is destroyed or stopped
    this.events.on('shutdown', this._cleanupListeners, this);
    this.events.on('destroy', this._cleanupListeners, this);
  }

  _updateHpBar() {
    if (!this.hpBar || !this.hpBar.active) return;
    
    this.hpBar.clear();
    
    const x = 40;
    const y = 40;
    const w = 240;
    const h = 24;
    
    // Background (Border)
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 12);
    this.hpBar.lineStyle(3, 0xffd700, 1);
    this.hpBar.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 12);

    // Health bar fill
    const fillWidth = (this.playerHp / this.playerMaxHp) * w;
    const color = this.playerHp < 30 ? 0xff3333 : (this.playerHp < 60 ? 0xffcc33 : 0x33ff33);
    
    this.hpBar.fillStyle(color, 1);
    if (fillWidth > 0) {
      this.hpBar.fillRoundedRect(x, y, fillWidth, h, 8);
    }

    // Label
    if (!this.hpText || !this.hpText.scene) {
      this.hpText = this.add.text(x + w/2, y + h/2, `HP: ${this.playerHp} / ${this.playerMaxHp}`, {
        fontFamily: '"Outfit", sans-serif',
        fontSize: '14px',
        fontWeight: '900',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200001);
    } else {
      try {
        this.hpText.setText(`HP: ${this.playerHp} / ${this.playerMaxHp}`);
      } catch (e) {
        console.warn("[LobbyScene] Failed to update HP text:", e);
        // If it failed once, try to recreate it next time
        this.hpText = null;
      }
    }
  }

  _onPlayerDeath() {
    console.log("[LobbyScene] Player has died locally");
    if (this.isDead) return;
    
    this.isDead = true;
    
    if (this.player) {
      // TAREA 4: 'die' es el key correcto en CharacterConfig (no 'dead')
      this.player.playAnimation('die');
      if (this.player.body) this.player.body.setVelocity(0, 0);
    }
    
    // Esperar que termine la animación die (~1200ms) antes de mostrar la UI de muerte
    this.time.delayedCall(1200, () => {
      window.dispatchEvent(new CustomEvent('player-dead'));
    });
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
    window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
    window.removeEventListener('chat-message-received', this.onChatMsg);
    window.removeEventListener('npc-speech-bubble', this.onNPCSpeech);
    window.removeEventListener('map-pickups-updated', this.onPickupsUpdated);
    window.removeEventListener('npc-interaction-start', this.onNPCInteractionStart);
    window.removeEventListener('npc-interaction-end', this.onNPCInteractionEnd);
    window.removeEventListener('enemies-update', this.onEnemyUpdate);
    window.removeEventListener('enemy-died-broadcast', this.onEnemyDied);
    window.removeEventListener('spectate-player', this.onSpectate);
    window.removeEventListener('reset-player-state', this.onResetPlayerState);
    
    // Cleanup editor controller listeners
    if (this.editorController) {
      this.editorController.destroy();
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

  _onEnemiesUpdate(e) {
    const { enemies } = e.detail;
    if (!enemies) return;

    enemies.forEach(data => {
      let sprite = this.activeEnemies.get(data.instance_id);
      
      if (!sprite) {
        // Robust asset selection:
        // 1. Use sprite_id if provided by server.
        // 2. If npc_id looks like a UUID (length > 10), it's probably old data -> fallback to '1'.
        // 3. Otherwise use npc_id or '1'.
        let assetId = data.sprite_id;
        if (!assetId) {
            const isUUID = data.npc_id && data.npc_id.length > 10;
            assetId = isUUID ? '1' : (data.npc_id || '1');
        }

        console.log(`[LobbyScene] Spawning new enemy: ${data.npc_id} with asset ${assetId} (${data.instance_id})`);
        sprite = new EnemySprite(this, data.x, data.y, assetId, 'Enemy');
        this.add.existing(sprite); // Add to display list so it renders
        
        // Evitar que el enemigo se superponga al jugador físicamente
        if (this.player && sprite.body) {
            this.physics.add.collider(this.player, sprite);
        }
        
        // Set initial config and target
        sprite.config = data;
        if (this.player) sprite.target = this.player;
        
        this.activeEnemies.set(data.instance_id, sprite);
        sprite.lastUpdated = Date.now();
      }

      sprite.syncFromServer(data);
      sprite.lastUpdated = Date.now();
    });

    // Cleanup orphans (enemies not seen for > 2 seconds)
    // This prevents flickering/blinking if an update packet is missed
    const now = Date.now();
    this.activeEnemies.forEach((sprite, id) => {
        if (now - sprite.lastUpdated > 2000) {
            console.log(`[LobbyScene] Removing stale enemy: ${id}`);
            sprite.destroy();
            this.activeEnemies.delete(id);
        }
    });
  }

  _onEnemyDied(e) {
    const { instance_id } = e.detail;
    const sprite = this.activeEnemies.get(instance_id);
    if (sprite) {
        // TAREA 5: delay 1500ms para que la animación 'dying' complete antes del destroy
        sprite.updateHealth(0, 100); // Triggers death animation (FSM: DEAD → 'dying')
        this.time.delayedCall(1500, () => {
            if (sprite.active) sprite.destroy();
            this.activeEnemies.delete(instance_id);
        });
    }
  }

  handlePlayerAttack() {
    if (!this.player || this.isTyping()) return;
    if (this.isDead) return;

    // TAREA 6: cooldown de ataque para evitar spam (500ms)
    const now = this.time.now;
    if (now - (this._lastAttackTime || 0) < 500) return;
    this._lastAttackTime = now;

    // 1. TAREA 6: Animación 'slash' del jugador
    // characterId es el campo correcto en PlayerSprite
    const charId = this.player.characterId || '1';
    const slashKey = `char-${charId}-slash`;
    if (this.anims.exists(slashKey)) {
        this.player.playAnimation('slash', 500); // lock anim for 500ms
    }

    // 2. Hit Detection — encuentra el enemigo más cercano en rango
    let nearestEnemy = null;
    let minDist = 120; // TAREA 6: Rango de golpe ampliado de 80 → 120px

    this.activeEnemies.forEach((enemy, id) => {
        if (!enemy.active || enemy.fsm === 'dead') return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist < minDist) {
            nearestEnemy = { id, enemy };
            minDist = dist;
        }
    });

    if (nearestEnemy) {
        console.log(`[LobbyScene] Hit enemy ${nearestEnemy.id} at dist ${minDist.toFixed(1)}px`);
        
        // Enviar ataque al servidor
        useGameStore.getState().sendPlayerAttack(nearestEnemy.id);
        
        // Feedback visual en el enemigo: tint rojo (hurt) + limpieza
        const hitEnemy = nearestEnemy.enemy;
        if (hitEnemy.sprite) {
            hitEnemy.sprite.setTint(0xff2222);
            this.time.delayedCall(200, () => {
                if (hitEnemy.active && hitEnemy.sprite) hitEnemy.sprite.clearTint();
            });
        }

        // Efecto de impacto en el punto de contacto
        this._spawnHitEffect(hitEnemy.x, hitEnemy.y);
    }
  }

  // Efecto visual de impacto (flash + texto de hit)
  _spawnHitEffect(x, y) {
    const flash = this.add.circle(x, y, 14, 0xffdd00, 0.85).setDepth(1000);
    this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 180,
        onComplete: () => flash.destroy(),
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
    const roomId = useGameStore.getState().currentRoomId;
    if (!roomId) return;

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
        const { bgmVolume } = useAudioStore.getState();
        const volume = (typeof bgmVolume === 'number' && isFinite(bgmVolume)) ? bgmVolume / 100 : 0.5;
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
    switch (type) {
      case 'wall': return 'tile-wall';
      case 'floor': return 'tile-floor';
      case 'spawn': return 'tile-spawn';
      case 'npc': return 'tile-npc';
      case 'item': return 'tile-item';
      case 'void': return 'tile-void';
      case 'collider': return 'tile-collider';
      case 'enemy': return 'tile-enemy';
      default: return 'tile-floor';
    }
  }

  _getGroupForType(type) {
    if (!this.mapManager) return null;
    switch (type) {
      case 'wall': return this.mapManager.walls;
      case 'floor': return this.mapManager.floors;
      case 'spawn': return this.mapManager.spawns;
      case 'npc': return this.mapManager.npcZones;
      case 'item': return this.mapManager.pickups;
      case 'void': return this.mapManager.voids;
      case 'collider': return this.mapManager.colliders;
      case 'enemy': return this.mapManager.enemySpawns;
      default: return this.mapManager.floors;
    }
  }

  isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    if (el instanceof HTMLInputElement) return true;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLSelectElement) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  update(time, delta) {
    if (!this.player) return;

    if (this.playerAttackIFrames > 0) {
      this.playerAttackIFrames -= delta;
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
    if (this.isDead) {
      if (this.player.body) this.player.body.setVelocity(0, 0);
      return; 
    }

    // Update NPCs
    this.updateNPCs(time, delta);

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

    // Dynamic Depth Sorting: Local Player (Snap base to feet)
    this.player.setDepth(this.player.y + 1);

    const speed = 160;
    const body = this.player.body;
    body.setVelocity(0);

    if (!this.isTyping()) {
      const left = this.cursors.left.isDown || this.wasd.left.isDown;
      const right = this.cursors.right.isDown || this.wasd.right.isDown;
      const up = this.cursors.up.isDown || this.wasd.up.isDown;
      const down = this.cursors.down.isDown || this.wasd.down.isDown;

      if (left) {
        body.setVelocityX(-speed);
      } else if (right) {
        body.setVelocityX(speed);
      } else if (up) {
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

  updateNPCs(time, delta) {
    if (!this.npcs) return;

    this.npcs.forEach(npc => {
        // Enforce depth sorting (Feet at container.y)
        npc.setDepth(npc.y + 1);

        const data = npc.npcData;
        if (!data || data.movementType === 'static' || data.isTalking) {
            if (npc.body) npc.body.setVelocity(0);
            // Ensure child NPCSprite is idle
            const sprite = npc.list.find(item => item instanceof NPCSprite);
            if (sprite) sprite.playAnimation('idle-waiting');
            return;
        }

        if (data.movementType === 'wander') {
            const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, data.targetX, data.targetY);
            const sprite = npc.list.find(item => item instanceof NPCSprite);

            if (distToTarget < 5) {
                // We reached the target
                if (npc.body) npc.body.setVelocity(0);
                if (sprite) sprite.playAnimation('idle-waiting');

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
    if (this.onEditorEvent) {
      window.removeEventListener('editor-command', this.onEditorEvent);
      this.onEditorEvent = null;
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
