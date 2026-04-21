import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useAudioStore } from '../../store/audioStore';
import { PlayerSprite } from '../entities/PlayerSprite';
import { NPCSprite } from '../entities/NPCSprite';
import { loadCharacterSprites, createCharacterAnimations } from '../config/CharacterConfig';
import { loadNPCSprites, createNPCAnimations, STATE_TO_ANIM } from '../config/NPCConfig';
import api from '../../services/api';
import i18n from '../../i18n';

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
    this.GRID_SIZE = 100;
    this.editorBuildScale = 2.5; // default 2.5× (range 1–3)
    // Default metadata for newly-placed builds — must match the UI's default (portalType: 'map')
    this.editorBuildMetadata = { portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' };

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
  }

  preload() {
    loadCharacterSprites(this);
    loadNPCSprites(this);

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
    ];

    tileTypes.forEach(({ key, fill, stroke }) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      // Usar un alpha menor para el marcador de NPC e Item (0.3) para que no oculte el suelo y se vea más profesional
      // El colisionador también usa transparencia para que se vea el suelo debajo
      const alpha = (key === 'tile-npc' || key === 'tile-item' || key === 'tile-collider') ? 0.3 : 1;
      g.fillStyle(fill, alpha);
      g.fillRect(0, 0, 100, 100);
      g.lineStyle(2, stroke);
      g.strokeRect(0, 0, 100, 100);
      g.generateTexture(key, 100, 100);
      g.destroy();
    });

    // Keep legacy alias for backwards compatibility
    const gLegacy = this.make.graphics({ x: 0, y: 0, add: false });
    gLegacy.fillStyle(0x666666);
    gLegacy.fillRect(0, 0, 100, 100);
    gLegacy.lineStyle(2, 0x000000);
    gLegacy.strokeRect(0, 0, 100, 100);
    gLegacy.generateTexture('wall-texture', 100, 100);
    gLegacy.destroy();

    // Load Atlases — guard with textures.exists() to prevent 'frame already exists'
    // warnings when the scene restarts (e.g., map portal transition).
    if (!this.textures.exists('terrain'))
      this.load.atlas('terrain', '/terrain/terrain-spritesheet.png', '/terrain/terrain-sprites.json');
    if (!this.textures.exists('forest'))
      this.load.atlas('forest', '/forest/forest-spritesheet.png', '/forest/forest-sprites.json');
    if (!this.textures.exists('builds'))
      this.load.atlas('builds', '/builds/build-spritesheet.png', '/builds/build-sprites.json');
    if (!this.textures.exists('walls'))
      this.load.atlas('walls', '/wall/wall-spritesheet.png', '/wall/wall-sprites.json');
    if (!this.textures.exists('store-tiles'))
      this.load.atlas('store-tiles', '/store/tiles.png', '/store/tiles.json');
    if (!this.textures.exists('store-furniture'))
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

    // REMOVED: Insecure admin-only request that was causing 401 Unauthorized errors for guests.
    // if (!this.cache.json.exists('item-sprites-list'))
    //   this.load.json('item-sprites-list', '/api/admin/item-sprites');
  }

  create() {
    // 0. Animations
    this.createAnimations();

    // 1. Map / Ground
    this.createMap();

    // 1.5 Load saved map from server (overrides default walls)
    // IMPORTANT: createMyPlayer() is called INSIDE loadServerMapConfig()
    // after the async map fetch resolves, so mapDefaultSpawnX/Y are set first.
    const urlParams = new URLSearchParams(window.location.search);
    // Prioritize initData (from portal) -> URL param -> default 'lobby'
    this.currentMapKey = this.initData?.map || urlParams.get('map') || urlParams.get('edit_map') || 'lobby';
    
    // Sync with gameStore for UI components
    useGameStore.setState({ currentSceneKey: this.currentMapKey });

    this.loadServerMapConfig();

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
      (players) => this.handlePlayersUpdate(players)
    );

    this.missionUnsubscribe = useGameStore.subscribe(
        (state) => state.activeMission,
        (mission) => this.handleMissionUpdate(mission)
    );

    // Initial render of existing players (in case they loaded before scene)
    this.handlePlayersUpdate(useGameStore.getState().players);

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
    this.input.keyboard.removeCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');

    // Use a native keydown listener for E instead of Phaser key capture,
    // so it works even when Phaser's focus is not guaranteed (HTML inputs, etc.).
    this._interactPressed = false;
    this._onInteractKeyDown = (e) => {
      if (e.code === 'KeyE' && !this.isTyping()) {
        this._interactPressed = true;
        // In order to allow window.open to not be blocked by popup blockers,
        // it must happen synchronously in the keydown listener if interacting with a portal
        this.processSyncInteractions();
      }
    };
    window.addEventListener('keydown', this._onInteractKeyDown);

    // Register proper cleanup for when scene stops or restarts
    this.events.once('shutdown', () => this.shutdown());
    this.events.once('destroy', () => {
        this.shutdown();
        window.removeEventListener('keydown', this._onInteractKeyDown);
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
    this.cameras.main.setZoom(this.zoom);
    this.onResize = (gameSize) => this.configureCamera(gameSize);
    this.scale.on('resize', this.onResize);

    this.onZoomEvent = (e) => {
      const detail = e?.detail;
      if (detail?.sceneKey && detail.sceneKey !== 'LobbyScene') return;
      if (typeof detail?.zoom === 'number') {
        this.setZoom(detail.zoom);
        return;
      }
      if (typeof detail?.delta === 'number') {
        this.adjustZoom(detail.delta);
        return;
      }
      if (detail?.direction === 'in') {
        this.adjustZoom(this.zoomStep);
      } else if (detail?.direction === 'out') {
        this.adjustZoom(-this.zoomStep);
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

    // MOVED: dispatching 'game-ready' event moved to loadServerMapConfig.finally()
    // window.dispatchEvent(new Event('game-ready'));

    // REMOVED: Dependent code for insecure item-sprites-list fetch.
    /*
    const spritesList = this.cache.json.get('item-sprites-list');
    if (Array.isArray(spritesList)) {
      spritesList.forEach(file => {
        const key = `item-sprite-${file}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, `/Items/sprites/${file}`);
        }
      });
      this.load.start();
    }
    */
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

  // ─── Map Editor ───────────────────────────────────────────────────────────

  // NOTE: The authoritative toggleEditorMode is defined below (line ~961).
  // This section intentionally left as a comment to avoid duplication.

  _buildEditorGrid() {
    if (!this.editorGridOverlay) {
      this.editorGridOverlay = this.add.graphics();
      this.editorGridOverlay.setDepth(500);
    }
    this.editorGridOverlay.clear();
    this.editorGridOverlay.lineStyle(1, 0x00ffff, 0.2);
    for (let x = 0; x <= this.mapWidth; x += this.GRID_SIZE) {
      this.editorGridOverlay.lineBetween(x, 0, x, this.mapHeight);
    }
    for (let y = 0; y <= this.mapHeight; y += this.GRID_SIZE) {
      this.editorGridOverlay.lineBetween(0, y, this.mapWidth, y);
    }
    this.editorGridOverlay.setVisible(true);
  }

  /** Redraws the background gridGraphics for the editor (not the editorGridOverlay).
   *  Only called when editor mode is active to avoid thousands of draw calls on large maps. */
  _rebuildEditorGrid(width, height) {
    if (!this.gridGraphics) return;
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x333333, 0.5);
    const G = this.GRID_SIZE;
    for (let x = 0; x <= width; x += G) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += G) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(width, y);
    }
    this.gridGraphics.strokePath();
    this.gridGraphics.setVisible(true);
  }

  _setupEditorPointer() {
    this._editorPointerMove = (pointer) => {
      if (!this.editorMode) return;
      const gx = Math.floor(pointer.worldX / this.GRID_SIZE) * this.GRID_SIZE;
      const gy = Math.floor(pointer.worldY / this.GRID_SIZE) * this.GRID_SIZE;
      if (!this.cursorPreview) {
        this.cursorPreview = this.add.graphics();
        this.cursorPreview.setDepth(501);
      }
      this.cursorPreview.clear();
      this.cursorPreview.lineStyle(2, 0xffff00, 0.8);
      this.cursorPreview.strokeRect(gx, gy, this.GRID_SIZE, this.GRID_SIZE);
      this.cursorPreview.setVisible(true);
      if (this.isDragging && this.editorTool === 'brush') this._paintTile(gx, gy);
    };

    this._editorPointerDown = (pointer) => {
      if (!this.editorMode) return;
      const gx = Math.floor(pointer.worldX / this.GRID_SIZE) * this.GRID_SIZE;
      const gy = Math.floor(pointer.worldY / this.GRID_SIZE) * this.GRID_SIZE;
      this.isDragging = true;
      if (this.editorTool === 'rect') {
        this.dragStartGrid = { gx, gy };
      } else {
        this._paintTile(gx, gy);
      }
    };

    this._editorPointerUp = (pointer) => {
      if (!this.editorMode) return;
      if (this.editorTool === 'rect' && this.dragStartGrid) {
        const endGx = Math.floor(pointer.worldX / this.GRID_SIZE) * this.GRID_SIZE;
        const endGy = Math.floor(pointer.worldY / this.GRID_SIZE) * this.GRID_SIZE;
        const minX = Math.min(this.dragStartGrid.gx, endGx);
        const maxX = Math.max(this.dragStartGrid.gx, endGx);
        const minY = Math.min(this.dragStartGrid.gy, endGy);
        const maxY = Math.max(this.dragStartGrid.gy, endGy);
        for (let x = minX; x <= maxX; x += this.GRID_SIZE) {
          for (let y = minY; y <= maxY; y += this.GRID_SIZE) {
            this._paintTile(x, y);
          }
        }
        this.dragStartGrid = null;
      }
      this.isDragging = false;
    };

    this.input.on('pointermove', this._editorPointerMove, this);
    this.input.on('pointerdown', this._editorPointerDown, this);
    this.input.on('pointerup', this._editorPointerUp, this);
  }

  _eraseTileAt(gx, gy) {
    if (!this.editorTiles) this.editorTiles = new Map();
    const key = `${gx}_${gy}`;

    // 1. Remove from temporary editor tiles
    if (this.editorTiles.has(key)) {
      this.editorTiles.get(key).destroy();
      this.editorTiles.delete(key);
    }
    
    // 2. Remove from static groups (saved objects)
    const groups = [
      this.walls, this.floors, this.forest, this.builds, 
      this.npcZones, this.pickups, this.spawns, this.voids, this.colliders
    ];
    
    const checkRange = this.GRID_SIZE / 2;
    groups.forEach(group => {
      if (!group) return;
      const children = group.getChildren ? group.getChildren() : [];
      children.forEach(child => {
        if (Math.abs(child.x - (gx + this.GRID_SIZE/2)) < checkRange && 
            Math.abs(child.y - (gy + this.GRID_SIZE/2)) < checkRange) {
          child.destroy();
        } else if (child.originX === 0 && Math.abs(child.x - gx) < 5 && Math.abs(child.y - gy) < 5) {
          child.destroy();
        }
      });
    });
  }

  _handleEditorCommand({ action, value }) {
    switch (action) {
      case 'setTool': this.editorTool = value; break;
      case 'setTileType': this.editorTileType = value; break;
      case 'setTexture': this.editorTextureFrame = value; break;
      case 'undo':
        if (this.editorHistory.length > 0) {
          const last = this.editorHistory.pop();
          const [gx, gy] = last.split('_').map(Number);
          this._eraseTileAt(gx, gy);
        }
        break;
      default: break;
    }
  }

  createAnimations() {
    createCharacterAnimations(this);
    createNPCAnimations(this);
  }

  adjustZoom(delta) {
    const cam = this.cameras?.main;
    if (!cam) return;
    const next = Phaser.Math.Clamp(cam.zoom + delta, this.zoomMin, this.zoomMax);
    this.setZoom(next);
  }

  setZoom(zoom) {
    const cam = this.cameras?.main;
    if (!cam) return;
    const next = Phaser.Math.Clamp(zoom, this.zoomMin, this.zoomMax);
    if (next === cam.zoom) return;
    cam.setZoom(next);
    this._cameraBoundsDirty = true; // Recalculate bounds on next frame
    this.configureCamera();
  }

  configureCamera(gameSize) {
    const cam = this.cameras?.main;
    if (!cam || !this.player) return;

    const width = Number(gameSize?.width ?? this.scale?.width ?? cam.width);
    const height = Number(gameSize?.height ?? this.scale?.height ?? cam.height);

    if (Number.isFinite(width) && Number.isFinite(height)) {
      // Use strict bounds to ensure the camera never shows the area outside the map
      cam.setBounds(0, 0, this.mapWidth, this.mapHeight);
      
      if (this.backgroundRect) {
        this.backgroundRect.width = this.mapWidth;
        this.backgroundRect.height = this.mapHeight;
      }
    }

    cam.setFollowOffset(0, 0);
    cam.setDeadzone();
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.centerOn(this.player.x, this.player.y);
  }

  createMap() {
    const G = this.GRID_SIZE;

    // Background
    this.backgroundRect = this.add.rectangle(
      this.mapWidth / 2, this.mapHeight / 2,
      this.mapWidth, this.mapHeight, 0x2a2a2a
    );
    this.backgroundRect.setDepth(-100); // FIXED: Prevent background from hiding floor tiles (-10)

    // Base grid lines — only drawn and visible in editor mode to avoid
    // thousands of draw calls on large maps (e.g. 2400x10400).
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setVisible(false); // Hidden until editor is enabled

    // Physics bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // Tile groups — each type has its own static group
    this.walls = this.physics.add.staticGroup();
    this.floors = this.add.group();           // visual only (no physics)
    this.forest = this.physics.add.staticGroup(); // Collidable trees/bushes
    this.builds = this.physics.add.staticGroup(); // Portal structures
    this.spawns = this.add.group();           // visual markers
    this.npcZones = this.add.group();          // visual markers
    this.pickups = this.add.group();           // visual markers for item pickups in editor
    this.voids = this.physics.add.staticGroup(); // Solid void blocks
    this.colliders = this.physics.add.staticGroup(); // Invisible solid blocks
    this.storeTiles = this.add.group(); // Visual store floors
    this.storeFurniture = this.physics.add.staticGroup(); // Collidable store furniture

    // Default walls for first load
    for (let x = 200; x < 600; x += G) {
      this.walls.create(x, 400, 'tile-wall').refreshBody();
    }

    // Cursor preview (ghost tile) — only visible in editor mode
    this.cursorPreview = this.add.rectangle(0, 0, G, G, 0xffffff, 0.3);
    this.cursorPreview.setStrokeStyle(2, 0xffff00, 0.8);
    this.cursorPreview.setDepth(900);
    this.cursorPreview.setVisible(false);

    // Rectangle selection preview
    this.rectPreview = this.add.graphics();
    this.rectPreview.setDepth(899);
    this.rectPreview.setVisible(false);

    // Coordinate label near cursor
    this.cursorCoordLabel = this.add.text(0, 0, '', {
      fontSize: '10px', fill: '#ffff00',
      backgroundColor: '#00000088', padding: { x: 3, y: 2 }
    });
    this.cursorCoordLabel.setDepth(901);
    this.cursorCoordLabel.setVisible(false);

    // ===== Editor Input =====

    // Pointermove: update cursor preview
    this.input.on('pointermove', (pointer) => {
      if (!this.editorMode) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gx = Math.floor(wp.x / G) * G + G / 2;
      const gy = Math.floor(wp.y / G) * G + G / 2;

      this.cursorPreview.setPosition(gx, gy);
      this.cursorCoordLabel.setPosition(gx + G / 2 + 4, gy - G / 2);
      this.cursorCoordLabel.setText(`${Math.floor(wp.x / G)},${Math.floor(wp.y / G)}`);

      // Drag painting (brush/eraser tool only)
      if (this.isDragging && this.editorTool !== 'rect') {
        this._editorPlaceOrErase(gx, gy);
      }

      // Rectangle preview
      if (this.isDragging && this.editorTool === 'rect' && this.dragStartGrid) {
        this._drawRectPreview(this.dragStartGrid.x, this.dragStartGrid.y, gx, gy);
      }
    });

    // Pointerdown: start action
    this.input.on('pointerdown', (pointer) => {
      console.log('[MapEditor] pointerdown', { editorMode: this.editorMode, rightBtn: pointer.rightButtonDown() });
      if (!this.editorMode) return;
      if (pointer.rightButtonDown()) return;
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gx = Math.floor(wp.x / G) * G + G / 2;
      const gy = Math.floor(wp.y / G) * G + G / 2;

      console.log('[MapEditor] pointerdown grid', { gx, gy, w: this.mapWidth, h: this.mapHeight });
      if (gx < 0 || gx > this.mapWidth || gy < 0 || gy > this.mapHeight) {
        console.log('[MapEditor] pointerdown out of bounds');
        return;
      }

      this.isDragging = true;
      this.dragStartGrid = { x: gx, y: gy };

      if (this.editorTool === 'marker') {
        window.dispatchEvent(new CustomEvent('editor-picked-coord', { detail: { x: gx, y: gy } }));
        
        // Visual feedback
        const txt = this.add.text(gx, gy, `📍 ${gx}, ${gy}`, {
          fontSize: '12px', fill: '#00ffcc', backgroundColor: '#000000bb', padding: { x: 4, y: 2 }
        });
        txt.setOrigin(0.5, 1);
        txt.setDepth(1005);
        this.tweens.add({
          targets: txt,
          y: gy - 30,
          alpha: 0,
          duration: 1500,
          ease: 'Power2',
          onComplete: () => txt.destroy()
        });
        
        return; // Don't place or erase tiles
      }

      if (this.editorTool !== 'rect') {
        if (this.editorTool === 'inspector') {
          this._pickObjectAt(gx, gy);
        } else {
          this._editorPlaceOrErase(gx, gy);
        }
      }
    });

    // Pointerup: end action
    this.input.on('pointerup', () => {
      console.log('[MapEditor] pointerup', { editorMode: this.editorMode, isDragging: this.isDragging });
      if (!this.editorMode || !this.isDragging) return;
      this.isDragging = false;

      // If rect tool: fill the rectangle area
      if (this.editorTool === 'rect' && this.dragStartGrid) {
        const wp = this.cameras.main.getWorldPoint(
          this.input.activePointer.x, this.input.activePointer.y
        );
        const gx = Math.floor(wp.x / G) * G + G / 2;
        const gy = Math.floor(wp.y / G) * G + G / 2;
        this._editorFillRect(this.dragStartGrid.x, this.dragStartGrid.y, gx, gy);
        this.rectPreview.clear();
        this.rectPreview.setVisible(false);
      }

      this.dragStartGrid = null;
    });

    // Listen for editor commands from React UI
    this.onEditorEvent = (e) => {
      const { action, value } = e.detail || {};
      switch (action) {
        case 'setTool': this.setEditorTool(value); break;
        case 'setTileType': this.setEditorTileType(value); break;
        case 'setTexture': this.setEditorTexture(value); break;
        case 'setBuildMetadata': this.editorBuildMetadata = value; break;
        case 'setBuildScale': this.editorBuildScale = parseFloat(value) || 1; break;
        case 'setNPCMetadata': this.editorNPCMetadata = value; break;
        case 'setPickupMetadata': this.editorPickupMetadata = value; break;
        case 'setMoveMode': this.setEditorMoveMode(value); break;
        case 'undo': this.undo(); break;
        case 'redo': this.redo(); break;
        case 'clearAll': this.clearAllTiles(); break;
        case 'importMap': this.importMapConfig(value); break;
        case 'applyBuildMetadata': this.applyBuildMetadataToAll(); break;
        case 'setTool': this.setEditorTool(value); break;
      }
    };
    window.addEventListener('editor-command', this.onEditorEvent);
  }

  _pickObjectAt(gx, gy) {
    const found = this._findTileAt(gx, gy);
    if (!found) return;

    const { tile, type } = found;
    let metadata = {};
    if (tile.data) {
      metadata = tile.data.getAll();
    }

    const detail = {
      type: type,
      frame: tile.frame.name,
      scale: tile.scaleX || 1,
      metadata: metadata,
      x: gx,
      y: gy
    };

    console.log('[MapEditor] Object picked:', detail);
    window.dispatchEvent(new CustomEvent('editor-picked-object', { detail }));

    // Visual feedback: brief flash on the picked tile
    const flash = this.add.graphics();
    flash.lineStyle(2, 0xffffff, 1);
    flash.strokeRect(gx - this.GRID_SIZE/2, gy - this.GRID_SIZE/2, this.GRID_SIZE, this.GRID_SIZE);
    flash.setDepth(2000);
    this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
    });
  }

  applyBuildMetadataToAll() {
    if (!this.editorBuildMetadata) return;
    const { targetMap, targetX, targetY, targetRoute, interactionText } = this.editorBuildMetadata;
    let count = 0;
    this.builds?.getChildren().forEach(s => {
      const gObj = s;
      if (targetMap !== undefined) gObj.data.set('targetMap', targetMap);
      if (targetRoute !== undefined) gObj.data.set('targetRoute', targetRoute);
      if (this.editorBuildMetadata.portalType !== undefined) gObj.data.set('portalType', this.editorBuildMetadata.portalType);
      if (targetX !== undefined) gObj.data.set('targetX', targetX);
      if (targetY !== undefined) gObj.data.set('targetY', targetY);
      if (interactionText !== undefined) gObj.data.set('interactionText', interactionText);
      
      // Update the buildScale if it was changed
      const scale = this.editorBuildMetadata.buildScale || 2;
      gObj.setScale(scale);
      gObj.data.set('buildScale', scale);
      
      count++;
    });
    console.log(`[LobbyScene] Applied metadata to ${count} builds`);
    // Visual feedback
    this.cameras.main.flash(200, 0, 255, 0);
  }

  // ===== Editor: Tile placement / erasure =====

  _getTextureForType(type) {
    const map = { wall: 'tile-wall', floor: 'tile-floor', spawn: 'tile-spawn', npc: 'tile-npc', forest: 'forest', build: 'builds', void: 'tile-void', collider: 'tile-collider' };
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
      default: return this.walls;
    }
  }

  _findTileAt(gx, gy, targetType = null) {
    // Search all groups for a tile at the given grid position.
    // ORDER MATTERS: We check interactive/topmost objects first (builds, npcs) 
    // and background objects last (floors, voids) so the 'Inspect' tool picks what the user expects.
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
      { group: this.colliders, type: 'collider' }
    ];

    for (const item of searchOrder) {
      if (!item.group) continue;
      if (targetType && item.type !== targetType) continue; // Filter if targetType provided
      const children = item.group.getChildren();
      const found = children.find(t => Math.abs(t.x - gx) < 1 && Math.abs(t.y - gy) < 1);
      if (found) return { tile: found, type: item.type, group: item.group };
    }
    return null;
  }

  _findAllTilesAt(gx, gy) {
    const groups = [this.walls, this.floors, this.forest, this.builds, this.spawns, this.npcZones, this.pickups, this.voids, this.colliders, this.storeTiles, this.storeFurniture];
    const types = ['wall', 'floor', 'forest', 'build', 'spawn', 'npc', 'item', 'void', 'collider', 'store', 'furniture'];
    const found = [];
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      const children = groups[i].getChildren();
      const tile = children.find(t => Math.abs(t.x - gx) < 1 && Math.abs(t.y - gy) < 1);
      if (tile) found.push({ tile, type: types[i], group: groups[i] });
    }
    return found;
  }

  _editorPlaceOrErase(gx, gy) {
    if (gx < 0 || gx > this.mapWidth || gy < 0 || gy > this.mapHeight) return;

    console.log(`[MapEditor] _editorPlaceOrErase called at ${gx}, ${gy} with tool ${this.editorTool} and type ${this.editorTileType}`);
    const existingTiles = this._findAllTilesAt(gx, gy);

    if (this.editorTool === 'eraser') {
      if (existingTiles.length > 0) {
        const floorIndex = existingTiles.findIndex(t => t.type === 'floor');
        let toErase = null;
        if (existingTiles.length > 1 && floorIndex !== -1) {
          toErase = existingTiles.find(t => t.type !== 'floor');
        } else {
          toErase = existingTiles[existingTiles.length - 1];
        }

        if (toErase) {
          this.editorHistory.push({ action: 'remove', type: toErase.type, x: gx, y: gy });
          this.editorRedoStack = [];
          
          // 1. Destroy visual marker
          toErase.tile.destroy();

          // 2. IMMEDIATE FEEDBACK: Destroy real NPC or item if erasing its marker
          if (toErase.type === 'npc') {
            const npcToRemove = this.npcs.find(n => Math.abs(n.x - gx) < this.GRID_SIZE && Math.abs(n.y - gy) < this.GRID_SIZE);
            if (npcToRemove) {
              const tid = npcToRemove.npcData?.templateId;
              if (tid) this.npcSprites.delete(tid);
              npcToRemove.destroy();
              this.npcs = this.npcs.filter(n => n !== npcToRemove);
            }
          } else if (toErase.type === 'item') {
            const pickupToRemove = this.activePickups.find(p => Math.abs(p.x - gx) < this.GRID_SIZE && Math.abs(p.y - gy) < this.GRID_SIZE);
            if (pickupToRemove) {
              pickupToRemove.destroy();
              this.activePickups = this.activePickups.filter(p => p !== pickupToRemove);
            }
          }

          this._emitEditorStats();
        }
      }
      return;
    }

    // Brush: place tile (skip if same type already there)
    const isFloor = this.editorTileType === 'floor';
    let replacing = null;

    if (isFloor || this.editorTileType === 'store') {
      replacing = existingTiles.find(t => t.type === 'floor' || t.type === 'store');
    } else {
      // It's an object. It replaces any OTHER object that is NOT a floor/store and NOT a void.
      // E.g. placing a tree (forest) should replace an existing wall or build or npc, but not void or floor.
      replacing = existingTiles.find(t => t.type !== 'floor' && t.type !== 'store' && t.type !== 'void');
    }

    if (replacing) {
      // If inspector tool, we don't place anything, we already handled it in pointerdown
      if (this.editorTool === 'inspector') return;

      // Check if it's EXACTLY the same (type, frame, and metadata)
      const sameType = replacing.type === this.editorTileType;
      const sameFrame = (replacing.tile.frame.name === this.editorTextureFrame) || (!this.editorTextureFrame && replacing.tile.frame.name === 'sprite1');
      
      // For objects with complex data, we check if they are likely same (simplified)
      // Actually, if it's same type but different frame/scale, we WANT to replace it to "edit" it.
      if (sameType && sameFrame) {
        // Special check for builds/npcs: if metadata is different in UI vs actual, we might still want to update.
        // But for now, if it's same type and same frame, we skip to avoid redundant placements.
        return; 
      }
      
      // Capture old metadata for perfect Undo/Redo
      const oldMetadata = replacing.tile.data ? JSON.parse(JSON.stringify(replacing.tile.data.getAll())) : null;
      let newMetadata = null;
      if (this.editorTileType === 'build') newMetadata = this.editorBuildMetadata;
      else if (this.editorTileType === 'npc') newMetadata = this.editorNPCMetadata;
      else if (this.editorTileType === 'item') newMetadata = this.editorPickupMetadata;

      // Different type: remove old, place new
      this.editorHistory.push({ 
        action: 'replace', 
        oldType: replacing.type, 
        oldMetadata: oldMetadata,
        newType: this.editorTileType, 
        newMetadata: newMetadata,
        x: gx, y: gy 
      });
      replacing.tile.destroy();
    } else {
      // Avoid placing void on top of void
      if (this.editorTileType === 'void') {
        if (existingTiles.find(t => t.type === 'void')) return;
      }

      let currentMetadata = null;
      if (this.editorTileType === 'build') currentMetadata = this.editorBuildMetadata;
      else if (this.editorTileType === 'npc') currentMetadata = this.editorNPCMetadata;
      else if (this.editorTileType === 'item') currentMetadata = this.editorPickupMetadata;

      this.editorHistory.push({ 
        action: 'place', 
        type: this.editorTileType, 
        x: gx, y: gy, 
        frame: this.editorTextureFrame, 
        metadata: currentMetadata, 
        scale: this.editorBuildScale 
      });
    }
    this.editorRedoStack = [];

    const texture = this._getTextureForType(this.editorTileType);
    const group = this._getGroupForType(this.editorTileType);

    if (this.editorTileType === 'wall') {
      const f = this.editorTextureFrame || 'sprite1';
      group.create(gx, gy, 'walls', f).refreshBody();
    } else if (this.editorTileType === 'floor' || this.editorTileType === 'store') {
      // Use terrain atlas for floors, or store-tiles for stores
      const atlas = this.editorTileType === 'store' ? 'store-tiles' : 'terrain';
      const sprite = this.add.image(gx, gy, atlas, this.editorTextureFrame);
      sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
      sprite.setAlpha(1);
      group.add(sprite);
      // Floor depth is -10
      sprite.setDepth(-10);
    } else if (this.editorTileType === 'furniture') {
      const f = this.editorTextureFrame || 'sprite1';
      const sprite = group.create(gx, gy, 'store-furniture', f);
      // Let's use scale 1.0 for furniture by default, or build scale?
      // For now scale 1.0 is safer as furniture varies a lot.
      sprite.setScale(1.0);
      this._setupFurnitureSprite(sprite);
    } else if (this.editorTileType === 'forest') {
      // Forest objects: collidable, variable size
      const f = this.editorTextureFrame || 'sprite1';
      const sprite = group.create(gx, gy, 'forest', f);
      sprite.setScale(1.8);
      this._setupForestSprite(sprite);
    } else if (this.editorTileType === 'build') {
      // Build objects: portal logic
      const f = this.editorTextureFrame || 'sprite1';
      const scale = this.editorBuildScale || 1;
      const sprite = group.create(gx, gy, 'builds', f);
      sprite.setScale(scale);
      sprite.data = new Phaser.Data.DataManager(sprite);
      // Store metadata (target map, etc.) if key present
      if (this.editorBuildMetadata) {
        sprite.data.set('targetMap', this.editorBuildMetadata.targetMap);
        sprite.data.set('targetRoute', this.editorBuildMetadata.targetRoute);
        sprite.data.set('portalType', this.editorBuildMetadata.portalType);
        sprite.data.set('targetX', this.editorBuildMetadata.targetX);
        sprite.data.set('targetY', this.editorBuildMetadata.targetY);
      }
      sprite.data.set('buildScale', scale);
      this._setupBuildSprite(sprite);
    } else if (this.editorTileType === 'npc' || this.editorTileType === 'item') {
      const sprite = group.create(gx, gy, texture);
      sprite.setAlpha(0.8);
      sprite.setVisible(this.editorMode);
      sprite.data = new Phaser.Data.DataManager(sprite);
      if (this.editorNPCMetadata) {
        sprite.data.set('definitionId', this.editorNPCMetadata.definitionId);
        sprite.data.set('role', this.editorNPCMetadata.role);
        if (this.editorNPCMetadata.missionIds) {
          sprite.data.set('missionIds', [...this.editorNPCMetadata.missionIds]);
        } else if (this.editorNPCMetadata.missionId) {
          sprite.data.set('missionIds', [this.editorNPCMetadata.missionId]);
        }
      }
      if (this.editorTileType === 'item' && this.editorPickupMetadata) {
        sprite.data.set('itemId', this.editorPickupMetadata.itemId);
        sprite.data.set('quantity', this.editorPickupMetadata.quantity || 1);
      }
    } else if (this.editorTileType === 'void' || this.editorTileType === 'collider') {
      const sprite = group.create(gx, gy, texture);
      if (sprite) sprite.setVisible(this.editorMode);
    } else {
      const sprite = this.add.sprite(gx, gy, texture);
      sprite.setVisible(this.editorMode);
      sprite.setAlpha(0.8);
      group.add(sprite);
    }
    this._emitEditorStats();
  }



  _editorFillRect(x1, y1, x2, y2) {
    const G = this.GRID_SIZE;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let x = minX; x <= maxX; x += G) {
      for (let y = minY; y <= maxY; y += G) {
        this._editorPlaceOrErase(x, y);
      }
    }
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

  _emitEditorStats() {
    window.dispatchEvent(new CustomEvent('editor-stats', {
      detail: {
        walls: this.walls?.getChildren()?.length || 0,
        floors: this.floors?.getChildren()?.length || 0,
        forest: this.forest?.getChildren()?.length || 0,
        builds: this.builds?.getChildren()?.length || 0,
        spawns: this.spawns?.getChildren()?.length || 0,
        npcZones: this.npcZones?.getChildren()?.length || 0,
        pickups: this.pickups?.getChildren()?.length || 0,
        voids: this.voids?.getChildren()?.length || 0,
        colliders: this.colliders?.getChildren()?.length || 0,
        storeTiles: this.storeTiles?.getChildren()?.length || 0,
        furniture: this.storeFurniture?.getChildren()?.length || 0,
        historySize: this.editorHistory?.length || 0,
        redoSize: this.editorRedoStack?.length || 0,
      }
    }));
  }

  // ===== Editor: Tool & tile type setters =====

  setEditorTool(tool) {
    this.editorTool = tool;
    // Update cursor color based on tool
    const colors = { brush: 0x00ff88, eraser: 0xff4444, rect: 0xffff00, marker: 0x00ffff, inspector: 0xff00ff };
    this.cursorPreview?.setStrokeStyle(2, colors[tool] || 0xffffff, 0.8);
  }

  setEditorTileType(type) {
    this.editorTileType = type;
    // Update cursor fill to match tile color
    const colors = { 
      wall: 0x666666, floor: 0x8B7355, forest: 0x228B22, build: 0xCD853F, 
      spawn: 0x00CC66, npc: 0x4488FF, void: 0x2596be, collider: 0xFFD700,
      store: 0x556270, furniture: 0xFF6B6B
    };
    this.cursorPreview?.setFillStyle(colors[type] || 0xffffff, 0.3);
  }

  setEditorTexture(frame) {
    this.editorTextureFrame = frame;
    console.log('[MapEditor] Selected texture:', frame);
  }

  // ===== Editor: Undo / Redo =====

  undo() {
    if (this.editorHistory.length === 0) return;
    const entry = this.editorHistory.pop();
    this.editorRedoStack.push(entry);

    if (entry.action === 'place') {
      // Remove the tile that was placed
      const found = this._findTileAt(entry.x, entry.y, entry.type);
      if (found) found.tile.destroy();
    } else if (entry.action === 'remove') {
      // Re-place the tile that was removed
      this._placeTileDirect(entry.type, entry.x, entry.y);
    } else if (entry.action === 'replace') {
      // Remove new, place old
      const found = this._findTileAt(entry.x, entry.y, entry.newType);
      if (found) found.tile.destroy();
      this._placeTileDirect(entry.oldType, entry.x, entry.y);
    }
    this._emitEditorStats();
  }

  redo() {
    if (this.editorRedoStack.length === 0) return;
    const entry = this.editorRedoStack.pop();
    this.editorHistory.push(entry);

    if (entry.action === 'place') {
      // pass metadata if present
      this._placeTileDirect(entry.type, entry.x, entry.y, entry.frame, entry.metadata);
    } else if (entry.action === 'remove') {
      const found = this._findTileAt(entry.x, entry.y, entry.type);
      if (found) found.tile.destroy();
    } else if (entry.action === 'replace') {
      const found = this._findTileAt(entry.x, entry.y, entry.oldType);
      if (found) found.tile.destroy();
      this._placeTileDirect(entry.newType, entry.x, entry.y);
    }
    this._emitEditorStats();
  }

  _placeTileDirect(type, gx, gy, frame = null, metadata = null) {
    const texture = this._getTextureForType(type);
    const group = this._getGroupForType(type);

    // We need to temporarily set these to ensure the creation logic picks them up if needed
    // or just duplicate logic. Since _editorPlaceOrErase uses "this.editorTextureFrame",
    // let's manually create sprite to avoid side effects on current editor state.

    if (type === 'wall') {
      group.create(gx, gy, texture).refreshBody();
    } else if (type === 'floor' || type === 'store') {
      const atlas = type === 'store' ? 'store-tiles' : 'terrain';
      const f = frame || 'sprite1';
      const sprite = this.add.image(gx, gy, atlas, f);
      sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
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
      sprite.setVisible(this.editorMode);
      sprite.data = new Phaser.Data.DataManager(sprite);
      if (metadata) {
        sprite.data.set('definitionId', metadata.definitionId);
        sprite.data.set('role', metadata.role);
        sprite.data.set('missionId', metadata.missionId);
      }
    } else if (type === 'void') {
      const sprite = group.create(gx, gy, texture);
      sprite.setVisible(this.editorMode);
    } else if (type === 'collider') {
      const sprite = group.create(gx, gy, texture);
      sprite.setVisible(this.editorMode);
    } else {
      const sprite = this.add.sprite(gx, gy, texture);
      sprite.setAlpha(0.8);
      sprite.setVisible(this.editorMode);
      group.add(sprite);
    }
  }

  _setupForestSprite(sprite) {
    // 1. Depth Sorting: Base of the tree
    sprite.setDepth(sprite.y + (sprite.displayHeight * 0.5));

    // 2. Physics Body: Trunk only
    // refreshBody() matches the body exactly to the current displayed sprite size.
    sprite.refreshBody();

    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;

    // Trunk collision area: 40% width, 10% height
    const bodyW = dw * 0.4;
    const bodyH = dh * 0.1;

    // For StaticBody, we set the size in displayed pixels and then 
    // set the offset from the top-left of the sprite's display area.
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  _setupBuildSprite(sprite) {
    // ---- 1. Depth sorting ----
    // AGGRESSIVE SORTING: Use a point high up on the sprite (10% from the top center)
    // to ensure that almost the entire building structure is rendered BEHIND players
    // standing anywhere on the porch, stairs, or foundation.
    sprite.setDepth(sprite.y - (sprite.displayHeight * 0.1));

    // ---- 2. Physics body ----
    // refreshBody() syncs the StaticBody position to the sprite's current world pos
    sprite.refreshBody();

    const dw = sprite.displayWidth;    // width  × scale
    const dh = sprite.displayHeight;   // height × scale

    const bodyW = dw * 0.80;           // 80% of displayed width
    const bodyH = dh * 0.60;           // 60% height (walls and roof)

    // setSize(w, h)
    sprite.body.setSize(bodyW, bodyH);

    // Offset: Align to the new "solid" line (35% from bottom)
    // dh is the full height. Bottom of body should be at dh * 0.35? 
    // No, wait. dh * 1.0 is the bottom. dh * 0.35 is high up.
    // In our aggressive depth logic, the base was sprite.y - (dh * 0.1).
    // The visual base is at dh * 0.9 or something. 
    // Let's use the bottom edge for physics for now, or just below the walls.
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  _setupFurnitureSprite(sprite) {
    // 1. Depth Sorting: Base of the furniture
    sprite.setDepth(sprite.y + (sprite.displayHeight * 0.5));

    // 2. Physics Body
    sprite.refreshBody();
    const dw = sprite.displayWidth;
    const dh = sprite.displayHeight;
    const bodyW = dw * 0.8;
    const bodyH = dh * 0.8;
    sprite.body.setSize(bodyW, bodyH);
    sprite.body.setOffset((dw - bodyW) / 2, dh - bodyH);
  }

  // ===== Editor: Clear & Toggle =====

  clearAllTiles() {
    // Save current state for a potential undo-all (simplified: just clear)
    this.walls.clear(true, true);
    this.floors.clear(true, true);
    this.forest.clear(true, true);
    this.builds.clear(true, true);
    this.spawns.clear(true, true);
    this.npcZones.clear(true, true);
    this.pickups.clear(true, true); // FIXED: Added pickups layer
    this.voids.clear(true, true);
    this.colliders.clear(true, true);
    this.storeTiles?.clear(true, true);
    this.storeFurniture?.clear(true, true);

    // Also clear the "live" sprites if we are in the editor to avoid visual clutter
    this.npcs.forEach(n => n.destroy());
    this.npcs = [];
    if (this.npcSprites) this.npcSprites.clear();
    
    // Clear active pickups
    if (this.activePickups) {
      this.activePickups.forEach(p => p.destroy());
      this.activePickups = [];
    }

    this.editorHistory = [];
    this.editorRedoStack = [];
    this._emitEditorStats();
  }

  /**
   * Toggles the map editor on/off.
   * Only admins can activate it.
   * @param {boolean} enabled
   */
  updateMapMetadata(settings) {
    if (!settings) return;
    if (settings.defaultSpawnX !== undefined) this.mapDefaultSpawnX = Number(settings.defaultSpawnX);
    if (settings.defaultSpawnY !== undefined) this.mapDefaultSpawnY = Number(settings.defaultSpawnY);
    if (settings.bgmTrack !== undefined) this.currentBgmTrackId = settings.bgmTrack;
    if (settings.isPublic !== undefined) this.mapIsPublic = !!settings.isPublic;
    if (settings.maxUsers !== undefined) this.mapMaxUsers = Number(settings.maxUsers);
    console.log('[LobbyScene] Map metadata updated from UI');
  }

  toggleEditorMode(enabled) {
    // Admin guard
    if (enabled) {
      if (!useAuthStore.getState().isAdmin()) {
        console.warn('[LobbyScene] Unauthorized editor activation attempt.');
        return;
      }
    }

    this.editorMode = enabled;

    // Toggle physics debug visibility
    if (this.physics && this.physics.world) {
      if (enabled) {
        this.physics.world.drawDebug = true;
        if (!this.physics.world.debugGraphic) {
          this.physics.world.createDebugGraphic();
        }
        this.physics.world.debugGraphic.setVisible(true);
      } else {
        this.physics.world.drawDebug = false;
        if (this.physics.world.debugGraphic) {
          this.physics.world.debugGraphic.setVisible(false);
        }
      }
    }
    this.cursorPreview?.setVisible(enabled);
    this.cursorCoordLabel?.setVisible(enabled);
    if (this.gridGraphics) {
      if (enabled) {
        // Lazy-build: only draw the grid when the editor first opens
        this._rebuildEditorGrid(this.mapWidth, this.mapHeight);
      } else {
        // Just hide it — no need to clear/redraw for gameplay
        this.gridGraphics.setVisible(false);
      }
    }


    // Toggle visibility of editor-only marker groups
    const markerGroups = [this.spawns, this.npcZones, this.pickups, this.voids, this.colliders];
    markerGroups.forEach(group => {
      if (group) {
        group.getChildren().forEach(child => {
          if (child.setVisible) child.setVisible(enabled);
        });
      }
    });

    if (this.player) {
      if (enabled) {
        // --- ENTER EDITOR MODE ---
        // Default to camera-pan mode on open
        this.editorMoveMode = 'camera';
        this._applyEditorMoveMode('camera');
        // Store position so we can return after exiting
        this.preEditorPos = { x: this.player.x, y: this.player.y };
        console.log('[MapEditor] Entering Editor — Move Mode:', this.editorMoveMode);
      } else {
        // --- EXIT EDITOR MODE ---
        // Fully restore character mode
        this.editorMoveMode = 'camera'; // Reset for next open
        this.player.setAlpha(1);
        if (this.player.body) {
          this.player.body.setEnable(true);
          this.player.body.setVelocity(0, 0);
        }
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        console.log('[MapEditor] Exiting Editor Mode');
      }
    }

    if (!enabled) {
      this.isDragging = false;
      this.dragStartGrid = null;
      this.rectPreview?.clear();
      this.rectPreview?.setVisible(false);
    } else {
      console.log('[MapEditor] Editor active. Tool:', this.editorTool, 'Tile:', this.editorTileType);
    }
    this._emitEditorStats();
  }

  /**
   * Switches between 'camera' and 'character' move modes while the editor is active.
   * @param {'camera'|'character'} mode
   */
  setEditorMoveMode(mode) {
    if (!this.editorMode) return;
    this.editorMoveMode = mode;
    this._applyEditorMoveMode(mode);
    console.log('[MapEditor] Move mode switched to:', mode);
    // Notify React UI so button state can update
    window.dispatchEvent(new CustomEvent('editor-move-mode-changed', { detail: { mode } }));
  }

  /**
   * Applies the visual/physics state for the given move mode.
   * @param {'camera'|'character'} mode
   */
  _applyEditorMoveMode(mode) {
    if (!this.player) return;

    const isCharacterMode = (mode === 'character');
    const markersVisible = this.editorMode;

    if (this.gridGraphics) this.gridGraphics.setVisible(markersVisible);

    const markerGroups = [this.spawns, this.npcZones, this.pickups, this.voids, this.colliders];
    markerGroups.forEach(group => {
      if (group) {
        group.getChildren().forEach(child => {
          if (child.setVisible) child.setVisible(markersVisible);
        });
      }
    });

    if (mode === 'camera') {
      // Keep player visible but semi-transparent so the editor is clean but location is known
      this.player.setAlpha(0.4);
      if (this.player.body) {
        this.player.body.setEnable(false);
        this.player.body.setVelocity(0, 0);
      }
      // FIXED: Remove camera bounds entirely to allow unrestricted panning across the whole canvas
      this.cameras.main.removeBounds();
      this.cameras.main.stopFollow();
    } else {
      // character mode: player is fully opaque and physics-enabled, camera follows
      this.player.setAlpha(1);
      if (this.player.body) {
        this.player.body.setEnable(true);
      }
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      // Restore bounds to map size for player mode
      this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    }
  }

  // ===== Export / Import (multi-type) =====

  exportMapConfig() {
    const data = {
      width: this.mapWidth,
      height: this.mapHeight,
      defaultSpawnX: this.mapDefaultSpawnX,
      defaultSpawnY: this.mapDefaultSpawnY,
      bgmTrack: this.currentBgmTrackId || 'none',
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
        missionId: t.data?.get('missionId'), // Keep for backward compatibility if needed
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
    };
    return JSON.stringify(data, null, 2);
  }

  importMapConfig(config) {
    if (!config) return;
    try {
      const data = typeof config === 'string' ? JSON.parse(config) : config;
      
      this.clearAllTiles();
      
      if (data.width) this.mapWidth = data.width;
      if (data.height) this.mapHeight = data.height;
      
      // FIXED: Call resizeMap to update visuals and bounds immediately
      this.resizeMap(this.mapWidth, this.mapHeight);
      
      // Update map-level properties
      if (data.defaultSpawnX != null) this.mapDefaultSpawnX = Number(data.defaultSpawnX);
      if (data.defaultSpawnY != null) this.mapDefaultSpawnY = Number(data.defaultSpawnY);
      if (data.isPublic !== undefined) this.mapIsPublic = !!data.isPublic;
      if (data.maxUsers !== undefined) this.mapMaxUsers = Number(data.maxUsers);
      
      if (data.bgmTrack && data.bgmTrack !== 'none') {
        this.currentBgmTrackId = data.bgmTrack;
        // Trigger BGM change via store if possible or next reload will pick it up
      }
      
      // Resize bounds and background if dimensions changed
      this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
      if (this.backgroundRect) {
        this.backgroundRect.setSize(this.mapWidth, this.mapHeight);
        this.backgroundRect.setPosition(this.mapWidth / 2, this.mapHeight / 2);
      }
      
      // Update grid graphics
      if (this.gridGraphics) {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x333333, 0.5);
        const G = this.GRID_SIZE;
        for (let x = 0; x <= this.mapWidth; x += G) {
          this.gridGraphics.moveTo(x, 0);
          this.gridGraphics.lineTo(x, this.mapHeight);
        }
        for (let y = 0; y <= this.mapHeight; y += G) {
          this.gridGraphics.moveTo(0, y);
          this.gridGraphics.lineTo(this.mapWidth, y);
        }
        this.gridGraphics.strokePath();
      }

      // Re-populate layers
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
      if (data.collider && !data.colliders) data.collider.forEach(t => this._placeTileDirect('collider', t.x, t.y)); // Compatibility
      if (data.storeTiles) data.storeTiles.forEach(t => this._placeTileDirect('store', t.x, t.y, t.frame));
      if (data.furniture) data.furniture.forEach(t => this._placeTileDirect('furniture', t.x, t.y, t.frame));

      console.log('[LobbyScene] Map imported successfully');
      this._emitEditorStats();
      this.cameras.main.flash(300, 0, 150, 255);
    } catch (err) {
      console.error('[LobbyScene] Error importing map config:', err);
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
  }

  loadMapConfig(jsonConfig) {
    if (!jsonConfig) return;
    try {
      const data = JSON.parse(jsonConfig);

      // Support old format (plain array = walls only) - defaults to 800x800
      if (Array.isArray(data)) {
        this.resizeMap(800, 800);
        this.clearMap(); // Ensure clean slate
        data.forEach(w => this.walls.create(w.x, w.y, 'tile-wall').refreshBody());
        return;
      }

      // New multi-type format
      // Check for map dimensions in data or default to 800
      const w = data.width || 800;
      const h = data.height || 800;
      this.resizeMap(w, h);

      // Store map-level default spawn so createMyPlayer can use it when no portal spawn is given
      if (data.defaultSpawnX != null) this.mapDefaultSpawnX = Number(data.defaultSpawnX);
      if (data.defaultSpawnY != null) this.mapDefaultSpawnY = Number(data.defaultSpawnY);

      this.clearMap();

      (data.walls || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        this.walls.create(w.x, w.y, 'walls', frame).refreshBody();
      });
      (data.floors || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        const s = this.add.image(w.x, w.y, 'terrain', frame);
        s.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
        s.setDepth(-10); // Ensure floor is always below players and objects
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
      (data.spawns || []).forEach(w => { const s = this.add.sprite(w.x, w.y, 'tile-spawn'); s.setAlpha(0.8); s.setVisible(this.editorMode); this.spawns.add(s); });
      (data.npcZones || []).forEach(w => {
        const s = this.add.sprite(w.x, w.y, 'tile-npc');
        s.setAlpha(0.8);
        s.setVisible(this.editorMode);
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
      (data.pickups || []).forEach(w => {
        const s = this.add.sprite(w.x, w.y, 'tile-item');
        s.setAlpha(0.8);
        s.setVisible(this.editorMode);
        s.data = new Phaser.Data.DataManager(s);
        if (w.itemId !== undefined) s.data.set('itemId', w.itemId);
        if (w.quantity !== undefined) s.data.set('quantity', w.quantity);
        this.pickups.add(s);
      });
      (data.voids || []).forEach(w => { this.voids.create(w.x, w.y, 'tile-void').refreshBody().setVisible(this.editorMode); });
      
      const colls = data.colliders || data.collider || [];
      colls.forEach(w => { 
        this.colliders.create(w.x, w.y, 'tile-collider').refreshBody().setVisible(this.editorMode); 
      });

      (data.storeTiles || []).forEach(w => {
        const sprite = this.add.image(w.x, w.y, 'store-tiles', w.frame || 'sprite1');
        sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
        sprite.setDepth(-10);
        this.storeTiles.add(sprite);
      });

      (data.furniture || []).forEach(w => {
        const sprite = this.storeFurniture.create(w.x, w.y, 'store-furniture', w.frame || 'sprite1');
        this._setupFurnitureSprite(sprite);
      });


      (data.storeTiles || []).forEach(w => {
        const sprite = this.add.image(w.x, w.y, 'store-tiles', w.frame || 'sprite1');
        sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
        sprite.setDepth(-10);
        this.storeTiles.add(sprite);
      });

      (data.furniture || []).forEach(w => {
        const sprite = this.storeFurniture.create(w.x, w.y, 'store-furniture', w.frame || 'sprite1');
        this._setupFurnitureSprite(sprite);
      });


      // Recalculate limits after all tiles are instantiated
      this.calculateMapLimits();
    } catch (e) {
      console.error('[MapEditor] Failed to load map config', e);
    }
  }

  resizeMap(width, height) {
    if (this.mapWidth === width && this.mapHeight === height) return;

    console.log(`[LobbyScene] Resizing map to ${width}x${height}`);
    this.mapWidth = width;
    this.mapHeight = height;

    // 1. Resize Physics World
    this.physics.world.setBounds(0, 0, width, height);

    // 2. Resize Camera Bounds
    this.cameras.main.setBounds(0, 0, width, height);

    // 3. Resize Background
    if (this.backgroundRect) {
      this.backgroundRect.setPosition(width / 2, height / 2);
      this.backgroundRect.setSize(width, height);
    }

    // 4. Redraw Grid — only if editor is currently active to avoid
    // expensive path draw calls every time the map resizes.
    if (this.gridGraphics && this.editorMode) {
      this._rebuildEditorGrid(width, height);
    }
    
    // Mark camera bounds as dirty so they recalculate once
    this._cameraBoundsDirty = true;
    // Recalculate inner bounds whenever map is resized
    this.calculateMapLimits();
  }

  calculateMapLimits() {
    let minX = this.mapWidth, maxX = 0, minY = this.mapHeight, maxY = 0;
    let found = false;

    // We check all non-void groups to find the "active" play area
    const groups = [
      this.floors, this.walls, this.forest, this.builds, 
      this.spawns, this.npcZones, this.pickups, this.colliders,
      this.storeTiles, this.storeFurniture
    ];

    groups.forEach(group => {
      if (!group) return;
      const children = group.getChildren ? group.getChildren() : [];
      children.forEach(child => {
        // Assume child center-based with GRID_SIZE=100
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
      // Fallback to full map dimensions if no tiles are found
      this.currentMapLimits = { minX: 0, maxX: this.mapWidth, minY: 0, maxY: this.mapHeight };
    } else {
      // Clamp to map dimensions and ensure a minimum size of 1 tile
      this.currentMapLimits = {
        minX: Math.max(0, Math.floor(minX)),
        maxX: Math.min(this.mapWidth, Math.ceil(maxX)),
        minY: Math.max(0, Math.floor(minY)),
        maxY: Math.min(this.mapHeight, Math.ceil(maxY))
      };
    }
    
    // Mark camera bounds dirty after limits recalculate
    this._cameraBoundsDirty = true;
  }

  updateCameraBounds() {
    // Use a dirty flag so setBounds is NOT called every frame (60fps).
    // It only recalculates when something actually changed (map resize / zoom).
    if (!this._cameraBoundsDirty) return;
    if (!this.player || !this.currentMapLimits) return;
    if (this.editorMode && this.editorMoveMode === 'camera') return;

    const { minX, maxX, minY, maxY } = this.currentMapLimits;
    
    let leftBound = minX;
    let rightBound = maxX;
    let topBound = minY;
    let bottomBound = maxY;

    const camZoom = this.cameras.main.zoom || 1;
    const camWidth = this.cameras.main.width / camZoom;
    const camHeight = this.cameras.main.height / camZoom;

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

    this.cameras.main.setBounds(
      leftBound,
      topBound,
      rightBound - leftBound,
      bottomBound - topBound
    );
    // Clear the flag — next frame will be a no-op
    this._cameraBoundsDirty = false;
  }

  loadServerMapConfig() {
    // Check URL params for specific map
    const sceneKey = this.currentMapKey || 'lobby';

    console.log(`[LobbyScene] Loading map config for: ${sceneKey}`);

    api.get('/maps/config', { params: { scene_key: sceneKey } })
      .then(response => {
        if (response.data) {
          console.log('[LobbyScene] Loaded map config from server', response.data);

          let config = {};
          try {
            config = response.data.walls_json ? JSON.parse(response.data.walls_json) : {};
          } catch { config = {}; }

          // Merge map_data if exists (priority for dimensions AND default spawn)
          if (response.data.map_data) {
            try {
              const md = typeof response.data.map_data === 'string' ? JSON.parse(response.data.map_data) : response.data.map_data;
              if (md.width) config.width = md.width;
              if (md.height) config.height = md.height;
              // Store default spawn so createMyPlayer() can use it (fallback chain)
              if (md.defaultSpawnX != null) this.mapDefaultSpawnX = Number(md.defaultSpawnX);
              if (md.defaultSpawnY != null) this.mapDefaultSpawnY = Number(md.defaultSpawnY);

              // Handle BGM
              if (md.bgmTrack && md.bgmTrack !== 'none') {
                this.playBGM(md.bgmTrack);
              } else {
                this.playBGM(null);
              }
            } catch (e) { console.error('Error parsing map_data', e); }
          } else {
            this.playBGM(null);
          }

          this.loadMapConfig(JSON.stringify(config));

          // Re-add collision with player if it exists (re-create after hot-reload)
          if (this.player) {
            if (this.walls) this.physics.add.collider(this.player, this.walls);
            if (this.forest) this.physics.add.collider(this.player, this.forest);
            if (this.builds) this.physics.add.collider(this.player, this.builds);
          }
        }
      })
      .catch(err => {
        if (err.response?.status === 404) {
          console.log('[LobbyScene] Map not found (new map?), clearing defaults.');
          this.clearMap();
        } else {
          console.warn('[LobbyScene] Failed to load map config from server:', err.message);
        }
        this.playBGM(null);
      })
      .finally(() => {
        // Create player AFTER map config is resolved so mapDefaultSpawnX/Y are set.
        this.isMapLoading = false;
        if (!this.player) {
          console.log(`[LobbyScene] Map config resolved. Creating self player at ${this.mapDefaultSpawnX || 'default'}, ${this.mapDefaultSpawnY || 'default'}`);
          this.createMyPlayer();
        }
        // Force a re-sync of other players now that bounds are correct
        this.handlePlayersUpdate(useGameStore.getState().players);

        // FINALLY: Notify React that the world is loaded and ready to be shown
        console.log('[LobbyScene] World fully loaded. Dispatching game-ready.');
        window.dispatchEvent(new Event('game-ready'));
      });
  }

  playBGM(trackId) {
    if (this.currentBgmTrackId === trackId) return; // Already playing this track

    // 1. Stop current BGM if exists
    if (this.currentBgm) {
      if (this.currentBgm.isPlaying) this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
    }

    this.currentBgmTrackId = trackId;

    if (!trackId || trackId === 'none') {
      return; // Done
    }

    // 2. Start new BGM
    const { musicVolume, masterVolume } = useAudioStore.getState();
    this.sound.volume = masterVolume;
    this.sound.mute = (masterVolume === 0 || musicVolume === 0);

    if (this.cache.audio.exists(trackId)) {
      this.currentBgm = this.sound.add(trackId, {
        loop: true,
        volume: musicVolume
      });
      this.currentBgm.setLoop(true);
      this.currentBgm.play();
    } else {
      console.warn(`[LobbyScene] Audio track '${trackId}' not found in cache.`);
    }
  }

  createMyPlayer() {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;
    this.myPlayerId = String(user.id);

    // Spawn point priority:
    //  1. initData (portal teleport with explicit coords)
    //  2. URL params spawnX/spawnY
    //  3. Map-level defaultSpawn (stored when loadMapConfig reads map_data)
    //  4. Hardcoded scene fallback
    const urlParams = new URLSearchParams(window.location.search);
    let startX = this.initData?.spawnX != null ? Number(this.initData.spawnX) : (urlParams.get('spawnX') ? Number(urlParams.get('spawnX')) : null);
    let startY = this.initData?.spawnY != null ? Number(this.initData.spawnY) : (urlParams.get('spawnY') ? Number(urlParams.get('spawnY')) : null);

    // Fall back to map default spawn (set by loadMapConfig from map_data.defaultSpawnX/Y)
    if (startX == null || startY == null || isNaN(startX) || isNaN(startY)) {
      startX = this.mapDefaultSpawnX ?? 1000;
      startY = this.mapDefaultSpawnY ?? 350;
    }

    // Reject spawn if it lands on a void tile or any static collider body
    const GRID = this.GRID_SIZE;
    const snapToGrid = (v) => Math.floor(v / GRID) * GRID + GRID / 2;
    const isBlockedAt = (sx, sy) => {
      const gx = snapToGrid(sx);
      const gy = snapToGrid(sy);
      // Check void tiles
      if (this.voids?.getChildren().some(v => Math.abs(v.x - gx) < GRID / 2 && Math.abs(v.y - gy) < GRID / 2)) return true;
      // Check wall tiles
      if (this.walls?.getChildren().some(v => Math.abs(v.x - gx) < GRID / 2 && Math.abs(v.y - gy) < GRID / 2)) return true;
      // Check collider tiles
      if (this.colliders?.getChildren().some(v => Math.abs(v.x - gx) < GRID / 2 && Math.abs(v.y - gy) < GRID / 2)) return true;
      return false;
    };
    if (isBlockedAt(startX, startY)) {
      console.warn('[LobbyScene] Spawn coords land on a blocked tile — falling back to map default or center');
      startX = this.mapDefaultSpawnX ?? Math.floor(this.mapWidth / 2);
      startY = this.mapDefaultSpawnY ?? Math.floor(this.mapHeight / 2);
      // If that's also blocked, just nudge diagonally by one grid cell
      if (isBlockedAt(startX, startY)) { startX += GRID; startY += GRID; }
    }

    // Create PlayerSprite instance
    this.player = new PlayerSprite(
      this,
      startX,
      startY,
      user?.character_id || '1',
      undefined, // Start with default frame from Atlas
      user?.username || 'Guest',
      true
    );

    console.log(`[LobbyScene] Created self PlayerSprite (ID: ${this.myPlayerId}) at (${startX}, ${startY})`);
    this.add.existing(this.player);

    // B4 FIX: Snap camera to player position IMMEDIATELY on spawn 
    // to prevent the "slow slide-in" from (0,0) caused by camera lerp.
    this.cameras.main.centerOn(startX, startY);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Add collision with walls and forest
    if (this.walls) {
      this.physics.add.collider(this.player, this.walls);
    }
    if (this.forest) {
      this.physics.add.collider(this.player, this.forest);
    }
    if (this.builds) {
      this.physics.add.collider(this.player, this.builds);
    }
    if (this.voids) {
      this.physics.add.collider(this.player, this.voids);
    }
    if (this.colliders) {
      this.physics.add.collider(this.player, this.colliders);
    }
    if (this.storeFurniture) {
      this.physics.add.collider(this.player, this.storeFurniture);
    }

    const cls = user?.characterClass || this.getRandomClass();

    // Camera follow (Round pixels = true, lerp = 0.1 for smooth)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Initial network sync: Broadcast our exact starting position immediately
    console.log(`[LobbyScene] Broadcasting initial spawn position: (${startX}, ${startY})`);
    useGameStore.getState().movePlayer(startX, startY, 'right', 'idle');
  }

  getRandomClass() {
    const classes = ['warrior', 'mage', 'archer'];
    return classes[Math.floor(Math.random() * classes.length)];
  }

  handlePlayersUpdate(players) {
    if (!players || this.isMapLoading) return;

    // Ensure myPlayerId is set, always as a string
    const currentUser = useAuthStore.getState().user;
    if (!this.myPlayerId && currentUser?.id) {
      this.myPlayerId = String(currentUser.id);
    }
    const myIdStr = this.myPlayerId ? String(this.myPlayerId) : null;
    const currentUserIdStr = currentUser?.id ? String(currentUser.id) : null;

    // CRITICAL FIX: Ensure NO sprite exists for the current user in the 'remote' characters map.
    // This handles cases where login state might have been delayed or changed.
    if (myIdStr && this.playerSprites.has(myIdStr)) {
      console.log(`[LobbyScene] Cleaning up accidental duplicate of self (${myIdStr})`);
      this.removeOtherPlayer(myIdStr);
    }
    if (currentUserIdStr && currentUserIdStr !== myIdStr && this.playerSprites.has(currentUserIdStr)) {
      this.removeOtherPlayer(currentUserIdStr);
    }

    // Add new / update existing remote players
    players.forEach((player, id) => {
      const strId = String(id);

      // CANVAS-LEVEL guard: never create a sprite for ourselves
      const isMe = (myIdStr && strId === myIdStr) || (currentUserIdStr && strId === currentUserIdStr);
      if (isMe) {
          // REMOVED: self-teleport logic that fighting with local physics body position
          return;
      }

      if (!this.playerSprites.has(strId)) {
        console.log(`[LobbyScene] Found new player in store: ${strId} (${player.username}). Creating sprite...`);
        this.addOtherPlayer(strId, player);
      } else {
        this.updateOtherPlayer(strId, player);
      }
    });

    // Remove disconnected players — any sprite in the map that is no longer in the store
    this.playerSprites.forEach((sprite, id) => {
      if (!players.has(id)) {
        console.log("[LobbyScene] Removing sprite for:", id);
        this.removeOtherPlayer(id);
      }
    });
  }

  addOtherPlayer(id, player) {
    let x = Number(player.x);
    let y = Number(player.y);

    if (isNaN(x)) x = 1000;
    if (isNaN(y)) y = 350;

    console.log(`[LobbyScene] Adding remote player sprite: ${player.username} (ID: ${id}) at (${x}, ${y})`);

    const newPlayer = new PlayerSprite(
      this,
      x,
      y,
      player.character_id || '1', // Use dynamic ID from player data, default to '1'
      undefined,
      player.username || 'Unknown',
      false
    );

    this.add.existing(newPlayer);

    // Store in map
    this.playerSprites.set(id, newPlayer);
  }

  updateOtherPlayer(id, player) {
    const sprite = this.playerSprites.get(id); // This is now a PlayerSprite instance
    if (sprite) {
      // console.log(`[LobbyScene] Updating player ${id}:`, player);

      if (typeof player.x !== 'number' || typeof player.y !== 'number' || isNaN(player.x) || isNaN(player.y)) {
        return;
      }

      // Check if target has changed significantly
      if (sprite.targetX === player.x && sprite.targetY === player.y) {
        return;
      }

      sprite.targetX = player.x;
      sprite.targetY = player.y;

      if (sprite.alpha < 0.1 || !sprite.visible) {
          sprite.setAlpha(1);
          sprite.setVisible(true);
      }

      // Calculate velocity for animation
      const dx = player.x - sprite.x;
      const dy = player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Update animation state: 
      // Robust Animation Logic: Only use 'idle' if we are actually close to the target.
      // Reduced threshold from 10 to 2 for better accuracy.
      if (player.anim === 'walk' || dist > 2) {
          sprite.playAnimation('walk');
      } else {
          sprite.playAnimation('idle');
      }

      // Apply direction (flip) received from network
      if (player.direction === 'left') {
        sprite.sprite.setFlipX(true);
      } else if (player.direction === 'right') {
        sprite.sprite.setFlipX(false);
      }

      // Check if character_id has changed
      if (player.character_id && sprite.characterId !== player.character_id) {
          console.log(`[LobbyScene] Player ${id} changed character to ${player.character_id}. Updating sprite...`);
          sprite.characterId = player.character_id;
          sprite.updateSpriteTexture(player.character_id);
      }

      // Adaptive Timing: Calculate duration based on the actual time between packets
      let duration = 150; // Default fallback
      const pTime = Number(player.timestamp);
      const sTime = Number(sprite.lastTimestamp);

      if (!isNaN(pTime) && !isNaN(sTime)) {
          duration = pTime - sTime;
          // Clamp duration to avoid weird jumps (min 50ms for performance, max 500ms for responsiveness)
          duration = Math.max(50, Math.min(500, duration));
      }
      
      // Safety Backstop: If duration is STILL NaN, use fallback
      if (isNaN(duration)) {
          duration = 150;
      }
      sprite.lastTimestamp = !isNaN(pTime) ? pTime : Date.now();

      // Panic Recovery: If sprite position has somehow become NaN, teleport immediately
      if (isNaN(sprite.x) || isNaN(sprite.y)) {
          console.error(`[LobbyScene] Player ${sprite.username} had NaN position! Recovering to (${player.x}, ${player.y})`);
          sprite.setPosition(player.x, player.y);
          this.tweens.killTweensOf(sprite);
          return;
      }

      // Distance check for teleport vs tween
      if (dist > 300) {
        // Teleport if too far
        console.log(`[LobbyScene] Teleporting player ${id} to (${player.x}, ${player.y}) - Distance: ${dist.toFixed(2)}`);
        sprite.setPosition(player.x, player.y);
        this.tweens.killTweensOf(sprite); // Stop any existing tweens
      } else {
        // Interpolation
        this.tweens.killTweensOf(sprite);

        this.tweens.add({
          targets: sprite,
          x: player.x,
          y: player.y,
          duration: duration,
          onComplete: () => {
              // Once target is reached, if the network says idle, ensure we stop walking
              if (player.anim === 'idle') {
                  sprite.playAnimation('idle');
              }
          }
        });
      }
    } else {
      // console.warn(`[LobbyScene] updateOtherPlayer called for missing sprite: ${id}`);
    }
  }

  removeOtherPlayer(id) {
    const sprite = this.playerSprites.get(id);
    if (sprite) {
      console.log(`[LobbyScene] Removing player sprite: ${sprite.username} (ID: ${id})`);
      sprite.destroy();
      this.playerSprites.delete(id);
    }
  }

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
    // Buscamos tanto en zonas estáticas como en las recién pintadas (editorTiles)
    const gridSize = this.GRID_SIZE;
    const hideMarkersAt = (tx, ty) => {
        if (this.npcZones) {
            this.npcZones.getChildren().forEach(zone => {
                if (Math.abs(zone.x - tx) < 5 && Math.abs(zone.y - ty) < 5) zone.setVisible(false);
            });
        }
        if (this.editorTiles) {
            this.editorTiles.forEach(tile => {
                if (tile._tileType === 'npc' && Math.abs(tile.x - tx) < gridSize && Math.abs(tile.y - ty) < gridSize) {
                    tile.setVisible(false);
                }
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
        container.body.setCircle(20, -20, -20); // Collision circle
    }
    this.npcs.push(container);
    this.npcSprites.set(tmpl.id, container);
  }

  handleMissionUpdate(mission) {
    if (!this.npcs) return;

    this.npcs.forEach(npcContainer => {
      const npcId = npcContainer.npcData.templateId;
      const status = this.getNpcMissionStatus(npcId, mission);
      this.updateNpcIndicator(npcContainer, status);
    });
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

    // Update NPCs
    this.updateNPCs(time, delta);

    // Force camera follow every frame to fix teleport lag/desync - MOVED TO createMyPlayer
    // this.cameras.main.startFollow(this.player, true, 1, 1);

    // Periodic Sync (every 1 second) to ensure Store and Scene match
    if (time - this.lastSyncUpdate > 1000) {
      const storePlayers = useGameStore.getState().players;
      // Proactively reconcile sprites without assuming 'self' is always in the store initially
      this.handlePlayersUpdate(storePlayers);
      this.lastSyncUpdate = time;
    }

    // [PERF] Watchdog eliminated — was logging every 60 frames causing GC pressure.


    // ─── Editor movement modes ───────────────────────────────────────────────
    if (this.editorMode) {
      if (this.editorMoveMode === 'camera') {
        // CAMERA PAN: WASD/Arrows scroll the viewport freely
        if (!this.isTyping()) {
          const panSpeed = 20; // Increased speed from 10 to 20 for smoother navigation in large maps
          const cam = this.cameras.main;
          const left = this.cursors.left.isDown || this.wasd.left.isDown;
          const right = this.cursors.right.isDown || this.wasd.right.isDown;
          const up = this.cursors.up.isDown || this.wasd.up.isDown;
          const down = this.cursors.down.isDown || this.wasd.down.isDown;
          if (left) cam.scrollX -= panSpeed;
          else if (right) cam.scrollX += panSpeed;
          if (up) cam.scrollY -= panSpeed;
          else if (down) cam.scrollY += panSpeed;
        }
        return; // Skip all player physics & network sync in camera mode
      }
      // CHARACTER MODE: fall through to normal player movement below
      // (editing tools still work — the pointer events are separate)
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
    const anim = isMoving ? 'walk' : 'idle';

    // Network Update: throttled at ~15 FPS while moving
    if (isMoving) {
      if (time - this.lastNetworkUpdate > 60) {
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, 'walk');
        this.lastNetworkUpdate = time;
      }
    } else {
      // Send a final 'idle' update when the player just stopped
      if (!this._wasPreviouslyMoving) {
        // already idle – do nothing
      } else {
        // Transitioned from moving -> idle: broadcast stop immediately
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, 'idle');
        this.lastNetworkUpdate = time;
      }

      // Also handle rubber-banding / teleport sync
      if (!this.lastSyncedPos) {
        this.lastSyncedPos = { x: this.player.x, y: this.player.y };
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lastSyncedPos.x, this.lastSyncedPos.y);
      if (dist > 50) {
        useGameStore.getState().movePlayer(this.player.x, this.player.y, direction, 'idle');
        this.lastSyncedPos = { x: this.player.x, y: this.player.y };
        this.lastNetworkUpdate = time;
      }
    }
    this._wasPreviouslyMoving = isMoving;

    // Optional: keep name tag always visible or adjusting?
    // It is a child of the player container now, so it moves with it automatically.

    if (!this.isTyping()) {
      this.checkInteractions();
    }

    // Continuously calculate and enforce X-axis bounds based on Void walls
    this.updateCameraBounds();
  }

  updateNPCs(time, delta) {
    if (!this.npcs) return;

    this.npcs.forEach(npc => {
        // Enforce depth sorting (Feet at container.y)
        npc.setDepth(npc.y + 1);

        const data = npc.npcData;
        if (!data || data.movementType === 'static' || data.isTalking) {
            if (npc.body) npc.body.setVelocity(0);
            // Ensure child PlayerSprite is idle
            const sprite = npc.list.find(item => item instanceof PlayerSprite);
            if (sprite) sprite.playAnimation('idle');
            return;
        }

        if (data.movementType === 'wander') {
            const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, data.targetX, data.targetY);
            const sprite = npc.list.find(item => item instanceof PlayerSprite);

            if (distToTarget < 5) {
                // We reached the target
                if (npc.body) npc.body.setVelocity(0);
                if (sprite) sprite.playAnimation('idle');

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
                    sprite.playAnimation('walk');
                    // Flip sprite based on velocity
                    if (npc.body.velocity.x < 0) sprite.sprite.setFlipX(true);
                    else if (npc.body.velocity.x > 0) sprite.sprite.setFlipX(false);
                }
            }
        }
    });
  }

  // DELETED DUPLICATE shutdown() here to consolidate at end of file

  processSyncInteractions() {
    if (!this._readyInteractions) return;
    const { found, foundChallenge, foundPlayer, foundBuild, foundPickup } = this._readyInteractions;

    if (found) {
      this.triggerInteraction(found.npcData);
    } else if (foundChallenge) {
      const activeChallengeId = useGameStore.getState().activeChallengeId;
      const challengeId = foundChallenge.challengeData.id;

      if (activeChallengeId === challengeId) {
        useGameStore.getState().leaveChallenge();
      } else {
        useGameStore.getState().joinChallenge(challengeId);
        window.dispatchEvent(new CustomEvent('lobby-open-challenge', { detail: { challengeId } }));
      }
    } else if (foundPlayer) {
      useGameStore.getState().sendChatRequest(foundPlayer.id);
      console.log(`[LobbyScene] Sent chat request to ${foundPlayer.id}`);
    } else if (foundBuild) {
      const portalType = foundBuild.data?.get('portalType') || 'map';
      const targetMap = foundBuild.data?.get('targetMap');
      const targetRoute = foundBuild.data?.get('targetRoute');
      const targetX = foundBuild.data?.get('targetX');
      const targetY = foundBuild.data?.get('targetY');

      console.log('[LobbyScene] Portal Interaction detected:', { portalType, targetMap, targetRoute, targetX, targetY });

      if (portalType === 'local') {
        // Local Teleport
        if (targetX != null && targetY != null) {
          console.log(`[LobbyScene] Teleporting locally to: ${targetX}, ${targetY}`);
          this.player.setPosition(Number(targetX), Number(targetY));

          // Snap camera immediately — no lerp lag
          this.cameras.main.centerOn(this.player.x, this.player.y);

          // Force immediate network sync
          useGameStore.getState().movePlayer(this.player.x, this.player.y);
          this.lastSyncedPos = { x: this.player.x, y: this.player.y };

          // Visual feedback
          this.cameras.main.flash(200, 0, 0, 0);
        } else {
          console.warn('[LobbyScene] Local teleport failed: missing targetX/targetY');
        }
      } else if (portalType === 'route') {
        // Open Web Route / Popup
        if (!targetRoute || String(targetRoute).trim() === '') {
          console.warn('[LobbyScene] Build has no valid targetRoute configured');
        } else {
          console.log(`[LobbyScene] Opening route modal to: ${targetRoute}`);
          window.dispatchEvent(new CustomEvent('lobby-open-route', {
            detail: { route: targetRoute }
          }));
        }
      } else {
        // Map Switch
        if (!targetMap || String(targetMap).trim() === '') {
          console.warn('[LobbyScene] Build has no valid targetMap configured');
        } else {
          console.log(`[LobbyScene] Entering portal to: ${targetMap}`);

          // Check if map is public or needs a code
          this._handleMapEntry(targetMap, targetX, targetY);
        }
      }
    } else if (foundPickup) {
      this.handlePickupItem(foundPickup);
    }
  }

  async handlePickupItem(pickupContainer) {
    const pickup = pickupContainer.pickupData;
    if (!pickup || !pickup.id) {
        console.warn('[LobbyScene] Interaction attempted with an object that has no pickup ID (Editor Marker?).');
        return;
    }
    
    try {
      console.log(`[LobbyScene] Picking up item: ${pickup.item?.name || 'Unknown Item'}`);
      const response = await api.post(`/inventory/pickup/${pickup.id}`);
      
      if (response.data) {
        // Success! Remove from scene
        this.activePickups = this.activePickups.filter(p => p !== pickupContainer);
        
        // Tween effect before destroying
        this.tweens.add({
          targets: pickupContainer,
          y: pickupContainer.y - 50,
          alpha: 0,
          scale: 1.5,
          duration: 500,
          onComplete: () => pickupContainer.destroy()
        });

        // Show toast or message
        const itemName = pickup.item?.name || 'Objeto';
        window.dispatchEvent(new CustomEvent('player-message', { detail: { text: `Recogiste ${itemName} x${pickup.quantity}` } }));

        // Update React Inventory State in HUD
        useGameStore.getState().fetchInventory();
      }
    } catch (err) {
      console.error('[LobbyScene] Failed to pickup item:', err);
      // Special handling for 404 (ID stale or item moved/stolen)
      if (err.response?.status === 404) {
          console.warn('[LobbyScene] Pickup ID not found on server. Removing stale item from scene.');
          this.activePickups = this.activePickups.filter(p => p !== pickupContainer);
          pickupContainer.destroy();
          // Optionally trigger a re-fetch of pickups
          // this.loadMapPickups();
      }
    }
  }

  checkInteractions() {
    let found = null;
    let foundChallenge = null;
    let foundPlayer = null;

    // Check NPCs
    this.npcs.forEach(npc => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        npc.x, npc.y
      );

      if (dist < 80) { // Interaction radius
        found = npc;
      }
    });

    if (!found) {
      this.challengePoints.forEach((point) => {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          point.x, point.y
        );

        if (dist < 90) {
          foundChallenge = point;
        }
      });
    }

    // Check Players (only if no NPC is found)
    if (!found && !foundChallenge) {
      for (const [id, sprite] of this.playerSprites) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          sprite.x, sprite.y // accessing container x/y
        );

        if (dist < 80) {
          foundPlayer = { id, name: sprite.username };
          break; // Just one at a time for simplicity
        }
      }
    }

    // Update Chat Bubbles positions
    if (this.player && this.player.chatBubble) {
      this.player.chatBubble.setPosition(this.player.x, this.player.y - 60);
    }
    this.playerSprites.forEach((sprite) => {
      if (sprite.chatBubble) {
        sprite.chatBubble.setPosition(sprite.x, sprite.y - 60);
      }
    });

    let foundBuild = null;
    if (this.builds) {
      this.builds.getChildren().forEach(build => {
        // Reference point: bottom-center of the building (where the door is)
        // build.y is the sprite center; add half the display height to get the base
        const doorX = build.x;
        const doorY = build.y + build.displayHeight * 0.45;

        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y, doorX, doorY
        );

        if (this._interactPressed) {
          const type = build.data?.get('portalType') || 'unknown';
          console.log(`[LobbyScene] Checking build (Type: ${type}) at ${build.x.toFixed(0)},${build.y.toFixed(0)} | Door ${doorX.toFixed(0)},${doorY.toFixed(0)} | Dist: ${dist.toFixed(0)} | Range: 90`);
        }

        // Tight radius around the door — same as player detection (90 px)
        if (dist < 90 && !foundBuild) {
          foundBuild = build;
        }
      });
    }

    // Check Pickups
    let foundPickup = null;
    if (this.activePickups) {
      this.activePickups.forEach(p => {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
        if (dist < 60 && !foundPickup) {
          foundPickup = p;
        }
      });
    }

    this.nearbyNPC = found;
    this.nearbyPickup = foundPickup;

    // Save state for synchronous interaction processing
    this._readyInteractions = { found, foundChallenge, foundPlayer, foundBuild, foundPickup };

    // Update Interaction Prompt
    if (found || foundChallenge || foundPlayer || foundBuild || foundPickup) {
      const t = (key, opts) => i18n.t(`lobby.interactions.${key}`, opts);
      let msg = t('press_e');

      if (found) {
        msg = t('talk_to', { name: found.npcData.name });
      } else if (foundPickup) {
        msg = t('pickup', { 
          name: foundPickup.pickupData.item.name, 
          qty: foundPickup.pickupData.quantity 
        });
      } else if (foundChallenge) {
        const isJoined = useGameStore.getState().activeChallengeId === foundChallenge.challengeData.id;
        msg = isJoined ? t('leave_challenge') : t('join_challenge', { name: foundChallenge.challengeData.name });
      } else if (foundPlayer) {
        msg = t('chat_with', { name: foundPlayer.name });
      } else if (foundBuild) {
        const portalType = foundBuild.data?.get('portalType') || 'map';
        const targetMap = foundBuild.data?.get('targetMap');
        const targetRoute = foundBuild.data?.get('targetRoute');
        const targetX = foundBuild.data?.get('targetX');
        const targetY = foundBuild.data?.get('targetY');
        const customText = foundBuild.data?.get('interactionText');

        const hasDest = (portalType === 'map' && targetMap) ||
          (portalType === 'route' && targetRoute) ||
          (portalType === 'local' && targetX != null && targetY != null);

        if (hasDest) {
          msg = customText ? t('press_e_custom', { text: customText }) : t('enter');
        } else {
          msg = t('no_destination');
        }
      }

      // Position prompt near player or fixed on screen
      const cam = this.cameras.main;
      this.interactionPrompt.setPosition(cam.width / 2, cam.height - 100);
      this.interactionPrompt.setText(msg);
      this.interactionPrompt.setVisible(true);
    } else {
      this.interactionPrompt.setVisible(false);
    }

    // Read and reset the native E-key flag
    const pressed = this._interactPressed;
    if (pressed) {
      console.log(`[LobbyScene] Interact key pressed at ${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)}`);
      // It is already processed synchronously inside the native keydown event handler!
      // (This flag check block remains as legacy fallback if needed)
    }
    this._interactPressed = false;
  }

  /**
   * Handles entering a portal that leads to another map.
   * Fetches map metadata to determine public/private access, shows
   * a PIN prompt for private maps, then emits 'lobby-change-map' so
   * LobbyGameCanvas can manage the WebSocket + Phaser scene transition
   * (which also preserves targetX/targetY via pendingTransitionRef).
   */
  async _handleMapEntry(targetMap, targetX, targetY) {
    try {
      // Bug 5 fix: use the correct single-map endpoint
      const response = await api.get('/maps/config', { params: { scene_key: targetMap } });
      const mapCfg = response.data; // Now a single object, not an array

      let pin = '';
      if (mapCfg && !mapCfg.is_public) {
        // PRIVATE MAP — ask if user has a PIN or wants to create a new private session
        const hasPIN = window.confirm(
          `El mapa "${targetMap}" es PRIVADO.\n\n` +
          `¿Tienes un PIN de acceso?\n` +
          `(Cancelar = crear nueva sala privada)`
        );
        if (hasPIN) {
          const entered = window.prompt('Introduce el PIN de 4 dígitos:');
          if (entered === null) return; // User cancelled dialog
          pin = entered.trim();
        }
        // If hasPIN === false, pin stays '' → server creates a new private room + generates PIN
      }

      // Bug 1 fix: emit event so LobbyGameCanvas fills pendingTransitionRef
      // with (targetMap, targetX, targetY) BEFORE calling requestMapJoin
      window.dispatchEvent(new CustomEvent('lobby-change-map', {
        detail: {
          targetMap,
          targetX,
          targetY,
          pin, // passed along so handleChangeMap can forward it
        },
      }));

    } catch (error) {
      // 404 = map not yet in DB (new map) → treat as public
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
    
    // Clean up window listeners
    if (this._onInteractKeyDown) {
      window.removeEventListener('keydown', this._onInteractKeyDown);
      this._onInteractKeyDown = null;
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
    if (this.onEditorEvent) {
      window.removeEventListener('editor-command', this.onEditorEvent);
      this.onEditorEvent = null;
    }

    // Clean up BGM 
    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm = null;
    }

    // Clear sprites
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

  triggerInteraction(data) {
    console.log('[LobbyScene] Emitiendo evento lobby-interaction con data:', data);
    // Emit event to React
    const event = new CustomEvent('lobby-interaction', { detail: data });
    window.dispatchEvent(event);
  }
}

