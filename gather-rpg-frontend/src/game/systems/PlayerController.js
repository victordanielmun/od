// Ventana de tiempo para registrar un combo (ms)
const COMBO_WINDOW   = 350;
// Tiempo mínimo entre ataques del mismo tipo
const ATTACK_COOLDOWN = 200;

// Mapa de secuencias de combo → ataque especial resultante
const COMBO_MAP = {
  'punch,punch,punch': 'strong',   // 3 jabs → uppercut
  'punch,kick':        'kick',     // jab + patada → patada potente
};

export default class PlayerController {
  /**
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Container} player
   * @param {HitboxSystem} hitboxSystem
   */
  constructor(scene, player, hitboxSystem) {
    this.scene        = scene;
    this.player       = player; // PlayerSprite (Container)
    this.hitboxSystem = hitboxSystem;

    // ── Estado del jugador ────────────────────────────────────────────────
    this.hp            = 100;
    this.maxHp         = 100;
    this.isAlive       = true;
    this.isKnockedBack = false;   // mientras recibe knockback no puede moverse
    this.iFrames       = 0;       // frames de invencibilidad tras recibir daño

    // ── Estado de ataque ──────────────────────────────────────────────────
    this.attackCooldown  = 0;
    this.comboBuffer     = [];    // historial de ataques recientes
    this.comboTimer      = null;  // temporizador que limpia el buffer

    // ── Velocidad de movimiento ───────────────────────────────────────────
    this.speed = 160;

    // ── Crear cursors + teclas de ataque ──────────────────────────────────
    this.cursors = scene.input.keyboard.createCursorKeys();
    
    // ── Registrar inputs de ataque ──
    scene.input.keyboard.on('keydown-Z', () => this._onAttackInput('punch'));
    scene.input.keyboard.on('keydown-X', () => this._onAttackInput('kick'));
    scene.input.keyboard.on('keydown-C', () => this._onAttackInput('strong'));
  }

  update(delta) {
    if (!this.isAlive) return;

    this._tickTimers(delta);
    this._handleMovement();
    this._updateAnimation();
    this.hitboxSystem.update();

    // Depth sort
    this.player.setDepth(this.player.y + 0.1);
  }

  takeDamage(amount, knockbackVec) {
    if (!this.isAlive)   return;
    if (this.iFrames > 0) return;

    this.hp -= amount;
    this.scene.events.emit('player-damaged', { hp: this.hp, maxHp: this.maxHp });

    if (this.hp <= 0) {
      this._onDeath();
      return;
    }

    this.iFrames = 500;

    this.scene.tweens.add({
      targets:   this.player,
      alpha:     0,
      duration:  80,
      ease:      'Linear',
      yoyo:      true,
      repeat:    3,
      onComplete: () => this.player.setAlpha(1),
    });

    if (knockbackVec && this.player.body) {
      this.isKnockedBack = true;
      this.player.body.setVelocity(
        knockbackVec.x * 250,
        knockbackVec.y * 100,
      );
      this.scene.time.delayedCall(350, () => {
        this.isKnockedBack = false;
        if (this.player.body) this.player.body.setVelocity(0, 0);
      });
    }

    this.player.playAnimation('hurt');
  }

  _onAttackInput(type) {
    if (!this.isAlive)          return;
    if (this.isKnockedBack)     return;
    if (this.attackCooldown > 0) return;

    this.comboBuffer.push(type);

    if (this.comboTimer) this.comboTimer.remove();
    this.comboTimer = this.scene.time.delayedCall(
      COMBO_WINDOW,
      () => { this.comboBuffer = []; }
    );

    const resolved = this._resolveCombo();
    this.hitboxSystem.startAttack(resolved);
    this.attackCooldown = ATTACK_COOLDOWN;

    this.scene.events.emit('combo-input', {
      attack: resolved,
      buffer: [...this.comboBuffer],
    });
  }

  _resolveCombo() {
    const key = this.comboBuffer.join(',');
    return COMBO_MAP[key] ?? this.comboBuffer[this.comboBuffer.length - 1];
  }

  _handleMovement() {
    if (this.isKnockedBack || !this.player.body) return;
    
    if (this.hitboxSystem.isAttacking) {
      this.player.body.setVelocity(0, 0);
      return;
    }

    const { left, right, up, down } = this.cursors;
    let vx = 0, vy = 0;

    if (left.isDown)  vx = -this.speed;
    if (right.isDown) vx =  this.speed;
    if (up.isDown)    vy = -this.speed;
    if (down.isDown)  vy =  this.speed;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    this.player.body.setVelocity(vx, vy);

    if (vx < 0) this.player.sprite.setFlipX(true);
    if (vx > 0) this.player.sprite.setFlipX(false);
  }

  _updateAnimation() {
    if (this.hitboxSystem.isAttacking || this.isKnockedBack) return;

    const { left, right, up, down } = this.cursors;
    const isMoving = left.isDown || right.isDown || up.isDown || down.isDown;
    const nextAnim = isMoving ? 'walk' : 'idle';

    this.player.playAnimation(nextAnim);
  }

  _tickTimers(delta) {
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.iFrames > 0)        this.iFrames        -= delta;
  }

  _onDeath() {
    this.isAlive = false;
    if (this.player.body) this.player.body.setVelocity(0, 0);

    this.player.playAnimation('dead');

    this.scene.time.delayedCall(1200, () => {
      this.scene.events.emit('player-dead');
    });
  }
}
