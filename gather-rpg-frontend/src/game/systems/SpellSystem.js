/**
 * SpellSystem — Sistema de Spells de área
 *
 * Conecta la animación 'special' del personaje con tres efectos de área:
 *   FIRE_RAIN  → 18 bolas de fuego que caen desde arriba
 *   WAVE       → Ola mágica horizontal que barre la pantalla
 *   NOVA       → Explosión radial desde el jugador
 *
 * Cada spell consume 1 item del inventario.
 * Visual: Phaser primitivas/partículas (sin assets externos necesarios)
 * Hitbox: Physics bodies independientes del visual
 */

export const SPELL_TYPES = {
  FIRE_RAIN: 'fire_rain',
  WAVE:      'wave',
  NOVA:      'nova',
};

const SPELL_DAMAGE = {
  fire_rain: 12,
  wave:      25,
  nova:      40,
};

export default class SpellSystem {
  /**
   * @param {Phaser.Scene}   scene
   * @param {PlayerSprite}   player
   * @param {EnemyPool}      enemyPool
   * @param {ItemInventory}  inventory
   */
  constructor(scene, player, enemyPool, inventory) {
    this.scene         = scene;
    this.player        = player;
    this.enemyPool     = enemyPool;
    this.inventory     = inventory;
    this.isCasting     = false;
    // Si el jugador solo trae UN tipo de pergamino, se equipa solo — no tiene
    // sentido obligarlo a cambiar con R/TAB para "elegir" entre una opción.
    // Con 2+ tipos se mantiene el default (fire_rain) y el jugador cicla a mano.
    this.currentSpell  = this._pickSoleSpellType() || SPELL_TYPES.FIRE_RAIN;

    // Si el tipo activo se agota y solo queda un tipo con existencias, se
    // auto-cambia a ese (mismo criterio de arriba, disparado por drops/loot).
    this._onInventoryChanged = () => {
      const sole = this._pickSoleSpellType();
      if (sole && sole !== this.currentSpell && !this.inventory.hasSpellType(this.currentSpell)) {
        this.currentSpell = sole;
        this.scene.events.emit('spell-auto-equipped', sole);
      }
    };
    this.scene.events.on('inventory-changed', this._onInventoryChanged, this);
  }

  destroy() {
    this.scene.events.off('inventory-changed', this._onInventoryChanged, this);
  }

  // Devuelve el único tipo de hechizo con existencias, o null si hay 0 o 2+ tipos.
  _pickSoleSpellType() {
    const owned = Object.entries(this.inventory.spells || {}).filter(([, qty]) => qty > 0);
    return owned.length === 1 ? owned[0][0] : null;
  }

  // ── API Pública ──────────────────────────────────────────────────────────

  activateSpell() {
    if (this.isCasting)                    return;

    const playerCtrl = this.scene.playerCtrl;
    if (!playerCtrl) return;

    const activeSpell = this.currentSpell || SPELL_TYPES.FIRE_RAIN;
    const SPELL_MP_COST = {
      fire_rain: 15,
      wave:      25,
      nova:      40,
    };
    const cost = SPELL_MP_COST[activeSpell] || 0;

    // 1. Validar maná suficiente
    if (playerCtrl.mp < cost) {
      return;
    }

    // 2. Validar que se tenga el scroll correspondiente en el inventario
    if (!this.inventory.hasSpellType(activeSpell)) {
      return;
    }

    // 3. Consumir maná
    playerCtrl.mp -= cost;
    this.isCasting = true;

    // Actualizar barra de maná en el HUD
    this.scene.events.emit('player-damaged', {
      hp: playerCtrl.hp,
      maxHp: playerCtrl.maxHp,
      mp: playerCtrl.mp,
      maxMp: playerCtrl.maxMp
    });

    // 4. Reproducir animación 'special' en el personaje (lock 1200ms)
    this.player.playAnimation('special', 1200);

    // 5. Al frame de lanzamiento (~250ms = frame 3 a 12fps) → disparar efecto
    this.scene.time.delayedCall(250, () => {
      this._castEffect(activeSpell);
    });

    // 6. Desbloquear al terminar
    this.scene.time.delayedCall(1200, () => {
      this.isCasting = false;
      // Recién ahora: si se llama mientras el 'special' sigue bloqueado, la
      // animación de poción no alcanza a jugarse (playAnimation ignora keys
      // sin prioridad mientras hay un lock activo — ver PlayerSprite).
      playerCtrl._checkAutoManaPotion?.();
    });
  }

