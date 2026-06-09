import { PLAYER_ATTACKS as ATTACK_DEFINITIONS } from '../config/NPCConfig';

export default class HitboxSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Container} player
   * @param {EnemyPool} enemyPool
   */
  constructor(scene, player, enemyPool) {
    this.scene     = scene;
    this.player    = player; // PlayerSprite (Container)
    this.enemyPool = enemyPool;

    this.currentAttack = null;    // qué ataque está activo ahora
    this.isAttacking   = false;

    // Set de enemigos ya golpeados en este swing
    this.hitEnemiesThisSwing = new Set();

    // ── Crear el sprite invisible que actúa como hitbox ───────────────────
    this.hitboxSprite = scene.physics.add.sprite(0, 0, null)
      .setVisible(false)
      .setActive(false);

    this.hitboxSprite.body.enable = false;

    // ── Registrar overlap ──
    scene.physics.add.overlap(
      this.hitboxSprite,
      this.enemyPool.getGroup(),
      this._onHit.bind(this),
      this._processOverlap.bind(this),
      this
    );

    // ── Escuchar frames de animación del jugador ──
    // IMPORTANTE: el PlayerSprite tiene un sprite interno
    this.player.sprite.on('animationupdate', this._onAnimationFrame.bind(this));
    this.player.sprite.on('animationcomplete', this._onAnimationComplete.bind(this));
  }

  startAttack(attackType) {
    if (this.isAttacking) return;

    const def = ATTACK_DEFINITIONS[attackType];
    if (!def) return;

    this.isAttacking   = true;
    this.currentAttack = { type: attackType, def };
    this.hitEnemiesThisSwing.clear();

    // Intentar animar con el sheet 'combo' (1d) primero; luego 'combat' (1b)
    const charId = this.player.characterId || '1';
    const comboKey  = `char-${charId}-${attackType}`; // e.g. char-1-combo1
    const fallbackKey = attackType;                    // PlayerSprite prependea char-id

    if (this.player.scene.anims.exists(comboKey)) {
      this.player.playAnimation(attackType, 0); // PlayerSprite resuelve la key completa
    } else {
      this.player.playAnimation(attackType, 0);
    }
  }

  _onAnimationFrame(animation, frame) {
    if (!this.isAttacking || !this.currentAttack) return;

    const def          = this.currentAttack.def;
    const frameIndex   = frame.index;
    const isActive     = def.activeFrames.includes(frameIndex);

    if (isActive) {
      this._activateHitbox(def);
    } else {
      this._deactivateHitbox();
    }
  }

  _onAnimationComplete(animation) {
    const attackKeys = Object.keys(ATTACK_DEFINITIONS);
    // Verificar si la animación terminada es una de ataque
    // Las animaciones en PlayerSprite tienen prefijo char-{id}-
    if (attackKeys.some(key => animation.key.includes(key))) {
      this._deactivateHitbox();
      this.isAttacking   = false;
      this.currentAttack = null;
    }
  }

  _activateHitbox(def) {
    const facingRight = !this.player.sprite.flipX;
    const dirX        = facingRight ? 1 : -1;

    const hx = this.player.x + def.offsetX * dirX;
    const hy = this.player.y + def.offsetY;

    this.hitboxSprite
      .setPosition(hx, hy)
      .setActive(true);

    this.hitboxSprite.body.enable = true;
    this.hitboxSprite.body.setSize(def.width, def.height);
    this.hitboxSprite.body.reset(hx, hy);
  }

  _deactivateHitbox() {
    this.hitboxSprite.body.enable = false;
    this.hitboxSprite.setActive(false);
    this.hitEnemiesThisSwing.clear();
  }

  _processOverlap(hitboxSprite, enemy) {
    if (!enemy.active)                         return false;
    if (enemy.fsm === 'dead')                  return false;
    if (this.hitEnemiesThisSwing.has(enemy))   return false;
    return true;
  }

  _onHit(hitboxSprite, enemy) {
    const def = this.currentAttack?.def;
    if (!def) return;

    this.hitEnemiesThisSwing.add(enemy);

    const dirX     = !this.player.sprite.flipX ? 1 : -1;
    const knockback = {
      x: def.knockback.x * dirX,
      y: def.knockback.y,
    };

    enemy.takeDamage(def.damage, knockback);

    this._spawnHitEffect(enemy.x, enemy.y, def.damage);

    // Hitstop configurable por ataque
    const stopMs = def.hitStopMs ?? 80;
    if (stopMs > 0) this._applyHitstop(stopMs);

    // Screen shake en ataques pesados
    if (def.screenShake) {
      this.scene.cameras.main.shake(200, 0.010);
    }

    this.scene.events.emit('player-hit', {
      damage:  def.damage,
      attack:  this.currentAttack.type,
      enemyId: enemy.npcId,
    });
  }

  _spawnHitEffect(x, y, damage) {
    const flash = this.scene.add.circle(x, y, 18, 0xffdd00, 0.9);
    this.scene.tweens.add({
      targets:  flash,
      alpha:    0,
      scale:    2,
      duration: 150,
      onComplete: () => flash.destroy(),
    });

    const dmgText = this.scene.add.text(x, y - 20, `-${damage}`, {
      fontSize:   '16px',
      fontFamily: 'monospace',
      color:      damage >= 30 ? '#ff4444' : '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setDepth(200);

    this.scene.tweens.add({
      targets:  dmgText,
      y:        y - 60,
      alpha:    0,
      duration: 600,
      ease:     'Power2',
      onComplete: () => dmgText.destroy(),
    });
  }

  _applyHitstop(durationMs) {
    this.scene.physics.pause();
    this.scene.time.delayedCall(durationMs, () => {
      this.scene.physics.resume();
    });
  }

  update() {
    if (!this.isAttacking || !this.hitboxSprite.active) return;

    const def    = this.currentAttack?.def;
    if (!def) return;

    const dirX = !this.player.sprite.flipX ? 1 : -1;
    this.hitboxSprite.setPosition(
      this.player.x + def.offsetX * dirX,
      this.player.y + def.offsetY,
    );
  }

  enableDebug() {
    if (this.debugGraphics) return;
    this.debugGraphics = this.scene.add.graphics();
    this.scene.events.on('postupdate', () => {
      this.debugGraphics.clear();
      if (!this.hitboxSprite.active) return;

      const b = this.hitboxSprite.body;
      this.debugGraphics.lineStyle(2, 0xffff00, 0.8);
      this.debugGraphics.strokeRect(b.x, b.y, b.width, b.height);

      this.enemyPool.getActiveList().forEach(e => {
        const eb = e.body;
        if (eb) {
          this.debugGraphics.lineStyle(1, 0xff4444, 0.5);
          this.debugGraphics.strokeRect(eb.x, eb.y, eb.width, eb.height);
        }
      });
    });
  }
}
