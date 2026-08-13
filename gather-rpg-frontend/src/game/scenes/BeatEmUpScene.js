import * as Phaser from 'phaser';
import EnemyPool        from '../systems/EnemyPool';
import WaveSpawner      from '../systems/WaveSpawner';
import HitboxSystem     from '../systems/HitboxSystem';
import PlayerController from '../systems/PlayerController';
import ItemInventory    from '../systems/ItemInventory';
import SpellSystem      from '../systems/SpellSystem';
import BeatEmUpHUD      from '../systems/BeatEmUpHUD';
import ComboHUD         from '../systems/ComboHUD';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MapManager } from '../map/MapManager';
import {
  loadEnemySprites,
  createEnemyAnimations,
} from '../config/EnemyConfig';
import {
  loadCharacterSprites,
  createCharacterAnimations,
} from '../config/CharacterConfig';

const LANE_TOP    = 350;
const LANE_BOTTOM = 520;

// Items iniciales por misión (se puede hacer configurable desde data.missionId)
const INITIAL_SPELLS  = 3;
const INITIAL_POTIONS = 2;

export default class BeatEmUpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BeatEmUpScene' });
  }

  init(data) {
    this.levelId      = data.levelId    ?? '1';
    this.triggerNpcId = data.npcId      ?? null;
    this.missionId    = data.missionId  ?? null;
    // Permitir configurar items desde la misión
    this.startSpells  = data.spells  ?? INITIAL_SPELLS;
    this.startPotions = data.potions ?? INITIAL_POTIONS;
    this.startManaPotions = data.manaPotions ?? 2;
    this.startThrowingDaggers = data.throwingDaggers ?? 5;
  }

  preload() {
    loadEnemySprites(this);
    // Cargar sprites del personaje (incluyendo el nuevo sheet 'd' de combos)
    loadCharacterSprites(this);
  }

  async create() {
    // ── Animaciones ──
    createEnemyAnimations(this);
    createCharacterAnimations(this);

    // ── Mapa ──
    this.mapManager = new MapManager(this);
    this.mapManager.createMap();

    // ── Mundo ──
    this.physics.world.setBounds(0, LANE_TOP, 800, LANE_BOTTOM - LANE_TOP);
    this._buildBackground();

    // ── Jugador ──
    this.playerSprite = new PlayerSprite(this, 150, 450, '1', 0, 'Hero', true);
    this.add.existing(this.playerSprite);

    // ── Inventario ──
    this.itemInventory = new ItemInventory(
      this,
      this.startSpells,
      this.startPotions,
      this.startManaPotions,
      this.startThrowingDaggers
    );

    // ── HUD ──
    this.gameHUD  = new BeatEmUpHUD(this);
    this.comboHUD = new ComboHUD(this);

    // ── Sistemas de combate ──
    this.enemyPool    = new EnemyPool(this, 20);
    this.hitboxSystem = new HitboxSystem(this, this.playerSprite, this.enemyPool);
    this.spellSystem  = new SpellSystem(this, this.playerSprite, this.enemyPool, this.itemInventory);
    this.playerCtrl   = new PlayerController(
      this, this.playerSprite, this.hitboxSystem,
      this.itemInventory, this.spellSystem, this.gameHUD
    );
    this.waveSpawner  = new WaveSpawner(this, this.enemyPool, this.playerSprite);

    // Sincronizar estado inicial
    this.gameHUD.syncState(
      this.playerCtrl.hp, this.playerCtrl.maxHp,
      this.playerCtrl.mp, this.playerCtrl.maxMp,
      this.itemInventory.spells,
      this.itemInventory.throwingDaggers
    );

    // ── Overlap: ataque de enemigos → jugador ──
    this.physics.add.overlap(
      this.playerSprite,
      this.enemyPool.getGroup(),
      (player, enemy) => {
        // No basta con el overlap del body: validamos rango real para evitar
        // golpes a distancia causados por hitboxes amplias/desfasadas.
        if (enemy.fsm !== 'attack') return;
        if (typeof enemy.isTargetInAttackRange === 'function' && !enemy.isTargetInAttackRange(player, 8)) return;

        this.playerCtrl.takeDamage(
          enemy.config?.damage ?? 10,
          { x: enemy.x < player.x ? 1 : -1, y: -0.2 }
        );
      }
    );

    // ── Eventos ──
    this.events.on('enemy-died',    (enemy) => this._onEnemyDied(enemy));
    this.events.on('level-cleared', ()      => this._onLevelComplete());
    this.events.on('player-dead',   ()      => this._onGameOver());
    this.events.on('wave-started',  (num)   => this._showWaveBanner(num));

    // ── Responsividad de Escena ──
    this.onResize = (gameSize) => {
      if (this.gameHUD && typeof this.gameHUD.handleResize === 'function') {
        this.gameHUD.handleResize(gameSize);
      }
      if (this.comboHUD && typeof this.comboHUD.handleResize === 'function') {
        this.comboHUD.handleResize(gameSize);
      }
    };
    this.scale.on('resize', this.onResize, this);

    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      if (this.gameHUD) {
        this.gameHUD.destroy();
        this.gameHUD = null;
      }
      if (this.comboHUD) {
        this.comboHUD.destroy();
        this.comboHUD = null;
      }
      if (this.spellSystem) {
        this.spellSystem.destroy();
        this.spellSystem = null;
      }
    });

    // ── Debug ──
    this.input.keyboard.on('keydown-D', () => this.hitboxSystem.enableDebug());

    // ── Cargar mapa y arrancar ──
    await this.mapManager.loadServerMapConfig(this.levelId);
    this.waveSpawner.loadFromMap(this.mapManager.enemySpawns);
    this.waveSpawner.start();
  }

  update(time, delta) {
    this.playerCtrl.update(delta);
    this.enemyPool.update(time, delta);
  }

  // ── Enemy Died — drops de items ──────────────────────────────────────────
  _onEnemyDied(enemy) {
    this.waveSpawner.onEnemyDied();

    // Drop aleatorio (20% poción de vida, 10% poción de maná, 12% dagas arrojables, 8% scrolls)
    const roll = Math.random();
    if (roll < 0.08) {
      const spells = ['spell_fire_rain', 'spell_wave', 'spell_nova'];
      const chosenSpell = Phaser.Utils.Array.GetRandom(spells);
      this._spawnDrop(enemy.x, enemy.y, chosenSpell);
    } else if (roll < 0.18) {
      this._spawnDrop(enemy.x, enemy.y, 'mana_potion');
    } else if (roll < 0.30) {
      this._spawnDrop(enemy.x, enemy.y, 'throwable');
    } else if (roll < 0.50) {
      this._spawnDrop(enemy.x, enemy.y, 'potion');
    }
  }

  _spawnDrop(x, y, type) {
    let color = 0xff88cc;
    let label = '⚗';
    let displayName = 'POTION';

    if (type === 'mana_potion') {
      color = 0x4488ff;
      label = '🧪';
      displayName = 'MANA POTION';
    } else if (type === 'throwable') {
      color = 0xaaaaaa;
      label = '🔪';
      displayName = 'DAGGER';
    } else if (type.startsWith('spell_')) {
      color = 0xffdd44;
      label = '✦';
      if (type === 'spell_fire_rain') {
        displayName = 'SCROLL: FIRE';
        label = '🔥';
      } else if (type === 'spell_wave') {
        displayName = 'SCROLL: WAVE';
        label = '🌊';
      } else if (type === 'spell_nova') {
        displayName = 'SCROLL: NOVA';
        label = '💥';
      } else {
        displayName = 'SCROLL';
      }
    }

    const icon = this.add.text(x, y, label, {
      fontSize: '20px', color: `#${color.toString(16).padStart(6, '0')}`,
    }).setDepth(100).setOrigin(0.5);

    // Animación de pop del drop
    this.tweens.add({
      targets: icon, y: y - 30, scale: 1.2,
      duration: 200, ease: 'Back.Out',
      onComplete: () => {
        // Esperar 3s antes de desaparecer si no lo recoge
        this.time.delayedCall(3000, () => {
          if (icon.active) {
            this.tweens.add({
              targets: icon, alpha: 0, duration: 400,
              onComplete: () => icon.destroy(),
            });
          }
        });
      }
    });

    // Overlap pickup — el jugador lo recoge al pasar
    const pickupZone = this.add.zone(x, y - 15, 40, 40);
    this.physics.add.existing(pickupZone);

    this.physics.add.overlap(this.playerSprite, pickupZone, () => {
      if (!icon.active) return;
      icon.destroy();
      pickupZone.destroy();

      if (type === 'potion') {
        this.itemInventory.addPotion(1);
      } else if (type === 'mana_potion') {
        this.itemInventory.addManaPotion(1);
      } else if (type === 'throwable') {
        this.itemInventory.addThrowingDagger(3);
      } else if (type === 'spell_fire_rain') {
        this.itemInventory.addSpellType('fire_rain', 1);
      } else if (type === 'spell_wave') {
        this.itemInventory.addSpellType('wave', 1);
      } else if (type === 'spell_nova') {
        this.itemInventory.addSpellType('nova', 1);
      }

      // Feedback visual de recoger
      const qtyLabel = type === 'throwable' ? '+3' : '+1';
      const flash = this.add.text(x, y - 40, `${qtyLabel} ${displayName}`, {
        fontSize: '10px', fontFamily: '"Press Start 2P", monospace',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#000000', strokeThickness: 3,
      }).setDepth(300).setOrigin(0.5);
      this.tweens.add({
        targets: flash, y: y - 80, alpha: 0,
        duration: 800,
        onComplete: () => flash.destroy(),
      });
    });
  }

  // ── Wave Banner ──────────────────────────────────────────────────────────
  _showWaveBanner(num) {
    const text = this.add.text(400, 300, `WAVE ${num}`, {
      fontSize:        '64px',
      fill:            '#ffffff',
      fontFamily:      'monospace',
      stroke:          '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0).setDepth(1000);

    this.tweens.add({
      targets:  text,
      alpha:    1,
      scale:    1.2,
      duration: 500,
      yoyo:     true,
      hold:     1000,
      onComplete: () => text.destroy(),
    });
  }

  // ── Level Complete ───────────────────────────────────────────────────────
  async _onLevelComplete() {
    this.physics.pause();
    this.add.text(400, 300, 'LEVEL CLEAR!', {
      fontSize: '64px', fill: '#00ff00',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(1000);

    this.time.delayedCall(2000, async () => {
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
      } catch (e) { /* silenciar errores de red */ }

      this.scene.stop('BeatEmUpScene');
      if (this.scene.exists('LobbyScene')) {
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
          detail: { targetMap: 'lobby' }
        }));
      }
    });
  }

  // ── Game Over ────────────────────────────────────────────────────────────
  _onGameOver() {
    this.physics.pause();
    this.add.text(400, 300, 'GAME OVER', {
      fontSize: '64px', fill: '#ff0000',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(1000);

    this.time.delayedCall(3000, () => {
      this.scene.start('BeatEmUpScene', {
        levelId: this.levelId,
        missionId: this.missionId,
        spells: this.startSpells,
        potions: this.startPotions,
        manaPotions: this.startManaPotions,
      });
    });
  }

  // ── Background ───────────────────────────────────────────────────────────
  _buildBackground() {
    this.add.rectangle(400, 175, 800, 350, 0x2d4a2d).setDepth(-10);
    this.add.rectangle(400, 435, 800, 170, 0x4a7c59).setDepth(-5);
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff, 0.2);
    graphics.strokeRect(0, LANE_TOP, 800, LANE_BOTTOM - LANE_TOP);
  }
}
