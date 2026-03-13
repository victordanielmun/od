import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useAudioStore } from '../../store/audioStore';
import { PlayerSprite } from '../entities/PlayerSprite';
import { loadCharacterSprites, createCharacterAnimations } from '../config/CharacterConfig';
import api from '../../services/api';

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
    this.zoom = 1.2;
    this.zoomMin = 0.6;
    this.zoomMax = 1.5;
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
    this.editorBuildScale = 2; // default 2× (range 1–2.5)
    // Default metadata for newly-placed builds — must match the UI's default (portalType: 'map')
    this.editorBuildMetadata = { portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' };

    // Data passed via scene.restart({ map, spawnX, spawnY })
    this.initData = null;
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

    // Generate tile textures for each type
    const tileTypes = [
      { key: 'tile-wall', fill: 0x666666, stroke: 0x444444, label: 'W' },
      { key: 'tile-floor', fill: 0x8B7355, stroke: 0x6B5335, label: 'F' },
      { key: 'tile-spawn', fill: 0x00CC66, stroke: 0x009944, label: 'S' },
      { key: 'tile-npc', fill: 0x4488FF, stroke: 0x2266DD, label: 'N' },
      // Void: #2596be, stroke same as fill so no visible border
      { key: 'tile-void', fill: 0x2596be, stroke: 0x2596be, label: 'V' },
    ];

    tileTypes.forEach(({ key, fill, stroke }) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(fill);
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

    // Load Terrain Atlas
    this.load.atlas('terrain', '/terrain/terrain-spritesheet.png', '/terrain/terrain-sprites.json');
    // Load Forest Atlas
    this.load.atlas('forest', '/forest/forest-spritesheet.png', '/forest/forest-sprites.json');
    // Load Builds Atlas
    this.load.atlas('builds', '/builds/build-spritesheet.png', '/builds/build-sprites.json');
    // Load Wall Atlas (from user request)
    this.load.atlas('walls', '/wall/wall-spritesheet.png', '/wall/wall-sprites.json');

    // Load Audio (BGM)
    this.load.audio('bgm_pixelated_prelude', '/music/Pixelated_Prelude.mp3');
    this.load.audio('bgm_serene_village', '/music/Serene_Village.mp3');
    this.load.audio('bgm_whispering_woods', '/music/Whispering_Woods.mp3');
    this.load.audio('bgm_whispering_woods_past', '/music/Whispering_Woods_of_Pixel_Past.mp3');
    this.load.audio('bgm_whispers_glitch', '/music/Whispers_in_the_Glitch_Garden.mp3');
    this.load.audio('bgm_cave1', '/music/cave1.mp3');
    this.load.audio('bgm_fight_level', '/music/FightLevel.mp3');
    this.load.audio('bgm_fight_boss', '/music/FightBoss.mp3');
    this.load.audio('bgm_pixel_pantry', '/music/Pixel_Pantry_Jingle.mp3');
    this.load.audio('bgm_pixelated_haven', '/music/Pixelated_Haven.mp3');
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
    this.loadServerMapConfig();

    // 3. NPCs (Only in Lobby)
    // if (this.currentMapKey === 'lobby') {
    //   this.createNPCs();
    //   this.createChallengePoints();
    // }

    // 4. Other Players
    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe(
      (state) => state.players,
      (players) => this.handlePlayersUpdate(players)
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
    this.events.once('shutdown', this.shutdown, this);
    this.events.once('destroy', () => {
        window.removeEventListener('keydown', this._onInteractKeyDown);
        window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
        window.removeEventListener('chat-message-received', this.onChatMsg);
        window.removeEventListener('player-emoji-received', this.onEmojiMsg);
    });

    // Ensure playerSprites is fresh if restarting
    this.playerSprites.clear();

    // Interaction Prompt Text
    this.interactionPrompt = this.add.text(0, 0, '', {
      fontSize: '18px',
      fill: '#FFE600',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000099',
      padding: { x: 14, y: 8 },
      align: 'center'
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(1000); // Super high z-index
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

    // Listen for emojis
    this.onEmojiMsg = (e) => this._onEmojiReceived(e);
    window.addEventListener('player-emoji-received', this.onEmojiMsg);

    // Notify React that the scene is ready (hides loading screen)
    window.dispatchEvent(new Event('game-ready'));
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

  _paintTile(gx, gy) {
    if (!this.editorTiles) this.editorTiles = new Map();
    const key = `${gx}_${gy}`;

    if (this.editorTool === 'eraser') {
      if (this.editorTiles.has(key)) {
        this.editorTiles.get(key).destroy();
        this.editorTiles.delete(key);
      }
      return;
    }

    if (this.editorTiles.has(key)) this.editorTiles.get(key).destroy();

    let sprite;
    if (this.editorTileType === 'forest' || this.editorTileType === 'build') {
      const atlas = this.editorTileType === 'forest' ? 'forest' : 'builds';
      sprite = this.add.image(gx + this.GRID_SIZE / 2, gy + this.GRID_SIZE / 2, atlas, this.editorTextureFrame);
      sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
    } else {
      const textureKey = `tile-${this.editorTileType}`;
      sprite = this.add.image(gx, gy, textureKey).setOrigin(0);
    }
    sprite.setDepth(gy + 1);
    sprite._tileType = this.editorTileType;
    sprite._gridX = gx;
    sprite._gridY = gy;
    this.editorTiles.set(key, sprite);
    this.editorHistory.push(key);
  }

  _handleEditorCommand({ action, value }) {
    switch (action) {
      case 'setTool': this.editorTool = value; break;
      case 'setTileType': this.editorTileType = value; break;
      case 'setTexture': this.editorTextureFrame = value; break;
      case 'undo':
        if (this.editorHistory.length > 0) {
          const last = this.editorHistory.pop();
          if (this.editorTiles && this.editorTiles.has(last)) {
            this.editorTiles.get(last).destroy();
            this.editorTiles.delete(last);
          }
        }
        break;
      default: break;
    }
  }

  createAnimations() {
    createCharacterAnimations(this);
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
    this.configureCamera();
  }

  configureCamera(gameSize) {
    const cam = this.cameras?.main;
    if (!cam || !this.player) return;

    const width = Number(gameSize?.width ?? this.scale?.width ?? cam.width);
    const height = Number(gameSize?.height ?? this.scale?.height ?? cam.height);

    if (Number.isFinite(width) && Number.isFinite(height)) {
      const viewHalfW = (width / cam.zoom) / 2;
      const viewHalfH = (height / cam.zoom) / 2;
      cam.setBounds(-viewHalfW, -viewHalfH, this.mapWidth + viewHalfW * 2, this.mapHeight + viewHalfH * 2);
      if (this.backgroundRect) {
        this.backgroundRect.width = this.mapWidth + viewHalfW * 2;
        this.backgroundRect.height = this.mapHeight + viewHalfH * 2;
      }
    }

    cam.setFollowOffset(0, 0);
    cam.setDeadzone();
    cam.startFollow(this.player, true, 1, 1);
    cam.centerOn(this.player.x, this.player.y);
  }

  createMap() {
    const G = this.GRID_SIZE;

    // Background
    this.backgroundRect = this.add.rectangle(
      this.mapWidth / 2, this.mapHeight / 2,
      this.mapWidth, this.mapHeight, 0x2a2a2a
    );

    // Base grid lines
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0x333333, 0.5);
    for (let x = 0; x <= this.mapWidth; x += G) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, this.mapHeight);
    }
    for (let y = 0; y <= this.mapHeight; y += G) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(this.mapWidth, y);
    }
    this.gridGraphics.strokePath();

    // Physics bounds
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // Tile groups — each type has its own static group
    this.walls = this.physics.add.staticGroup();
    this.floors = this.add.group();           // visual only (no physics)
    this.forest = this.physics.add.staticGroup(); // Collidable trees/bushes
    this.builds = this.physics.add.staticGroup(); // Portal structures
    this.spawns = this.add.group();           // visual markers
    this.npcZones = this.add.group();          // visual markers
    this.voids = this.physics.add.staticGroup(); // Solid void blocks

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
        this._editorPlaceOrErase(gx, gy);
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
        case 'setMoveMode': this.setEditorMoveMode(value); break;
        case 'undo': this.undo(); break;
        case 'redo': this.redo(); break;
        case 'clearAll': this.clearAllTiles(); break;
        case 'applyBuildMetadata': this.applyBuildMetadataToAll(); break;
      }
    };
    window.addEventListener('editor-command', this.onEditorEvent);
  }

  applyBuildMetadataToAll() {
    if (!this.editorBuildMetadata) return;
    const { targetMap, targetX, targetY, targetRoute, interactionText } = this.editorBuildMetadata;
    let count = 0;
    this.builds?.getChildren().forEach(s => {
      if (targetMap !== undefined) s.data.set('targetMap', targetMap);
      if (targetRoute !== undefined) s.data.set('targetRoute', targetRoute);
      if (this.editorBuildMetadata.portalType !== undefined) s.data.set('portalType', this.editorBuildMetadata.portalType);
      if (targetX !== undefined) s.data.set('targetX', targetX);
      if (targetY !== undefined) s.data.set('targetY', targetY);
      if (interactionText !== undefined) s.data.set('interactionText', interactionText);
      count++;
    });
    console.log(`[LobbyScene] Applied metadata to ${count} builds`);
    // Visual feedback
    this.cameras.main.flash(200, 0, 255, 0);
  }

  // ===== Editor: Tile placement / erasure =====

  _getTextureForType(type) {
    const map = { wall: 'tile-wall', floor: 'tile-floor', spawn: 'tile-spawn', npc: 'tile-npc', forest: 'forest', build: 'builds' };
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
      case 'void': return this.voids;
      default: return this.walls;
    }
  }

  _findTileAt(gx, gy, targetType = null) {
    // Search all groups for a tile at the given grid position
    const groups = [this.walls, this.floors, this.forest, this.builds, this.spawns, this.npcZones, this.voids];
    const types = ['wall', 'floor', 'forest', 'build', 'spawn', 'npc', 'void'];
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      if (targetType && types[i] !== targetType) continue; // Filter if targetType provided
      const children = groups[i].getChildren();
      const found = children.find(t => Math.abs(t.x - gx) < 1 && Math.abs(t.y - gy) < 1);
      if (found) return { tile: found, type: types[i], group: groups[i] };
    }
    return null;
  }

  _findAllTilesAt(gx, gy) {
    const groups = [this.walls, this.floors, this.forest, this.builds, this.spawns, this.npcZones, this.voids];
    const types = ['wall', 'floor', 'forest', 'build', 'spawn', 'npc', 'void'];
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
          toErase.tile.destroy();
          this._emitEditorStats();
        }
      }
      return;
    }

    // Brush: place tile (skip if same type already there)
    const isFloor = this.editorTileType === 'floor';
    let replacing = null;

    if (isFloor) {
      replacing = existingTiles.find(t => t.type === 'floor');
    } else {
      // It's an object. It replaces any OTHER object that is NOT a floor and NOT a void.
      // E.g. placing a tree (forest) should replace an existing wall or build or npc, but not void or floor.
      replacing = existingTiles.find(t => t.type !== 'floor' && t.type !== 'void');
    }

    if (replacing) {
      if (replacing.type === this.editorTileType) return; // same type, skip
      // Different type: remove old, place new
      this.editorHistory.push({ action: 'replace', oldType: replacing.type, newType: this.editorTileType, x: gx, y: gy });
      replacing.tile.destroy();
    } else {
      // Avoid placing void on top of void
      if (this.editorTileType === 'void') {
        if (existingTiles.find(t => t.type === 'void')) return;
      }
      this.editorHistory.push({ action: 'place', type: this.editorTileType, x: gx, y: gy, frame: this.editorTextureFrame, metadata: this.editorBuildMetadata, scale: this.editorBuildScale });
    }
    this.editorRedoStack = [];

    const texture = this._getTextureForType(this.editorTileType);
    const group = this._getGroupForType(this.editorTileType);

    if (this.editorTileType === 'wall') {
      const f = this.editorTextureFrame || 'sprite1';
      group.create(gx, gy, 'walls', f).refreshBody();
    } else if (this.editorTileType === 'floor') {
      // Use terrain atlas for floors
      const sprite = this.add.image(gx, gy, 'terrain', this.editorTextureFrame);
      sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
      sprite.setAlpha(1);
      group.add(sprite);
    } else if (this.editorTileType === 'forest') {
      // Forest objects: collidable, variable size
      const f = this.editorTextureFrame || 'sprite1';
      const sprite = group.create(gx, gy, 'forest', f);
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
    } else {
      const sprite = this.add.sprite(gx, gy, texture);
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
        historySize: this.editorHistory?.length || 0,
        redoSize: this.editorRedoStack?.length || 0,
      }
    }));
  }

  // ===== Editor: Tool & tile type setters =====

  setEditorTool(tool) {
    this.editorTool = tool;
    // Update cursor color based on tool
    const colors = { brush: 0x00ff88, eraser: 0xff4444, rect: 0xffff00, marker: 0x00ffff };
    this.cursorPreview?.setStrokeStyle(2, colors[tool] || 0xffffff, 0.8);
  }

  setEditorTileType(type) {
    this.editorTileType = type;
    // Update cursor fill to match tile color
    const colors = { wall: 0x666666, floor: 0x8B7355, forest: 0x228B22, build: 0xCD853F, spawn: 0x00CC66, npc: 0x4488FF };
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
    } else if (type === 'floor') {
      const f = frame || 'sprite1';
      const sprite = this.add.image(gx, gy, 'terrain', f);
      sprite.setDisplaySize(this.GRID_SIZE, this.GRID_SIZE);
      group.add(sprite);
    } else if (type === 'forest') {
      const f = frame || 'sprite1';
      const sprite = group.create(gx, gy, 'forest', f);
      this._setupForestSprite(sprite);
    } else if (type === 'build') {
      const f = frame || 'sprite1';
      const scale = (metadata && metadata.buildScale) || 2;
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
    } else {
      const sprite = this.add.sprite(gx, gy, texture);
      sprite.setAlpha(0.8);
      group.add(sprite);
    }
  }

  _setupForestSprite(sprite) {
    // 1. Depth Sorting: Base of the tree
    // Origin is 0.5, 0.5. Bottom is y + height/2.
    sprite.setDepth(sprite.y + (sprite.height * 0.5));

    // 2. Physics Body: Trunk only
    // We want the collision to be at the bottom center, roughly 40% width and 20% height.
    // This allows the player to walk "behind" the tree (the top part).

    // First refresh to ensure body matches sprite position/size initially
    sprite.refreshBody();

    const w = sprite.width;
    const h = sprite.height;

    const bodyW = w * 0.4;
    const bodyH = h * 0.2;

    // Offset is relative to top-left of the sprite texture?
    // StaticBody setOffset/setSize might behavior differently.
    // For StaticBody, setSize sets the dimensions.
    // setOffset sets the offset from the Game Object's position (top-left?).
    // Actually, distinct from DynamicBody.

    // Let's try explicit setSize and setOffset.
    // Reduce height to 10% (trunk base) to allow walking behind the canopy
    const newBodyH = h * 0.1;
    sprite.body.setSize(bodyW, newBodyH);

    // Offset calculation:
    // We want it centered horizontally: (w - bodyW) / 2
    // Bottom aligned: h - newBodyH
    sprite.body.setOffset((w - bodyW) / 2, h - newBodyH);
  }

  _setupBuildSprite(sprite) {
    // ---- 1. Depth sorting ----
    sprite.setDepth(sprite.y + sprite.displayHeight * 0.5);

    // ---- 2. Physics body ----
    // refreshBody() syncs the StaticBody position to the sprite's current world pos
    // and resets size to the full displayWidth x displayHeight.
    sprite.refreshBody();

    const dw = sprite.displayWidth;    // width  × scale
    const dh = sprite.displayHeight;   // height × scale

    const bodyW = dw * 0.80;           // 80% of displayed width
    const bodyH = dh * 0.65;           // bottom 65% (up to roof)

    // setSize(w, h, center=true) — sets body size in DISPLAY pixels and
    // re-centers the body on the sprite. The internal tree is updated automatically.
    sprite.body.setSize(bodyW, bodyH, true);

    // setOffset(x, y) — shifts body position by x,y in DISPLAY pixels.
    // We need to push down so the body aligns to the BOTTOM of the sprite:
    //   centered body top = sprite.y - bodyH/2
    //   target body top   = sprite.y + dh/2 - bodyH
    //   shift needed      = (dh - bodyH) / 2
    sprite.body.setOffset(0, (dh - bodyH) / 2);
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
    this.voids.clear(true, true);
    this.editorHistory = [];
    this.editorRedoStack = [];
    this._emitEditorStats();
  }

  /**
   * Toggles the map editor on/off.
   * Only admins can activate it.
   * @param {boolean} enabled
   */
  toggleEditorMode(enabled) {
    // Admin guard
    if (enabled) {
      if (!useAuthStore.getState().isAdmin()) {
        console.warn('[LobbyScene] Unauthorized editor activation attempt.');
        return;
      }
    }

    this.editorMode = enabled;
    this.cursorPreview?.setVisible(enabled);
    this.cursorCoordLabel?.setVisible(enabled);

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
        this.player.setVisible(true);
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
    if (mode === 'camera') {
      // Hide player and stop physics so the editor is clean
      this.player.setVisible(false);
      if (this.player.body) {
        this.player.body.setEnable(false);
        this.player.body.setVelocity(0, 0);
      }
      this.cameras.main.stopFollow();
    } else {
      // character mode: player is visible and physics-enabled, camera follows
      this.player.setVisible(true);
      if (this.player.body) {
        this.player.body.setEnable(true);
      }
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }
  }

  // ===== Export / Import (multi-type) =====

  exportMapConfig() {
    const data = {
      width: this.mapWidth,
      height: this.mapHeight,
      walls: this.walls.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: (t.frame.name === '__BASE' || t.texture.key === 'tile-wall') ? 'sprite1' : t.frame.name
      })),
      floors: this.floors.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      forest: this.forest.getChildren().map(t => ({ x: t.x, y: t.y, frame: t.frame.name })),
      builds: this.builds.getChildren().map(t => ({
        x: t.x, y: t.y, frame: t.frame.name,
        scale: t.data?.get('buildScale') || t.scaleX || 1,
        ...(t.data?.get('targetMap') !== undefined && t.data?.get('targetMap') !== '' ? { targetMap: t.data.get('targetMap') } : {}),
        ...(t.data?.get('targetRoute') !== undefined && t.data?.get('targetRoute') !== '' ? { targetRoute: t.data.get('targetRoute') } : {}),
        ...(t.data?.get('targetX') !== undefined && t.data?.get('targetX') !== '' ? { targetX: t.data.get('targetX') } : {}),
        ...(t.data?.get('targetY') !== undefined && t.data?.get('targetY') !== '' ? { targetY: t.data.get('targetY') } : {}),
        ...(t.data?.get('interactionText') !== undefined && t.data?.get('interactionText') !== '' ? { interactionText: t.data.get('interactionText') } : {}),
        ...(t.data?.get('portalType') !== undefined && t.data?.get('portalType') !== '' ? { portalType: t.data.get('portalType') } : {}),
      })),
      spawns: this.spawns.getChildren().map(t => ({ x: t.x, y: t.y })),
      npcZones: this.npcZones.getChildren().map(t => ({ x: t.x, y: t.y })),
      voids: this.voids.getChildren().map(t => ({ x: t.x, y: t.y })),
    };
    return JSON.stringify(data, null, 2);
  }

  clearMap() {
    this.walls.clear(true, true);
    this.floors.clear(true, true);
    this.forest.clear(true, true);
    this.builds.clear(true, true);
    this.spawns.clear(true, true);
    this.npcZones.clear(true, true);
    this.voids.clear(true, true);
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
        this.floors.add(s);
      });
      (data.forest || []).forEach(w => {
        const frame = w.frame || 'sprite1';
        const s = this.forest.create(w.x, w.y, 'forest', frame);
        this._setupForestSprite(s);
      });
      (data.builds || []).forEach((w, idx) => {
        const frame = w.frame || 'sprite1';
        const scale = w.scale || 2;
        const s = this.builds.create(w.x, w.y, 'builds', frame);
        s.setScale(scale);
        s.data = new Phaser.Data.DataManager(s);
        s.data.set('buildScale', scale);
        if (w.targetMap !== undefined) {
          s.data.set('targetMap', w.targetMap);
        } else if (w.targetRoute !== undefined) {
          s.data.set('targetRoute', w.targetRoute);
        } else if (w.portalType && w.portalType !== 'local') {
          console.warn('[MapLoad] build[' + idx + '] Portal has no targetMap or targetRoute (raw:', JSON.stringify(w), ')');
        } else {
          console.warn('[MapLoad] build[' + idx + '] NO targetMap (raw:', JSON.stringify(w), ')');
        }
        if (w.targetX !== undefined) s.data.set('targetX', w.targetX);
        if (w.targetY !== undefined) s.data.set('targetY', w.targetY);
        if (w.interactionText !== undefined) s.data.set('interactionText', w.interactionText);
        if (w.portalType !== undefined) {
          s.data.set('portalType', w.portalType);
          console.log(`[MapLoad] Portal loaded at ${w.x}, ${w.y} (Type: ${w.portalType})`);
        } else {
          console.warn('[MapLoad] build[' + idx + '] NO portalType (raw:', JSON.stringify(w), ')');
        }
        this._setupBuildSprite(s);
      });
      (data.spawns || []).forEach(w => { const s = this.add.sprite(w.x, w.y, 'tile-spawn'); s.setAlpha(0.8); this.spawns.add(s); });
      (data.npcZones || []).forEach(w => { const s = this.add.sprite(w.x, w.y, 'tile-npc'); s.setAlpha(0.8); this.npcZones.add(s); });
      (data.voids || []).forEach(w => { this.voids.create(w.x, w.y, 'tile-void').refreshBody(); });
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

    // 4. Redraw Grid
    // We need to find the existing grid graphics or clear/create new one.
    // In createMap we used a local var 'gridGfx'. We should probably store it.
    if (this.gridGraphics) {
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
    }
  }

  updateCameraBounds() {
    if (!this.player || !this.voids) return;
    if (this.editorMode && this.editorMoveMode === 'camera') return;

    let leftBound = 0;
    let rightBound = this.mapWidth;
    let topBound = 0;
    let bottomBound = this.mapHeight;

    const camZoom = this.cameras.main.zoom || 1;
    const camWidth = this.cameras.main.width / camZoom;
    const camHeight = this.cameras.main.height / camZoom;

    // View boundaries to filter voids that are horizontally in line with the player.
    const camHalfHeight = camHeight / 2;
    const viewTop = this.player.y - camHalfHeight;
    const viewBottom = this.player.y + camHalfHeight;

    this.voids.getChildren().forEach(v => {
      // Void blocks are 100x100
      if (v.y + 50 > viewTop && v.y - 50 < viewBottom) {
        if (v.x < this.player.x) {
          leftBound = Math.max(leftBound, v.x + 50); // Block spans to v.x + width/2
        } else if (v.x > this.player.x) {
          rightBound = Math.min(rightBound, v.x - 50); // Block starts at v.x - width/2
        }
      }
    });

    // Ensure the bound width is not smaller than camera width to avoid zooming issues
    if (rightBound - leftBound < camWidth) {
      // Center bounds on the X axis if the room/map is smaller than the camera width
      const midX = (leftBound + rightBound) / 2;
      leftBound = midX - camWidth / 2;
      rightBound = midX + camWidth / 2;
    }

    // Ensure the bound height is not smaller than camera height to avoid the map sticking to the top
    if (bottomBound - topBound < camHeight) {
      // Center bounds on the Y axis if the room/map is smaller than the camera height
      const midY = (topBound + bottomBound) / 2;
      topBound = midY - camHeight / 2;
      bottomBound = midY + camHeight / 2;
    }

    // Set constrained camera bounds
    this.cameras.main.setBounds(
      leftBound,
      topBound,
      Math.max(rightBound - leftBound, camWidth),
      Math.max(bottomBound - topBound, camHeight)
    );
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
        // This eliminates the race condition where the player spawned at (1000,750)
        // because mapDefaultSpawnX/Y weren't populated yet.
        if (!this.player) {
          this.createMyPlayer();
        }
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
    this.myPlayerId = user?.id;

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
      startY = this.mapDefaultSpawnY ?? 750;
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

    this.add.existing(this.player);

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

    const cls = user?.characterClass || this.getRandomClass();

    // Camera follow (Round pixels = true, lerp = 0.1 for smooth)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  getRandomClass() {
    const classes = ['warrior', 'mage', 'archer'];
    return classes[Math.floor(Math.random() * classes.length)];
  }

  handlePlayersUpdate(players) {
    if (!players) return;

    // Ensure myPlayerId is set, always as a string
    const currentUser = useAuthStore.getState().user;
    if (!this.myPlayerId && currentUser?.id) {
      this.myPlayerId = String(currentUser.id);
    }
    const myIdStr = this.myPlayerId ? String(this.myPlayerId) : null;
    const currentUserIdStr = currentUser?.id ? String(currentUser.id) : null;

    // Add new / update existing remote players
    players.forEach((player, id) => {
      const strId = String(id);

      // CANVAS-LEVEL guard: never create a sprite for ourselves
      const isMe = (myIdStr && strId === myIdStr) || (currentUserIdStr && strId === currentUserIdStr);
      if (isMe) {
        // Only teleport self if significantly off (portal jump)
        if (this.player && (Math.abs(this.player.x - player.x) > 50 || Math.abs(this.player.y - player.y) > 50)) {
          console.log("[LobbyScene] Teleporting self to match store:", player.x, player.y);
          this.player.setPosition(player.x, player.y);
        }
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
    if (isNaN(y)) y = 1300;

    console.log(`[LobbyScene] Creating sprite for ${id} (${player.username}) at ${x}, ${y}`);

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

      if (typeof player.x !== 'number' || typeof player.y !== 'number' || isNaN(player.x) || isNaN(player.y)) {
        return;
      }

      // Check if target has changed significantly
      if (sprite.targetX === player.x && sprite.targetY === player.y) {
        return;
      }

      sprite.targetX = player.x;
      sprite.targetY = player.y;

      // Calculate velocity for animation
      const dx = player.x - sprite.x;
      const dy = player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Update animation state: Prefer network 'anim' if provided, otherwise infer from velocity
      if (player.anim) {
        sprite.playAnimation(player.anim);
      } else {
        const velocity = new Phaser.Math.Vector2(dx, dy);
        if (dist > 2) {
          sprite.updateMovement(velocity);
        } else {
          sprite.updateMovement(new Phaser.Math.Vector2(0, 0));
        }
      }

      // Apply direction (flip) received from network
      if (player.direction === 'left') {
        sprite.sprite.setFlipX(true);
      } else if (player.direction === 'right') {
        sprite.sprite.setFlipX(false);
      }

      // Distance check for teleport vs tween
      if (dist > 200) {
        // Teleport if too far
        sprite.setPosition(player.x, player.y);
        this.tweens.killTweensOf(sprite); // Stop any existing tweens
      } else {
        // Interpolation
        this.tweens.killTweensOf(sprite);

        this.tweens.add({
          targets: sprite,
          x: player.x,
          y: player.y,
          duration: 100
        });
      }
    } else {
      console.warn(`[LobbyScene] updateOtherPlayer called for missing sprite: ${id}`);
    }
  }

  removeOtherPlayer(id) {
    const sprite = this.playerSprites.get(id);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(id);
    }
  }

  createNPCs() {
    // Define NPCs
    const npcData = [
      { id: 'mission_master', name: 'Mission Master', x: 1000, y: 800, color: 0x4444ff, role: 'mission' },
      { id: 'trainer', name: 'Trainer', x: 1200, y: 900, color: 0x44ff44, role: 'class' },
      { id: 'shop', name: 'Shop Keeper', x: 800, y: 900, color: 0xffff44, role: 'shop' }
    ];

    npcData.forEach(data => {
      const container = this.add.container(data.x, data.y);

      // NPC Visual
      const shape = this.add.rectangle(0, 0, 30, 30, data.color);
      const label = this.add.text(0, -25, data.name, {
        fontSize: '12px',
        fill: '#cccccc'
      }).setOrigin(0.5);

      container.add([shape, label]);
      this.physics.add.existing(container, true); // Static body

      container.npcData = data;
      this.npcs.push(container);
    });
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

  update(time) {
    if (!this.player) return;

    // Force camera follow every frame to fix teleport lag/desync - MOVED TO createMyPlayer
    // this.cameras.main.startFollow(this.player, true, 1, 1);

    // Periodic Sync (every 1 second) to ensure Store and Scene match
    if (time - this.lastSyncUpdate > 1000) {
      const storePlayers = useGameStore.getState().players;
      // Proactively reconcile sprites without assuming 'self' is always in the store initially
      this.handlePlayersUpdate(storePlayers);
      this.lastSyncUpdate = time;
    }


    // ─── Editor movement modes ───────────────────────────────────────────────
    if (this.editorMode) {
      if (this.editorMoveMode === 'camera') {
        // CAMERA PAN: WASD/Arrows scroll the viewport freely
        if (!this.isTyping()) {
          const panSpeed = 10;
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

  shutdown() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this._onInteractKeyDown) {
      window.removeEventListener('keydown', this._onInteractKeyDown);
      this._onInteractKeyDown = null;
    }
    if (this.onChatMsg) {
      window.removeEventListener('chat-message-received', this.onChatMsg);
    }
    if (this.onResize) {
      this.scale.off('resize', this.onResize);
      this.onResize = null;
    }
    if (this.onZoomEvent) {
      window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
      this.onZoomEvent = null;
    }
    if (this.onEditorEvent) {
      window.removeEventListener('editor-command', this.onEditorEvent);
      this.onEditorEvent = null;
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // Explicitly destroy all remote player sprites
    if (this.playerSprites) {
      this.playerSprites.forEach((sprite, id) => {
        console.log(`[LobbyScene] Destroying ghost sprite for ${id} on shutdown`);
        sprite.destroy();
      });
      this.playerSprites.clear();
    }
  }

  processSyncInteractions() {
    if (!this._readyInteractions) return;
    const { found, foundChallenge, foundPlayer, foundBuild } = this._readyInteractions;

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

    this.nearbyNPC = found;

    // Save state for synchronous interaction processing
    this._readyInteractions = { found, foundChallenge, foundPlayer, foundBuild };

    // Update Interaction Prompt
    if (found || foundChallenge || foundPlayer || foundBuild) {
      let msg = "Presiona E";
      if (found) msg = `Presiona E para hablar con ${found.npcData.name}`;
      else if (foundChallenge) {
        const isJoined = useGameStore.getState().activeChallengeId === foundChallenge.challengeData.id;
        msg = isJoined ? "Presiona E para salir" : `Presiona E para unirte a ${foundChallenge.challengeData.name}`;
      }
      else if (foundPlayer) msg = `Presiona E para chatear con ${foundPlayer.name}`;
      else if (foundBuild) {
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
          msg = customText ? `Presiona E: ${customText}` : `Presiona E para Entrar`;
        } else {
          msg = '⚠ Edif. sin destino configurado';
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

  triggerInteraction(data) {
    // Emit event to React
    const event = new CustomEvent('lobby-interaction', { detail: data });
    window.dispatchEvent(event);
  }
}

