import EnemyPool        from '../systems/EnemyPool';
import WaveSpawner      from '../systems/WaveSpawner';
import HitboxSystem     from '../systems/HitboxSystem';
import PlayerController from '../systems/PlayerController';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MapManager } from '../map/MapManager';
import { loadEnemySprites, createEnemyAnimations } from '../config/EnemyConfig';

const LANE_TOP    = 350;
const LANE_BOTTOM = 520;

export default class BeatEmUpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BeatEmUpScene' });
  }

  init(data) {
    this.levelId      = data.levelId    ?? '1';
    this.triggerNpcId = data.npcId      ?? null;
    this.missionId    = data.missionId  ?? null;
  }
  
  preload() {
    loadEnemySprites(this);
  }

  async create() {
    // ── Animaciones ──
    createEnemyAnimations(this);
    
    // ── Mapa ──
    this.mapManager = new MapManager(this);
    this.mapManager.createMap();
    
    // ── Mundo ──
    this.physics.world.setBounds(0, LANE_TOP, 800, LANE_BOTTOM - LANE_TOP);
    this._buildBackground();

    // ── Jugador ──
    // El PlayerSprite del proyecto toma (scene, x, y, characterId, frame, username, isSelf)
    this.playerSprite = new PlayerSprite(this, 150, 450, '1', 0, 'Hero', true);
    this.add.existing(this.playerSprite);

    // ── Sistemas ──
    this.enemyPool    = new EnemyPool(this, 20);
    this.hitboxSystem = new HitboxSystem(this, this.playerSprite, this.enemyPool);
    this.playerCtrl   = new PlayerController(this, this.playerSprite, this.hitboxSystem);
    this.waveSpawner  = new WaveSpawner(this, this.enemyPool, this.playerSprite);

    // ── Overlap: ataque de enemigos → jugador ──
    this.physics.add.overlap(
      this.playerSprite,
      this.enemyPool.getGroup(),
      (player, enemy) => {
        if (enemy.fsm === 'attack') {
          this.playerCtrl.takeDamage(
            enemy.config?.damage ?? 10,
            { x: enemy.x < player.x ? 1 : -1, y: -0.2 }
          );
        }
      }
    );

    // ── Eventos ──
    this.events.on('enemy-died',   () => this.waveSpawner.onEnemyDied());
    this.events.on('level-cleared', () => this._onLevelComplete());
    this.events.on('player-dead',   () => this._onGameOver());
    this.events.on('wave-started',  (num) => this._showWaveBanner(num));

    // ── Debug ──
    this.input.keyboard.on('keydown-D', () => this.hitboxSystem.enableDebug());

    // ── Cargar mapa y arrancar ──
    await this.mapManager.loadServerMapConfig(this.levelId);
    
    // Una vez cargado el mapa, inicializamos las oleadas desde el MapManager
    this.waveSpawner.loadFromMap(this.mapManager.enemySpawns);
    this.waveSpawner.start();

    this._buildUI();
  }

  update(time, delta) {
    this.playerCtrl.update(delta);
    this.enemyPool.update(time, delta);
  }

  _showWaveBanner(num) {
    const text = this.add.text(400, 300, `WAVE ${num}`, {
      fontSize: '64px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setDepth(1000);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1.2,
      duration: 500,
      yoyo: true,
      hold: 1000,
      onComplete: () => text.destroy()
    });
  }

  _buildUI() {
    this.hpBar = this.add.graphics();
    this.updateHP(100, 100);

    this.events.on('player-damaged', ({ hp, maxHp }) => this.updateHP(hp, maxHp));
  }

  updateHP(hp, maxHp) {
    this.hpBar.clear();
    // Fondo
    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(20, 20, 200, 20);
    // Vida
    const width = Math.max(0, (hp / maxHp) * 200);
    this.hpBar.fillStyle(hp < 30 ? 0xff0000 : 0x00ff00, 1);
    this.hpBar.fillRect(20, 20, width, 20);
  }

  async _onLevelComplete() {
    this.physics.pause();
    const banner = this.add.text(400, 300, 'LEVEL CLEAR!', {
      fontSize: '64px', fill: '#00ff00', stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5).setDepth(1000);

    this.time.delayedCall(2000, async () => {
      // Intentar avisar al backend
      try {
        await fetch('/api/combat/end', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            levelId:   this.levelId,
            missionId: this.missionId,
            completed: true,
          }),
        });
      } catch (e) {}

      this.scene.stop('BeatEmUpScene');
      // Si existe una escena de lobby o mundo, volver a ella
      if (this.scene.exists('LobbyScene')) {
        this.scene.start('LobbyScene');
      }
    });
  }

  _onGameOver() {
    this.physics.pause();
    this.add.text(400, 300, 'GAME OVER', {
      fontSize: '64px', fill: '#ff0000', stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5).setDepth(1000);

    this.time.delayedCall(3000, () => {
      this.scene.start('BeatEmUpScene', { levelId: this.levelId });
    });
  }

  _buildBackground() {
    // Cielo/Fondo
    this.add.rectangle(400, 175, 800, 350, 0x2d4a2d).setDepth(-10);
    // Suelo (LANE)
    this.add.rectangle(400, 435, 800, 170, 0x4a7c59).setDepth(-5);
    // Líneas de límite
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff, 0.2);
    graphics.strokeRect(0, LANE_TOP, 800, LANE_BOTTOM - LANE_TOP);
  }
}