  // ── Efectos ──────────────────────────────────────────────────────────────

  _castEffect(type) {
    switch (type) {
      case SPELL_TYPES.FIRE_RAIN: this._fireRain(); break;
      case SPELL_TYPES.WAVE:      this._waveSpell(); break;
      case SPELL_TYPES.NOVA:      this._novaSpell(); break;
    }
  }

  // ── Lluvia de Fuego ──────────────────────────────────────────────────────
  _fireRain() {
    const DROPS  = 18;
    const DAMAGE = SPELL_DAMAGE.fire_rain;
    const hitSet = new Set(); // evitar doble daño por bola

    this._screenFlash(0xff2200, 0.3, 200);

    this.scene.time.addEvent({
      delay:    120,
      repeat:   DROPS - 1,
      callback: () => {
        const x = Phaser.Math.Between(60, 740);

        // Visual: círculo naranja-rojo
        const ball = this.scene.add.circle(x, -20, 9, 0xff4400, 0.95);
        this.scene.physics.add.existing(ball);
        ball.body.allowGravity = false;
        ball.body.setVelocity(Phaser.Math.Between(-20, 20), 420);

        // Cola de chispa simple
        const trail = this.scene.add.graphics();
        trail.fillStyle(0xff8800, 0.4);
        trail.fillCircle(0, 0, 6);
        trail.x = x; trail.y = -20;

        // Overlap con enemigos
        const overlapRef = this.scene.physics.add.overlap(
          ball,
          this.enemyPool.getGroup(),
          (b, enemy) => {
            if (!enemy.active || enemy.fsm === 'dead') return;
            if (hitSet.has(enemy)) return;
            hitSet.add(enemy);
            enemy.takeDamage(DAMAGE, { x: 0, y: -0.2 });
            this._impactFX(b.x, b.y, 0xff4400);
            b.destroy();
            trail.destroy();
            overlapRef.destroy();
            // Limpiar el flag después de 300ms para permitir nuevas bolas
            this.scene.time.delayedCall(300, () => hitSet.delete(enemy));
          }
        );

        // Destruir al salir de pantalla
        this.scene.time.delayedCall(2000, () => {
          if (ball.active) { ball.destroy(); trail.destroy(); overlapRef.destroy(); }
        });

        // Seguir al ball con el trail en preUpdate
        const updateFn = () => {
          if (ball.active) { trail.x = ball.x; trail.y = ball.y - 8; }
        };
        this.scene.events.once('postupdate', updateFn);
      }
    });
  }

  // ── Ola Mágica ───────────────────────────────────────────────────────────
  _waveSpell() {
    const DAMAGE     = SPELL_DAMAGE.wave;
    const facingRight = !this.player.sprite.flipX;
    const dirX       = facingRight ? 1 : -1;
    const startX     = this.player.x + (dirX * 30);
    const startY     = this.player.y - 10;
    const hitSet     = new Set();

    this._screenFlash(0x4488ff, 0.25, 150);

    // Visual: rectángulo de energía con gradiente simulado
    const wave = this.scene.add.rectangle(startX, startY, 80, 55, 0x44aaff, 0.75);
    wave.setStrokeStyle(3, 0x88ddff, 1);
    this.scene.physics.add.existing(wave);
    wave.body.allowGravity = false;
    wave.body.setVelocityX(dirX * 340);

    // Partículas de estela (círculos pequeños)
    const trailTimer = this.scene.time.addEvent({
      delay:    60,
      repeat:   22,
      callback: () => {
        if (!wave.active) return;
        const spark = this.scene.add.circle(wave.x, wave.y, 5, 0x88ccff, 0.7);
        this.scene.tweens.add({
          targets: spark, alpha: 0, scale: 0.3,
          duration: 350,
          onComplete: () => spark.destroy(),
        });
      }
    });

    // Overlap
    const overlapRef = this.scene.physics.add.overlap(
      wave,
      this.enemyPool.getGroup(),
      (w, enemy) => {
        if (!hitSet.has(enemy) && enemy.active && enemy.fsm !== 'dead') {
          hitSet.add(enemy);
          enemy.takeDamage(DAMAGE, { x: dirX * 1.5, y: -0.3 });
          this._impactFX(enemy.x, enemy.y, 0x44aaff);
        }
      }
    );

    // Destruir tras 1.3s
    this.scene.time.delayedCall(1300, () => {
      wave.destroy();
      trailTimer.remove();
      overlapRef.destroy();
    });
  }

