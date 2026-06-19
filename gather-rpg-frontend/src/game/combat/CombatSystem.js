import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';

export class CombatSystem {
  constructor(scene, enemySystem) {
    this.scene = scene;
    this.enemySystem = enemySystem;

    // HP & MP & Stat states
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerMp = 100;
    this.playerMaxMp = 100;
    this.playerAttackIFrames = 0;
    this.isDead = false;
    this.isStunned = false;

    // Attack timers & combos
    this._lastAttackTime = 0;
    this._lastComboTime = 0;
    this._comboStep = 0;
    this._lastSpellTime = 0;
    this._lastThrowTime = 0;
    this._lastPotionTime = 0;
    this._lastManaPotionTime = 0;
    this._lastDashTime = 0;
    this.dashVelocity = { x: 0, y: 0 };
    this.isDashing = false;

    this.hpBar = null;
    this.hpText = null;
    this.mpText = null;

    // Events
    this.onNinjaCardResult = (e) => this._handleNinjaCardResult(e);
    window.addEventListener('ninja-card-result', this.onNinjaCardResult);

    this.onEnemyAttack = (data) => this._handleEnemyAttack(data);
    this.scene.events.on('enemy-attack', this.onEnemyAttack);

    // HP autoritativo del servidor (E2): el server manda el HP y la muerte.
    this.onPlayerHP = (e) => this._handlePlayerHP(e);
    window.addEventListener('player-hp-update', this.onPlayerHP);
    this.onPlayerDiedServer = () => this.onPlayerDeath();
    window.addEventListener('player-died-server', this.onPlayerDiedServer);

    // Initial HP bar setup
    this.setupHUD();

    // Scale resize listener to keep HP/MP bars at the bottom
    this.onResize = () => this.updateHpBar();
    this.scene.scale.on('resize', this.onResize, this);
  }

