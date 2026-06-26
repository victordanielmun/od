import ComboSystem from './ComboSystem.js';
import { useGameStore } from '../../store/gameStore';

/**
 * PlayerController — Controles simplificados (desktop + mobile-ready)
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  TECLAS             MOBILE (futuro)                 │
 * │  ──────             ──────────────                  │
 * │  ↑↓←→  = Mover     Virtual joystick                │
 * │  Z     = Combo      Botón A                         │
 * │  X     = Kick/Hold  Botón B (tap=kick, hold=strong) │
 * │  SPACE = Quick Slot Tap en Quick Slot del HUD       │
 * └─────────────────────────────────────────────────────┘
 *
 * Quickslot:
 *   - El HUD muestra el ítem activo (spell o poción)
 *   - SPACE o click/tap en el slot = usar ítem activo
 *   - El HUD emite 'quickslot-swap' para intercambiar entre spell/poción
 *   - Si el slot está vacío, SPACE no hace nada (sin spam)
 */
export default class PlayerController {
  /**
   * @param {Phaser.Scene}   scene
   * @param {PlayerSprite}   player
   * @param {HitboxSystem}   hitboxSystem
   * @param {ItemInventory}  itemInventory
   * @param {SpellSystem}    spellSystem
   * @param {BeatEmUpHUD}    hud            — necesario para leer getActiveSlot()
   */
  constructor(scene, player, hitboxSystem,
              itemInventory = null, spellSystem = null, hud = null) {
    this.scene         = scene;
    this.player        = player;
    this.hitboxSystem  = hitboxSystem;
    this.itemInventory = itemInventory;
    this.spellSystem   = spellSystem;
    this.hud           = hud;

    // ── Estado ────────────────────────────────────────────────────────────
    this.hp            = 100;
    this.maxHp         = 100;
    this.mp            = 50;
    this.maxMp         = 50;
    this.isAlive       = true;
    this.isKnockedBack = false;
    this.iFrames       = 0;   // ms de invencibilidad tras daño
    this.speed         = 160;

    // Hold para "Strong" (X mantenida > HOLD_MS ms)
    this.HOLD_MS        = 380;
    this._xHoldTimer    = null;
    this._xHoldFired    = false;
    this._isBlocking    = false;  // true mientras Q/Shift está presionado

    // ── Sistema de combos ─────────────────────────────────────────────────
    this.comboSystem = new ComboSystem(scene, player, hitboxSystem);

    // ── Cursors ───────────────────────────────────────────────────────────
    this.cursors = scene.input.keyboard.createCursorKeys();

    // ── Z — Combo de puños ────────────────────────────────────────────────
    scene.input.keyboard.on('keydown-Z', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      this.comboSystem.onPunchInput();
    });