  // ── Nova Radial ──────────────────────────────────────────────────────────
  _novaSpell() {
    const DAMAGE  = SPELL_DAMAGE.nova;
    const px      = this.player.x;
    const py      = this.player.y;
    const hitSet  = new Set();
    const MAX_RAD = 160;

    this._screenFlash(0xaa44ff, 0.5, 120);
    this.scene.cameras.main.shake(300, 0.015);

    // Visual: aro que se expande
    const ring = this.scene.add.graphics();
    let radius = 10;

    const expandTimer = this.scene.time.addEvent({
      delay:    16,
      repeat:   30,
      callback: () => {
        ring.clear();
        radius += (MAX_RAD - 10) / 30;
        ring.lineStyle(4, 0xaa44ff, Math.max(0, 1 - radius / MAX_RAD));
        ring.strokeCircle(px, py, radius);
        ring.fillStyle(0xcc88ff, 0.08);
        ring.fillCircle(px, py, radius);

        // Detectar enemigos dentro del radio
        this.enemyPool.getActiveList().forEach(enemy => {
          if (hitSet.has(enemy)) return;
          const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
          if (dist <= radius) {
            hitSet.add(enemy);
            const dist2 = Math.max(dist, 1);
            const knockDir = {
              x: (enemy.x - px) / dist2,
              y: (enemy.y - py) / dist2 * 0.5,
            };
            enemy.takeDamage(DAMAGE, knockDir);
            this._impactFX(enemy.x, enemy.y, 0xaa44ff);
          }
        });
      }
    });

    // Partículas radiales (disparadas una vez)
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const spark = this.scene.add.circle(px, py, 6, 0xdd88ff, 0.9);
      const speed = Phaser.Math.Between(180, 360);
      this.scene.tweens.add({
        targets:  spark,
        x:        px + Math.cos(angle) * speed * 0.6,
        y:        py + Math.sin(angle) * speed * 0.6,
        alpha:    0,
        scale:    0.2,
        duration: 500,
        ease:     'Power2',
        onComplete: () => spark.destroy(),
      });
    }

    this.scene.time.delayedCall(500, () => {
      ring.destroy();
      expandTimer.remove();
    });
  }

  // ── Helpers visuales ─────────────────────────────────────────────────────

  _impactFX(x, y, color) {
    const c = this.scene.add.circle(x, y, 12, color, 0.85);
    this.scene.tweens.add({
      targets: c, alpha: 0, scale: 2.5,
      duration: 220,
      onComplete: () => c.destroy(),
    });

    // Texto de daño
    const type = this.currentSpell;
    const dmg  = SPELL_DAMAGE[type] ?? 0;
    if (dmg > 0) {
      const txt = this.scene.add.text(x, y - 20, `-${dmg}`, {
        fontSize: '15px', fontFamily: 'monospace',
        color: '#ff88ff', stroke: '#330033', strokeThickness: 3,
      }).setDepth(300);
      this.scene.tweens.add({
        targets: txt, y: y - 60, alpha: 0,
        duration: 700, ease: 'Power2',
        onComplete: () => txt.destroy(),
      });
    }
  }

  _screenFlash(color, alpha, duration) {
    const flash = this.scene.add.rectangle(400, 300, 800, 600, color, alpha)
      .setDepth(999);
    this.scene.tweens.add({
      targets: flash, alpha: 0,
      duration,
      onComplete: () => flash.destroy(),
    });
  }
}