  destroy() {
    window.removeEventListener('ninja-card-result', this.onNinjaCardResult);
    window.removeEventListener('player-hp-update', this.onPlayerHP);
    window.removeEventListener('player-died-server', this.onPlayerDiedServer);
    this.scene.events.off('enemy-attack', this.onEnemyAttack);
    if (this.onResize) {
      this.scene.scale.off('resize', this.onResize, this);
    }
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpText) this.hpText.destroy();
    if (this.mpText) this.mpText.destroy();
  }

  setupHUD() {
    this.hpBar = this.scene.add.graphics();
    this.hpBar.setScrollFactor(0);
    this.hpBar.setDepth(200000);
    this.updateHpBar();
  }

  update(delta) {
    if (this.playerAttackIFrames > 0) {
      this.playerAttackIFrames -= delta;
    }

    // Auto MP Regen (+5 MP per second)
    if (this.playerMp < this.playerMaxMp && !this.isDead) {
      this._mpRegenTimer = (this._mpRegenTimer || 0) + delta;
      if (this._mpRegenTimer >= 1000) {
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + 5);
        this._mpRegenTimer = 0;
        this.updateHpBar();
      }
    }
  }

  updateHpBar() {
    if (!this.hpBar) return;
    
    this.hpBar.clear();
    
    const x = 20;
    const screenHeight = this.scene.scale.height;
    const bottomY = screenHeight - 46;
    
    const y = bottomY;
    const w = 120;
    const h = 10;
    
    // Background for HP (Border)
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
    this.hpBar.lineStyle(1.5, 0xffd700, 1);
    this.hpBar.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);

    // Health bar fill
    const fillWidth = (this.playerHp / this.playerMaxHp) * w;
    const color = this.playerHp < 30 ? 0xff3333 : (this.playerHp < 60 ? 0xffcc33 : 0x33ff33);
    
    this.hpBar.fillStyle(color, 1);
    if (fillWidth > 0) {
      this.hpBar.fillRoundedRect(x, y, fillWidth, h, 3);
    }

    // --- Mana Bar Setup ---
    const my = bottomY + h + 6;
    const mh = 8;

    // Background for MP (Border)
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRoundedRect(x - 3, my - 3, w + 6, mh + 6, 4);
    this.hpBar.lineStyle(1.5, 0x00aaff, 1); // Blue border for mana
    this.hpBar.strokeRoundedRect(x - 3, my - 3, w + 6, mh + 6, 4);

    // Mana bar fill
    const mpFillWidth = (this.playerMp / this.playerMaxMp) * w;
    this.hpBar.fillStyle(0x0066ff, 1);
    if (mpFillWidth > 0) {
      this.hpBar.fillRoundedRect(x, my, mpFillWidth, mh, 2);
    }
  }

  _handleNinjaCardResult(e) {
    const { correct, effect, damage, duration } = e.detail;
    console.log(`[CombatSystem] NinjaCard Result: correct=${correct}, effect=${effect}, damage=${damage}, duration=${duration}`);
    
    if (!correct) {
      if (effect === 'player_takes_damage') {
        // El daño lo aplica el servidor (manda player_hp / player_died). Aquí
        // solo reproducimos el feedback visual.
        if (this.scene.player) {
          this.scene.player.playAnimation('hurt', 400);
          if (this.scene.player.sprite) this.scene.player.sprite.setTint(0xff4444);
          this.scene.time.delayedCall(400, () => {
            if (this.scene.player?.sprite) this.scene.player.sprite.clearTint();
            if (!this.isDead && this.scene.player) {
              this.scene.player._animLocked = false;
              this.scene.player.playAnimation('idle');
            }
          });
        }
      } else if (effect === 'player_is_stunned') {
        const dur = duration || 3000;
        console.log(`[CombatSystem] Player stunned from incorrect Ninja Card for ${dur}ms`);
        this.isStunned = true;
        if (this.scene.player && this.scene.player.body) {
          this.scene.player.body.setVelocity(0, 0);
          this.scene.player.playAnimation('idle');
        }
        if (this.scene.player && this.scene.player.sprite) {
          this.scene.player.sprite.setTint(0xffff44);
        }
        
        this.scene.time.delayedCall(dur, () => {
          console.log('[CombatSystem] Player stun expired');
          this.isStunned = false;
          if (this.scene.player && this.scene.player.sprite) {
            this.scene.player.sprite.clearTint();
          }
        });
      }
    }
  }

  _handleEnemyAttack(data) {
    if (this.isDead || this.scene.isSpectating) return;
    if (this.playerAttackIFrames > 0) return;
    this.playerAttackIFrames = 800; // throttle local de reportes (el server también valida i-frames)

    // El daño/HP/muerte los decide el SERVIDOR. Solo reportamos el golpe con el
    // enemigo que conectó; el server aplica su daño y nos manda el HP (player_hp).
    const enemyInstanceId = data?.enemy?.config?.instance_id;
    if (enemyInstanceId) {
      useGameStore.getState().sendPlayerHit(enemyInstanceId);
    }

    // Feedback visual local (hurt/tint).
    if (this.scene.player) {
      this.scene.player.playAnimation('hurt', 400);
      if (this.scene.player.sprite) {
        this.scene.player.sprite.setTint(0xff4444);
      }
      this.scene.time.delayedCall(400, () => {
        if (this.scene.player?.sprite) this.scene.player.sprite.clearTint();
        if (!this.isDead && this.scene.player) {
          this.scene.player._animLocked = false;
          this.scene.player.playAnimation('idle');
        }
      });
    }
  }

  _handlePlayerHP(e) {
    const { hp, hp_max } = e.detail || {};
    if (typeof hp === 'number') this.playerHp = hp;
    if (typeof hp_max === 'number' && hp_max > 0) this.playerMaxHp = hp_max;
    this.updateHpBar();
  }

  onPlayerDeath() {
    console.log("[CombatSystem] Player death (server-authoritative)");
    if (this.isDead || useGameStore.getState().ninjaCardData) return;
    
    this.isDead = true;
    
    if (this.scene.player) {
      this.scene.player.playAnimation('die');
      if (this.scene.player.body) this.scene.player.body.setVelocity(0, 0);
    }
    
    this.scene.time.delayedCall(1200, () => {
      window.dispatchEvent(new CustomEvent('player-dead'));
    });
  }

  resetDeathState() {
    this.isDead = false;
    this.isStunned = false;
    this.playerHp = 100;
    this.playerMp = 100;
    this.updateHpBar();
  }

  handlePlayerAttack() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    const now = this.scene.time.now;
    if (now - (this._lastAttackTime || 0) < 500) return;
    this._lastAttackTime = now;

    const charId = this.scene.player.characterId || '1';
    const slashKey = `char-${charId}-slash`;
    if (this.scene.anims.exists(slashKey)) {
      this.scene.player.playAnimation('slash', 500);
    }

    let nearestEnemy = null;
    let minDist = 120;

    this.enemySystem.activeEnemies.forEach((enemy, id) => {
      if (!enemy.active || enemy.fsm === 'dead') return;
      const dist = window.Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y);
      if (dist < minDist) {
        nearestEnemy = { id, enemy };
        minDist = dist;
      }
    });

    if (nearestEnemy) {
      console.log(`[CombatSystem] Hit enemy ${nearestEnemy.id} at dist ${minDist.toFixed(1)}px`);
      useGameStore.getState().sendPlayerAttack(nearestEnemy.id, 'basic');
      
      const hitEnemy = nearestEnemy.enemy;
      if (hitEnemy.sprite) {
        hitEnemy.sprite.setTint(0xff2222);
        this.scene.time.delayedCall(200, () => {
          if (hitEnemy.active && hitEnemy.sprite) hitEnemy.sprite.clearTint();
        });
      }
      this._spawnHitEffect(hitEnemy.x, hitEnemy.y);
    }
  }

  handlePlayerCombo() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    const now = this.scene.time.now;
    if (now - (this._lastComboTime || 0) > 1000) {
      this._comboStep = 0;
    }

    const charId = this.scene.player.characterId || '1';
    let animKey = 'combo1';
    let hitRange = 120;
    let lockDuration = 400;

    if (this._comboStep === 0) {
      animKey = 'combo1';
      this._comboStep = 1;
    } else if (this._comboStep === 1) {
      animKey = 'combo2';
      this._comboStep = 2;
    } else if (this._comboStep === 2) {
      animKey = 'combo3_finisher';
      hitRange = 160;
      lockDuration = 600;
      this._comboStep = 0;
    }

    this._lastComboTime = now;

    const animKeyFull = `char-${charId}-${animKey}`;
    if (this.scene.anims.exists(animKeyFull)) {
      this.scene.player.playAnimation(animKey, lockDuration);
    }

    let nearestEnemy = null;
    let minDist = hitRange;
    this.enemySystem.activeEnemies.forEach((enemy, id) => {
      if (!enemy.active || enemy.fsm === 'dead') return;
      const dist = window.Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y);
      if (dist < minDist) {
        nearestEnemy = { id, enemy };
        minDist = dist;
      }
    });

    if (nearestEnemy) {
      console.log(`[CombatSystem Combo] Hit enemy ${nearestEnemy.id} via combo ${animKey}`);
      useGameStore.getState().sendPlayerAttack(nearestEnemy.id, animKey);
      
      const hitEnemy = nearestEnemy.enemy;
      if (hitEnemy.sprite) {
        hitEnemy.sprite.setTint(0xff2222);
        this.scene.time.delayedCall(200, () => {
          if (hitEnemy.active && hitEnemy.sprite) hitEnemy.sprite.clearTint();
        });
      }
      this._spawnHitEffect(hitEnemy.x, hitEnemy.y);
    }
  }

  handlePlayerSpell() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    // Check inventory for a Scroll item
    const inventory = useGameStore.getState().inventory || [];
    const scrollEntry = inventory.find(inv => inv.item?.item_type === 'scroll' && inv.quantity > 0);
    if (!scrollEntry) {
      useNotificationStore.getState().addNotification('warning', 'Necesitas un Pergamino de Habilidad en tu inventario para lanzar un hechizo.');
      return;
    }

    // Check Mana cost (30 MP)
    if (this.playerMp < 30) {
      useNotificationStore.getState().addNotification('warning', 'No tienes suficiente Maná para lanzar un hechizo (requiere 30 MP).');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastSpellTime || 0) < 4000) return;
    this._lastSpellTime = now;

    // El pergamino es tu "libro de hechizos": basta con poseerlo. Lanzar cuesta
    // MP, no consume el scroll (es un item grant_skill de un solo uso; gastarlo en
    // cada cast provocaba un 500 al re-desbloquear la habilidad ya aprendida).
    this.playerMp -= 30;
    this.updateHpBar();

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-special`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('special', 800);
    }

    this.scene.cameras.main.shake(400, 0.012);

    const magicGfx = this.scene.add.graphics({ x: this.scene.player.x, y: this.scene.player.y });
    magicGfx.setDepth(this.scene.player.depth - 1);
    magicGfx.lineStyle(4, 0x9933ff, 0.9);
    magicGfx.strokeCircle(0, 0, 100);
    magicGfx.lineStyle(2, 0xcc99ff, 0.6);
    magicGfx.strokeCircle(0, 0, 60);
    magicGfx.strokeCircle(0, 0, 140);
    
    magicGfx.lineStyle(1.5, 0xcc99ff, 0.4);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      magicGfx.lineBetween(0, 0, Math.cos(angle) * 140, Math.sin(angle) * 140);
    }
    
    magicGfx.setScale(0.2);
    magicGfx.setAlpha(0.8);
    this.scene.tweens.add({
      targets: magicGfx,
      scale: 1.2,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => magicGfx.destroy()
    });

    const hitRange = 220;
    this.enemySystem.activeEnemies.forEach((enemy, id) => {
      if (!enemy.active || enemy.fsm === 'dead') return;
      const dist = window.Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y);
      if (dist < hitRange) {
        useGameStore.getState().sendPlayerAttack(id, 'spell');
        if (enemy.sprite) {
          enemy.sprite.setTint(0xcc33ff);
          this.scene.time.delayedCall(300, () => {
            if (enemy.active && enemy.sprite) enemy.sprite.clearTint();
          });
        }
        this._spawnHitEffect(enemy.x, enemy.y);
      }
    });
  }

  handlePlayerThrow() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    // Check inventory for a throwable item
    const inventory = useGameStore.getState().inventory || [];
    const itemEntry = inventory.find(inv => inv.item?.item_type === 'throwable' && inv.quantity > 0);
    if (!itemEntry) {
      useNotificationStore.getState().addNotification('warning', 'Necesitas un Arma Arrojable en tu inventario.');
      return;
    }

    // Check Mana cost (10 MP)
    if (this.playerMp < 10) {
      useNotificationStore.getState().addNotification('warning', 'No tienes suficiente Maná (requiere 10 MP).');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastThrowTime || 0) < 2000) return;
    this._lastThrowTime = now;

    // Consume Mana & Item
    this.playerMp -= 10;
    this.updateHpBar();
    useGameStore.getState().useItem(itemEntry.id);

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-projectile`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('projectile', 500);
    }

    // Fallback siempre disponible: círculo de energía generado por código.
    if (!this.scene.textures.exists('energy-ball')) {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x00ffff, 1);
      g.fillCircle(12, 12, 8);
      g.lineStyle(2, 0xffffff, 0.8);
      g.strokeCircle(12, 12, 11);
      g.generateTexture('energy-ball', 24, 24);
      g.destroy();
    }

    // Si el item tiene sprite (icon_key), úsalo como proyectil; si no está cargado
    // todavía, se carga on-demand y se intercambia la textura en vuelo (los
    // siguientes lanzamientos ya lo usan al instante). Fallback: el círculo.
    const iconKey = itemEntry.item?.icon_key;
    const spriteKey = iconKey ? `item-sprite-${iconKey}` : null;
    const hasSprite = spriteKey && this.scene.textures.exists(spriteKey);
    const initialKey = hasSprite ? spriteKey : 'energy-ball';

    const proj = this.scene.physics.add.sprite(this.scene.player.x, this.scene.player.y - 20, initialKey);
    if (hasSprite) proj.setDisplaySize(28, 28);
    proj.setDepth(this.scene.player.depth + 10);
    const direction = this.scene.player.sprite.flipX ? -1 : 1;
    proj.setFlipX(direction < 0);
    proj.body.setVelocityX(direction * 400);
    proj.body.setAllowGravity(false);

    // Carga diferida del sprite del item si aún no estaba en caché.
    if (spriteKey && !hasSprite && !this.scene.load.isLoading()) {
      const url = iconKey.endsWith('.png') ? `/Items/sprites/${iconKey}` : `/Items/sprites/${iconKey}.png`;
      this.scene.load.image(spriteKey, url);
      this.scene.load.once(`filecomplete-image-${spriteKey}`, () => {
        if (proj.active && this.scene.textures.exists(spriteKey)) {
          proj.setTexture(spriteKey);
          proj.setDisplaySize(28, 28);
          proj.setFlipX(direction < 0);
        }
      });
      this.scene.load.start();
    }

    this.scene.time.delayedCall(1500, () => {
      if (proj.active) proj.destroy();
    });

    this.scene.physics.add.overlap(proj, this.scene.enemiesGroup, (projectile, enemy) => {
      if (enemy.active && enemy.fsm !== 'dead') {
        const instanceId = enemy.config?.instance_id || enemy.npcId;
        useGameStore.getState().sendPlayerAttack(instanceId, 'throw');
        this._spawnHitEffect(enemy.x, enemy.y);
        if (enemy.sprite) {
          enemy.sprite.setTint(0x00ffff);
          this.scene.time.delayedCall(200, () => {
            if (enemy.active && enemy.sprite) enemy.sprite.clearTint();
          });
        }
        projectile.destroy();
      }
    });
  }

  handlePlayerPotion() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    // Check if health is already full
    if (this.playerHp >= this.playerMaxHp) {
      useNotificationStore.getState().addNotification('info', 'Tu salud ya está al máximo.');
      return;
    }

    // Check inventory for a health consumable
    const inventory = useGameStore.getState().inventory || [];
    const itemEntry = inventory.find(inv => inv.item?.item_type === 'health' && inv.quantity > 0);
    if (!itemEntry) {
      useNotificationStore.getState().addNotification('warning', 'Necesitas una Poción de Vida en tu inventario.');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastPotionTime || 0) < 10000) return;
    this._lastPotionTime = now;

    // Consume item
    useGameStore.getState().useItem(itemEntry.id);
    // La curación del HP de combate la aplica el servidor (manda player_hp).
    useGameStore.getState().sendPlayerHeal();

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-potion`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('potion', 600);
    }

    for (let i = 0; i < 15; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        if (!this.scene.player) return;
        const px = this.scene.player.x + window.Phaser.Math.Between(-20, 20);
        const py = this.scene.player.y + window.Phaser.Math.Between(-10, 30);
        const part = this.scene.add.circle(px, py, window.Phaser.Math.Between(3, 6), 0x33ff33, 0.8);
        part.setDepth(this.scene.player.depth + 1);
        this.scene.tweens.add({
          targets: part,
          y: py - window.Phaser.Math.Between(40, 80),
          alpha: 0,
          scale: 0.5,
          duration: window.Phaser.Math.Between(600, 1000),
          onComplete: () => part.destroy()
        });
      });
    }
  }

  handlePlayerManaPotion() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    // Check if mana is already full
    if (this.playerMp >= this.playerMaxMp) {
      useNotificationStore.getState().addNotification('info', 'Tu maná ya está al máximo.');
      return;
    }

    // Check inventory for a mana consumable
    const inventory = useGameStore.getState().inventory || [];
    const itemEntry = inventory.find(inv => inv.item?.item_type === 'mana' && inv.quantity > 0);
    if (!itemEntry) {
      useNotificationStore.getState().addNotification('warning', 'Necesitas una Poción de Maná en tu inventario.');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastManaPotionTime || 0) < 10000) return;
    this._lastManaPotionTime = now;

    // Consume item
    useGameStore.getState().useItem(itemEntry.id);

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-potion`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('potion', 600);
    }

    this.playerMp = Math.min(this.playerMaxMp, this.playerMp + 40);
    this.updateHpBar();

    // Spawn blue sparkles for mana restoration
    for (let i = 0; i < 15; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        if (!this.scene.player) return;
        const px = this.scene.player.x + window.Phaser.Math.Between(-20, 20);
        const py = this.scene.player.y + window.Phaser.Math.Between(-10, 30);
        const part = this.scene.add.circle(px, py, window.Phaser.Math.Between(3, 6), 0x00aaff, 0.8);
        part.setDepth(this.scene.player.depth + 1);
        this.scene.tweens.add({
          targets: part,
          y: py - window.Phaser.Math.Between(40, 80),
          alpha: 0,
          scale: 0.5,
          duration: window.Phaser.Math.Between(600, 1000),
          onComplete: () => part.destroy()
        });
      });
    }
  }

  handlePlayerDash() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned) return;

    // Check Mana cost (15 MP)
    if (this.playerMp < 15) {
      useNotificationStore.getState().addNotification('warning', 'No tienes suficiente Maná para esquivar (requiere 15 MP).');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastDashTime || 0) < 1500) return;
    this._lastDashTime = now;

    // Consume Mana
    this.playerMp -= 15;
    this.updateHpBar();

    let dx = 0;
    let dy = 0;

    const left = this.scene.cursors.left.isDown || this.scene.wasd.left.isDown || this.scene.virtualInputs.left;
    const right = this.scene.cursors.right.isDown || this.scene.wasd.right.isDown || this.scene.virtualInputs.right;
    const up = this.scene.cursors.up.isDown || this.scene.wasd.up.isDown || this.scene.virtualInputs.up;
    const down = this.scene.cursors.down.isDown || this.scene.wasd.down.isDown || this.scene.virtualInputs.down;

    if (left) dx = -1;
    else if (right) dx = 1;
    if (up) dy = -1;
    else if (down) dy = 1;

    if (dx === 0 && dy === 0) {
      dx = this.scene.player.sprite.flipX ? -1 : 1;
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const dashSpeed = 400;
    this.dashVelocity = { x: dx * dashSpeed, y: dy * dashSpeed };
    this.isDashing = true;

    this.scene.player.setAlpha(0.6);
    if (this.scene.player.sprite) {
      this.scene.player.sprite.setTint(0x88ccff);
    }

    this.scene.time.delayedCall(150, () => {
      this.isDashing = false;
      if (this.scene.player) {
        this.scene.player.setAlpha(1.0);
        if (this.scene.player.sprite) {
          this.scene.player.sprite.clearTint();
        }
      }
    });
  }

  _spawnHitEffect(x, y) {
    const flash = this.scene.add.circle(x, y, 14, 0xffdd00, 0.85).setDepth(1000);
    this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 180,
        onComplete: () => flash.destroy(),
    });
  }
}