    // ── X — tap = Kick | hold > 380ms = Strong ───────────────────────
    scene.input.keyboard.on('keydown-X', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking) return;
      this._xHoldFired = false;
      this._xHoldTimer = scene.time.delayedCall(this.HOLD_MS, () => {
        if (!this.hitboxSystem.isAttacking) {
          this._xHoldFired = true;
          this.hitboxSystem.startAttack('strong');
        }
      });
    });

    scene.input.keyboard.on('keyup-X', () => {
      if (this._xHoldTimer) { this._xHoldTimer.remove(); this._xHoldTimer = null; }
      if (!this._xHoldFired) {
        // Tap rápido → Kick
        if (!this.isAlive || this.isKnockedBack) return;
        if (!this.hitboxSystem.isAttacking) {
          this.hitboxSystem.startAttack('kick');
        }
      }
    });

    // ── C — Spell (special) ──────────────────────────────────────────
    // Prioridad: si hay items usa SpellSystem (efecto de área);
    // si no, dispara el hitbox del 'special' como golpe físico potente.
    scene.input.keyboard.on('keydown-C', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking || this.spellSystem?.isCasting) return;

      const activeSpell = this.spellSystem?.currentSpell || 'fire_rain';
      const SPELL_MP_COST = {
        fire_rain: 15,
        wave:      25,
        nova:      40,
      };
      const cost = SPELL_MP_COST[activeSpell] || 0;

      if (this.itemInventory?.hasSpellType(activeSpell) && this.mp >= cost) {
        this.spellSystem?.activateSpell();
      } else {
        this.hitboxSystem.startAttack('special');
      }
    });

    // ── R / TAB — Cambiar de hechizo activo ───────────────────────────────
    scene.input.keyboard.on('keydown-R', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      this._cycleActiveSpell();
    });

    scene.input.keyboard.on('keydown-TAB', (event) => {
      if (!this.isAlive || this.isKnockedBack) return;
      event.preventDefault();
      this._cycleActiveSpell();
    });

    // ── V — Throw (projectile) ────────────────────────────────────────
    // Lanza el proyectil visual + hitbox de alcance largo.
    scene.input.keyboard.on('keydown-V', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking || this.spellSystem?.isCasting) return;
      this._launchProjectile();
    });

    // ── Q / Shift — Block stance ───────────────────────────────────────
    // Mantener presionado: modo defensa activa (reduce daño al 30%)
    scene.input.keyboard.on('keydown-Q', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking) return;
      this._isBlocking = true;
      this.player.playAnimation('block', 0);
    });
    scene.input.keyboard.on('keyup-Q', () => {
      this._isBlocking = false;
    });
    // Shift como alias de bloqueo
    scene.input.keyboard.on('keydown-SHIFT', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking) return;
      this._isBlocking = true;
      this.player.playAnimation('block', 0);
    });
    scene.input.keyboard.on('keyup-SHIFT', () => {
      this._isBlocking = false;
    });

    // ── SPACE — Usar Quick Slot ───────────────────────────────────────
    scene.input.keyboard.on('keydown-SPACE', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking) return;
      this._useQuickSlot();
    });

    // Escuchar el evento del HUD cuando el jugador hace click/tap en el slot
    scene.events.on('quickslot-use', () => {
      if (!this.isAlive || this.isKnockedBack) return;
      if (this.hitboxSystem.isAttacking) return;
      this._useQuickSlot();
    });
  }

  // ── Update ───────────────────────────────────────────────────────────────

  update(delta) {
    if (!this.isAlive) return;
    this._tickTimers(delta);
    this._handleMovement();
    this._updateAnimation();
    this.hitboxSystem.update();
    this.player.setDepth(this.player.y + 0.1);
  }

  // ── Quick Slot ───────────────────────────────────────────────────────────

  _useQuickSlot() {
    // El HUD dice qué slot está activo
    const slot = this.hud?.getActiveSlot() ?? 'spell';

    if (slot === 'spell') {
      const activeSpell = this.spellSystem?.currentSpell || 'fire_rain';
      if (!this.itemInventory?.hasSpellType(activeSpell)) return;
      this.spellSystem?.activateSpell();
    } else if (slot === 'potion') {
      this._usePotion();
    } else if (slot === 'mana_potion') {
      this._useManaPotion();
    }
  }

  // ── Poción ───────────────────────────────────────────────────────────────

  _usePotion() {
    if (!this.itemInventory?.hasPotion()) return;
    if (this.spellSystem?.isCasting) return;
    if (!this.itemInventory.consumePotion()) return;

    const HEAL = 30;
    this.player.playAnimation('potion', 900);

    this.scene.time.delayedCall(250, () => {
      this.hp = Math.min(this.hp + HEAL, this.maxHp);
      this.scene.events.emit('player-damaged', { 
        hp: this.hp, 
        maxHp: this.maxHp, 
        mp: this.mp, 
        maxMp: this.maxMp 
      });
      this._healVFX(HEAL);
    });
  }

  // ── Poción de Maná ───────────────────────────────────────────────────────

  _useManaPotion() {
    if (!this.itemInventory?.hasManaPotion()) return;
    if (this.spellSystem?.isCasting) return;
    if (!this.itemInventory.consumeManaPotion()) return;

    const RESTORE = 30;
    this.player.playAnimation('potion', 900);

    this.scene.time.delayedCall(250, () => {
      this.mp = Math.min(this.mp + RESTORE, this.maxMp);
      this.scene.events.emit('player-damaged', { 
        hp: this.hp, 
        maxHp: this.maxHp, 
        mp: this.mp, 
        maxMp: this.maxMp 
      });
      this._manaVFX(RESTORE);
    });
  }

  _manaVFX(amount) {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < 14; i++) {
      const dot = this.scene.add.circle(
        px + Phaser.Math.Between(-12, 12),
        py,
        Phaser.Math.Between(3, 7),
        0x0088ff, 0.9
      ).setDepth(200);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-20, 20),
        y: dot.y - Phaser.Math.Between(50, 110),
        alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }

    const txt = this.scene.add.text(px, py - 30, `+${amount} MP`, {
      fontSize: '20px', fontFamily: 'monospace',
      color: '#3399ff', stroke: '#002266', strokeThickness: 4,
    }).setDepth(300).setOrigin(0.5);

    this.scene.tweens.add({
      targets: txt, y: py - 85, alpha: 0,
      duration: 900, ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  _cycleActiveSpell() {
    if (!this.spellSystem || !this.itemInventory) return;

    const spells = ['fire_rain', 'wave', 'nova'];
    const current = this.spellSystem.currentSpell || 'fire_rain';
    const idx = spells.indexOf(current);

    // Encontrar el siguiente spell que el jugador tenga en su inventario
    for (let i = 1; i <= 3; i++) {
      const nextSpell = spells[(idx + i) % 3];
      if (this.itemInventory.hasSpellType(nextSpell)) {
        this.spellSystem.currentSpell = nextSpell;
        // Notificar al HUD
        this.hud?.syncActiveSpell(nextSpell);
        break;
      }
    }
  }

  _healVFX(amount) {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = 0; i < 14; i++) {
      const dot = this.scene.add.circle(
        px + Phaser.Math.Between(-12, 12),
        py,
        Phaser.Math.Between(3, 7),
        0x00ff88, 0.9
      ).setDepth(200);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-20, 20),
        y: dot.y - Phaser.Math.Between(50, 110),
        alpha: 0, scale: 0.3,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }

    const txt = this.scene.add.text(px, py - 30, `+${amount}`, {
      fontSize: '20px', fontFamily: 'monospace',
      color: '#00ff88', stroke: '#004422', strokeThickness: 4,
    }).setDepth(300).setOrigin(0.5);

    this.scene.tweens.add({
      targets: txt, y: py - 85, alpha: 0,
      duration: 900, ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  // ── Daño al jugador ──────────────────────────────────────────────────────

  takeDamage(amount, knockbackVec) {
    if (!this.isAlive)    return;
    if (this.iFrames > 0) return;

    // Bloqueo activo: reduce daño al 30% y no hay hurt animation
    if (this._isBlocking) {
      const reduced = Math.ceil(amount * 0.30);
      this.hp -= reduced;
      this.scene.events.emit('player-damaged', { 
        hp: this.hp, 
        maxHp: this.maxHp, 
        mp: this.mp, 
        maxMp: this.maxMp 
      });
      // Feedback visual de bloqueo
      const flash = this.scene.add.circle(this.player.x, this.player.y - 10, 22, 0x88ddff, 0.7).setDepth(200);
      this.scene.tweens.add({
        targets: flash, alpha: 0, scale: 2, duration: 200,
        onComplete: () => flash.destroy(),
      });
      if (this.hp <= 0) this._onDeath();
      return;
    }

    this.hp -= amount;
    this.scene.events.emit('player-damaged', { 
      hp: this.hp, 
      maxHp: this.maxHp, 
      mp: this.mp, 
      maxMp: this.maxMp 
    });

    if (this.hp <= 0) {
      this._onDeath();
      return;
    }

    this.iFrames = 500;
    this.comboSystem.reset();
    this._isBlocking = false; // El bloqueo siempre se rompe al recibir daño
    this.scene.events.emit('player-hit', { damage: amount });

    // Flash de invencibilidad
    this.scene.tweens.add({
      targets: this.player, alpha: 0,
      duration: 80, ease: 'Linear', yoyo: true, repeat: 3,
      onComplete: () => this.player.setAlpha(1),
    });

    // Knockback
    if (knockbackVec && this.player.body) {
      this.isKnockedBack = true;
      this.player.body.setVelocity(knockbackVec.x * 250, knockbackVec.y * 100);
      this.scene.time.delayedCall(340, () => {
        this.isKnockedBack = false;
        if (this.player.body) this.player.body.setVelocity(0, 0);
      });
    }

    // Animar hurt con lock de 350ms (igual que STATE_DURATION.hurt del enemigo)
    // para que la FSM del jugador sea coherente y la animación se vea completa.
    this.player.playAnimation('hurt', 350);
    this.scene.time.delayedCall(350, () => {
      if (this.isAlive) this.player.playAnimation('idle');
    });
  }

  // ── Movimiento ───────────────────────────────────────────────────────────

  _handleMovement() {
    if (this.isKnockedBack || !this.player.body) return;

    // Pausa total mientras hay una Ninja Card activa (incluido el overlay de resultado,
    // que mantiene ninjaCardData hasta ocultarse). Antes el jugador podía moverse durante
    // la card y al "despausarse" lo hacía antes de que el mensaje desapareciera.
    if (useGameStore.getState().ninjaCardData) {
      this.player.body.setVelocity(0, 0);
      return;
    }

    // Bloquear movimiento durante ataques y spells
    if (this.hitboxSystem.isAttacking || this.spellSystem?.isCasting) {
      this.player.body.setVelocity(0, 0);
      return;
    }

    const { left, right, up, down } = this.cursors;
    let vx = 0, vy = 0;

    if (left.isDown)  vx = -this.speed;
    if (right.isDown) vx =  this.speed;
    if (up.isDown)    vy = -this.speed;
    if (down.isDown)  vy =  this.speed;

    // Normalizar diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    this.player.body.setVelocity(vx, vy);
    if (vx < 0) this.player.sprite.setFlipX(true);
    if (vx > 0) this.player.sprite.setFlipX(false);
  }

  _updateAnimation() {
    // Durante la Ninja Card el jugador está congelado → mantener idle.
    if (useGameStore.getState().ninjaCardData) {
      this.player.playAnimation('idle');
      return;
    }
    // No anular animaciones si hay un combate o bloqueo activo
    if (this.hitboxSystem.isAttacking || this.isKnockedBack) return;
    if (this._isBlocking) {
      // Mantener el stance de bloqueo
      this.player.playAnimation('block', 0);
      return;
    }
    const { left, right, up, down } = this.cursors;
    const moving = left.isDown || right.isDown || up.isDown || down.isDown;
    this.player.playAnimation(moving ? 'walk' : 'idle');
  }

  // ── Timers ───────────────────────────────────────────────────────────────

  _tickTimers(delta) {
    if (this.iFrames > 0) this.iFrames -= delta;
  }

  _launchProjectile() {
    if (!this.itemInventory?.hasThrowingDagger()) {
      // Mostrar texto flotante "¡Sin Dagas!"
      const px = this.player.x;
      const py = this.player.y;
      const txt = this.scene.add.text(px, py - 30, '¡SIN DAGAS!', {
        fontSize: '12px', fontFamily: '"Press Start 2P", monospace',
        color: '#ff4444', stroke: '#000000', strokeThickness: 3,
      }).setDepth(300).setOrigin(0.5);
      this.scene.tweens.add({
        targets: txt, y: py - 70, alpha: 0,
        duration: 800, ease: 'Power2',
        onComplete: () => txt.destroy(),
      });
      return;
    }

    if (!this.itemInventory.consumeThrowingDagger()) return;

    // 1. Reproducir animación 'projectile' (1b fila 5) con lock de 600ms
    this.hitboxSystem.isAttacking = true;
    this.player.playAnimation('projectile', 600);

    const DAMAGE   = 28;
    const facingR  = !this.player.sprite.flipX;
    const dirX     = facingR ? 1 : -1;
    const startX   = this.player.x + dirX * 20;
    const startY   = this.player.y - 12;

    // 2. Visual: círculo brillante que vuela
    const ball = this.scene.add.circle(startX, startY, 7, 0xffee44, 0.95).setDepth(150);
    this.scene.physics.add.existing(ball);
    ball.body.allowGravity = false;
    ball.body.setVelocityX(dirX * 520);

    // Estela
    const trailTimer = this.scene.time.addEvent({
      delay: 30, repeat: 18,
      callback: () => {
        if (!ball.active) return;
        const s = this.scene.add.circle(ball.x, ball.y, 4, 0xff8800, 0.5);
        this.scene.tweens.add({
          targets: s, alpha: 0, scale: 0.2, duration: 200,
          onComplete: () => s.destroy(),
        });
      },
    });

    // 3. Overlap con enemigos — sólo golpea al primero
    let hit = false;
    const overlapRef = this.scene.physics.add.overlap(
      ball,
      this.hitboxSystem.enemyPool.getGroup(),
      (b, enemy) => {
        if (hit || !enemy.active || enemy.fsm === 'dead') return;
        hit = true;
        enemy.takeDamage(DAMAGE, { x: dirX * 1.5, y: -0.1 });
        // Impacto visual
        const fx = this.scene.add.circle(b.x, b.y, 16, 0xffdd44, 0.9).setDepth(200);
        this.scene.tweens.add({
          targets: fx, alpha: 0, scale: 2.5, duration: 220,
          onComplete: () => fx.destroy(),
        });
        ball.destroy();
        trailTimer.remove();
        overlapRef.destroy();
      }
    );

    // 4. Destruir si sale de pantalla (1.2s)
    this.scene.time.delayedCall(1200, () => {
      if (ball.active) { ball.destroy(); trailTimer.remove(); overlapRef.destroy(); }
    });

    // 5. Liberar el flag de atacando al final del lock
    this.scene.time.delayedCall(600, () => {
      this.hitboxSystem.isAttacking = false;
    });
  }

  // ── Muerte ───────────────────────────────────────────────────────────────

  _onDeath() {
    this.isAlive = false;
    this.comboSystem.reset();
    if (this._xHoldTimer) { this._xHoldTimer.remove(); this._xHoldTimer = null; }
    if (this.player.body) this.player.body.setVelocity(0, 0);
    this.player.playAnimation('dead');
    this.scene.time.delayedCall(1200, () => {
      this.scene.events.emit('player-dead');
    });
  }
}
