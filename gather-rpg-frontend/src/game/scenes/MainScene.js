// import * as Phaser from 'phaser'; 
const Phaser = window.Phaser;
import { useAuthStore } from '../../store/authStore';
import wsClient from '../../services/websocket';
import { PlayerSprite } from '../entities/PlayerSprite';
import { loadCharacterSprites, createCharacterAnimations } from '../config/CharacterConfig';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.playerSprites = new Map();
    this.myPlayerId = null;
    this.cursors = null;
    this.lastUpdate = 0;
    this.worldWidth = 2000;
    this.worldHeight = 1500;
    this.mySprite = null;
    this.zoom = 1.1;
    this.zoomMin = 0.6;
    this.zoomMax = 1.5;
    this.zoomStep = 0.1;
    this.onResize = null;
    this.onZoomEvent = null;
  }

  preload() {
    // Load all character sprites defined in config
    loadCharacterSprites(this);
  }

  createAnimations() {
    // Generate animations for all loaded characters
    createCharacterAnimations(this);
  }

  create() {
    this.createAnimations();
    this.add.text(20, 20, 'GatherRPG Game Scene', { fill: '#ffffff' });
    this.createGrid();

    // Setup keys
    this.cursors = this.input.keyboard.createCursorKeys();

    this.cameras.main.setZoom(this.zoom);
    this.configureCameraBounds();
    this.onResize = (gameSize) => this.configureCameraBounds(gameSize);
    this.scale.on('resize', this.onResize);

    this.onZoomEvent = (e) => {
      const detail = e?.detail;
      if (detail?.sceneKey && detail.sceneKey !== 'MainScene') return;
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

    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe(
      (state) => state.players,
      (players) => this.handlePlayersUpdate(players)
    );

    // Get my user ID
    const user = useAuthStore.getState().user;
    if (user) {
      this.myPlayerId = user.id; // Assuming user object has id
    }

    // Spawn placeholder enemies
    this.enemies = [];
    const enemySpawns = [
      { x: 200, y: 200, enemyId: 'slime-001' },
      { x: 600, y: 400, enemyId: 'goblin-001' },
    ];

    enemySpawns.forEach(spawn => {
      const enemy = this.add.circle(spawn.x, spawn.y, 15, 0xff0000);
      this.physics.add.existing(enemy);
      enemy.body.setImmovable(true);
      enemy.enemyId = spawn.enemyId;

      // Label
      this.add.text(spawn.x, spawn.y - 30, 'Enemy', {
        fontSize: '12px',
        fill: '#ff0000'
      }).setOrigin(0.5);

      this.enemies.push(enemy);
    });
  }

  configureCameraBounds(gameSize) {
    const cam = this.cameras?.main;
    if (!cam) return;

    const width = Number(gameSize?.width ?? this.scale?.width ?? cam.width);
    const height = Number(gameSize?.height ?? this.scale?.height ?? cam.height);

    if (Number.isFinite(width) && Number.isFinite(height)) {
      const viewHalfW = (width / cam.zoom) / 2;
      const viewHalfH = (height / cam.zoom) / 2;
      cam.setBounds(-viewHalfW, -viewHalfH, this.worldWidth + viewHalfW * 2, this.worldHeight + viewHalfH * 2);
    } else {
      cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
    }
  }

  createGrid() {
    const width = this.worldWidth;
    const height = this.worldHeight;
    const gridSize = 32;

    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 1);

    for (let x = 0; x <= width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }

    graphics.strokePath();
  }

  ensureCameraFollow() {
    if (!this.mySprite || !this.cameras?.main) return;
    if (this.cameras.main._follow === this.mySprite) return;
    this.cameras.main.setFollowOffset(0, 0);
    this.cameras.main.setDeadzone();
    this.cameras.main.startFollow(this.mySprite, true, 1, 1);
    this.cameras.main.centerOn(this.mySprite.x, this.mySprite.y);
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
    this.configureCameraBounds();
    this.ensureCameraFollow();
  }

  shutdown() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.onResize) {
      this.scale.off('resize', this.onResize);
      this.onResize = null;
    }
    if (this.onZoomEvent) {
      window.removeEventListener('phaser-camera-zoom', this.onZoomEvent);
      this.onZoomEvent = null;
    }
  }

  handlePlayersUpdate(players) {
    // Add new players
    players.forEach((player, id) => {
      if (!this.playerSprites.has(id)) {
        this.addPlayer(id, player);
      } else {
        this.updatePlayer(id, player);
      }
    });

    // Remove disconnected players
    this.playerSprites.forEach((sprite, id) => {
      if (!players.has(id)) {
        this.removePlayer(id);
      }
    });
  }

  addPlayer(id, player) {
    const startX = player.x || 1000;
    const startY = player.y || 750;

    // Determine character sprite key
    // Default to '1' (which maps to 1a.png/1b.png)
    // In the future, read from player.characterId or player.class
    const characterId = player.character_id || '1';

    const playerSprite = new PlayerSprite(
      this,
      startX,
      startY,
      characterId,
      4,
      player.username || 'Unknown',
      id === this.myPlayerId
    );

    this.add.existing(playerSprite);
    this.playerSprites.set(id, playerSprite);

    if (id === this.myPlayerId) {
      this.mySprite = playerSprite;
      this.ensureCameraFollow();
    }
  }

  updatePlayer(id, player) {
    const sprite = this.playerSprites.get(id);
    if (sprite) {
      // Check enemy collision
      if (id === this.myPlayerId) {
        this.checkEnemyCollision(sprite);
      }

      // Calculate velocity for animation
      const dx = player.x - sprite.x;
      const dy = player.y - sprite.y;
      const velocity = new Phaser.Math.Vector2(dx, dy);

      sprite.setPosition(player.x, player.y);

      // Update animation
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        sprite.updateMovement(velocity);
      } else {
        sprite.updateMovement(new Phaser.Math.Vector2(0, 0));
      }

      if (id === this.myPlayerId) {
        this.mySprite = sprite;
        this.ensureCameraFollow();
      }
    }
  }

  checkEnemyCollision(playerSprite) {
    if (this.inCombat) return;

    this.enemies.forEach(enemy => {
      if (!enemy.visible) return;

      const dist = Phaser.Math.Distance.Between(
        playerSprite.x, playerSprite.y,
        enemy.x, enemy.y
      );

      if (dist < 30) { // Collision radius
        this.handleEnemyEncounter(enemy);
      }
    });
  }

  handleEnemyEncounter(enemySprite) {
    this.inCombat = true; // Prevent double trigger

    wsClient.send('encounter_enemy', {
      enemy_id: enemySprite.enemyId,
      position: { x: enemySprite.x, y: enemySprite.y }
    });

    enemySprite.setVisible(false);

    // Launch Combat Scene
    this.scene.pause('MainScene');
    this.scene.launch('CombatScene', {
      enemyId: enemySprite.enemyId,
      enemySprite: enemySprite
    });

    // Reset flag when returning? No, CombatScene will resume MainScene.
    // MainScene needs to know when combat ends to set inCombat = false.
    // We can listen to 'resume' event.
    this.events.on('resume', () => {
      this.inCombat = false;
    });
  }

  removePlayer(id) {
    const sprite = this.playerSprites.get(id);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(id);
    }
  }

  update(time, delta) {
    if (!this.cursors || !this.myPlayerId) return;

    const el = document.activeElement;
    if (
      el &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el.isContentEditable)
    ) {
      return;
    }

    const speed = 200;
    const velocity = { x: 0, y: 0 };

    if (this.cursors.left.isDown) velocity.x = -1;
    else if (this.cursors.right.isDown) velocity.x = 1;

    if (this.cursors.up.isDown) velocity.y = -1;
    else if (this.cursors.down.isDown) velocity.y = 1;

    const mySprite = this.playerSprites.get(this.myPlayerId);
    if (mySprite) {
      mySprite.updateMovement(new Phaser.Math.Vector2(velocity.x, velocity.y));
    }

    // Send movement update if moving
    if (velocity.x !== 0 || velocity.y !== 0) {
      // Throttle updates to ~60ms (15fps)
      if (time - this.lastUpdate > 60) {
        // Calculate new position based on previous position (simplified)
        // Ideally we'd get the current position from the sprite
        if (mySprite) {
          const newX = mySprite.x + (velocity.x * speed * (delta / 1000));
          const newY = mySprite.y + (velocity.y * speed * (delta / 1000));

          // Optimistic update
          mySprite.setPosition(newX, newY);

          useGameStore.getState().movePlayer(newX, newY);
          this.lastUpdate = time;
        }
      }
    }
  }
}
