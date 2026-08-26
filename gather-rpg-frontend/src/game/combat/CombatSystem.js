import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { spawnDamageNumber } from '../systems/floatingText';
import { ensureItemSprite, itemSpriteKey } from '../systems/itemSprites';
import { playGameSfx } from '../audio/playGameSfx';

// Regen automático de maná del jugador (MP por segundo). Predicción local optimista:
// el server regenera de verdad a este mismo ritmo (ver mpRegenPerSec en room.go) y
// reconcilia por player-mp-update, así que esto solo evita que la barra local se vea
// "congelada" entre esos mensajes (llegan ~1 vez por segundo).
const MP_REGEN_PER_SEC = 2;

// Auto-uso de consumibles: si el jugador lleva pociones, no debería tener que
// pausar el combate para beberlas a mano. El maná se bebe apenas llega a 0; el HP
// se bebe al caer por debajo de este % (evita esperar a estar casi muerto). Ambos
// respetan el cooldown de 10s de su handler manual (_lastManaPotionTime /
// _lastPotionTime) para no encadenar varias pociones de golpe.
const AUTO_HEAL_HP_PCT = 0.25;

// Hit-stop arcade: al recibir un golpe el jugador queda aturdido (no se mueve ni ataca)
// este tiempo y recibe un pequeño empuje. 350ms = igual que el hurt del enemigo.
const HURT_STAGGER_MS = 350;
const HURT_KNOCKBACK  = 140; // px/s del empuje al ser golpeado

// Hitstop / freeze-frames: al conectar un golpe se congela un instante la animación de
// atacante y golpeado, para dar sensación de impacto ("contundencia" arcade).
const HITSTOP_MS = 70;
// Parpadeo de invulnerabilidad tras recibir daño (debe cubrir playerAttackIFrames).
const IFRAME_BLINK_MS = 800;

// Perfiles de hechizo: cada Pergamino (item_type 'scroll') lanza uno de estos según su
// nombre/icono. anim = animación del personaje; color = tinte/VFX; el daño lo aplica el
// servidor (sendPlayerAttack 'spell'), aquí solo va el visual + detección de alcance.
const SPELL_PROFILES = {
  fire_rain: { anim: 'special',    mpCost: 30, cooldownMs: 4000, color: 0xff4400, flash: 0xff2200 },
  wave:      { anim: 'projectile', mpCost: 25, cooldownMs: 3000, color: 0x44aaff, flash: 0x4488ff },
  nova:      { anim: 'special',    mpCost: 40, cooldownMs: 5000, color: 0xaa44ff, flash: 0xaa44ff },
};
const DEFAULT_SPELL = 'nova';

// Resuelve qué hechizo lanza un Pergamino. Preferimos el campo explícito `spell_type`
// (configurable en el admin); si no está, lo adivinamos por el nombre/icono/descripción.
function resolveSpellType(item) {
  if (item?.spell_type && SPELL_PROFILES[item.spell_type]) return item.spell_type;
  const hay = `${item?.name || ''} ${item?.icon_key || ''} ${item?.description || ''}`.toLowerCase();
  if (/fuego|fire|flam|llama|meteor/.test(hay))     return 'fire_rain';
  if (/onda|wave|ola|corte|slash|viento/.test(hay)) return 'wave';
  if (/nova|explos|radial|burst|aoe|arcano/.test(hay)) return 'nova';
  return DEFAULT_SPELL;
}

// Tipos de tarea que habilitan el combate (atacar enemigos).
const COMBAT_TASK_TYPES = ['defeat_enemy', 'kill_boss', 'kill_all'];

// Cadencia del único ataque cuerpo a cuerpo (K, combo 1→2→3). El enemigo NO muere por
// HP: cuando un golpe lo dejaría en 0 el servidor dispara la Ninja Card y es la
// respuesta correcta la que lo mata. El daño es autoritativo del server (attackDamage
// en hub_combat.go): combo1 10 | combo2 12 | combo3_finisher 20.
// (Existió un segundo botón "golpe rápido" en J con menos daño/lock; se retiró porque
// tener dos botones de melee muy parecidos confundía más de lo que aportaba — ver
// LobbyInputController.COMBAT_KEYS.)
const COMBO_LOCKS = { combo1: 380, combo2: 380, combo3_finisher: 480 };

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
    this._pendingDeath = false; // muerte recibida con una Ninja Card abierta (ver onPlayerDeath)
    this.isStunned = false;
    this.hurtStaggerUntil = 0; // hit-stop arcade: aturdimiento breve tras recibir un golpe
    this._attackLockUntil = 0; // "un swing a la vez": bloquea nuevas acciones (combo J, arrojadizo K, hechizo L...) hasta que termina la animación en curso

    // Attack timers & combos
    // Timestamps de cooldown inicializados "listos": al entrar al mapa el reloj de Phaser
    // arranca cerca de 0, y con last=0 el check `now - last < cooldown` bloquearía el
    // PRIMER uso durante los primeros segundos. Con un valor muy negativo, el primer
    // hechizo/arrojadizo/poción se permite de inmediato.
    const READY = -1e7;
    this._lastAttackTime = READY;
    this._lastComboTime = READY;
    this._comboStep = 0;
    this._lastSpellTime = READY;
    this._lastThrowTime = READY;
    this._lastPotionTime = READY;
    this._lastManaPotionTime = READY;
    this._lastDashTime = READY;

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

    // Al cerrarse la Ninja Card, ejecutar la muerte que llegó mientras estaba abierta.
    this.onNinjaCardClosed = () => {
      if (!this._pendingDeath) return;
      this._pendingDeath = false;
      this.onPlayerDeath();
    };
    window.addEventListener('ninja-card-closed', this.onNinjaCardClosed);

    // Maná autoritativo del servidor: el server es la fuente de verdad (persistente,
    // compartida con el inventario/Sidebar). Reconciliamos el valor local al recibirlo.
    this.onPlayerMP = (e) => {
      const d = e.detail || {};
      if (typeof d.mp === 'number') this.playerMp = d.mp;
      if (typeof d.mp_max === 'number') this.playerMaxMp = d.mp_max;
      this.updateHpBar();
      this._checkAutoManaPotion();
    };
    window.addEventListener('player-mp-update', this.onPlayerMP);

    // Initial HP bar setup
    this.setupHUD();

    // Scale resize listener to keep HP/MP bars at the bottom
    this.onResize = () => { this.updateHpBar(); this._updateItemBadges(); };
    this.scene.scale.on('resize', this.onResize, this);
  }

  destroy() {
    window.removeEventListener('ninja-card-result', this.onNinjaCardResult);
    window.removeEventListener('player-mp-update', this.onPlayerMP);
    window.removeEventListener('player-hp-update', this.onPlayerHP);
    window.removeEventListener('player-died-server', this.onPlayerDiedServer);
    window.removeEventListener('ninja-card-closed', this.onNinjaCardClosed);
    this.scene.events.off('enemy-attack', this.onEnemyAttack);
    if (this.onResize) {
      this.scene.scale.off('resize', this.onResize, this);
    }
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpText) this.hpText.destroy();
    if (this.mpText) this.mpText.destroy();

    this._unsubInventory?.();
    this._unsubActiveScroll?.();
    this._unsubActiveThrowable?.();
    this._itemBadgeBg?.destroy();
    this._scrollIcon?.destroy();
    this._scrollCount?.destroy();
    this._throwIcon?.destroy();
    this._throwCount?.destroy();
  }

  setupHUD() {
    this.hpBar = this.scene.add.graphics();
    this.hpBar.setScrollFactor(0);
    this.hpBar.setDepth(200000);
    this.updateHpBar();

    // Badges del pergamino y arrojadizo activos (ícono + cantidad): se ubican
    // pegados a la barra de HP/MP, en el mismo rincón inferior-izquierdo, para
    // no invadir el área de juego con más HUD.
    this._itemBadgeBg = this.scene.add.graphics().setScrollFactor(0).setDepth(200000);
    this._scrollIcon  = this.scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(200001).setVisible(false);
    this._scrollCount = this.scene.add.text(0, 0, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(200001).setOrigin(0, 0.5);
    this._throwIcon  = this.scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(200001).setVisible(false);
    this._throwCount = this.scene.add.text(0, 0, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setScrollFactor(0).setDepth(200001).setOrigin(0, 0.5);

    this._updateItemBadges();

    // Refrescar los badges cuando cambie el inventario o el ítem activo
    // (auto-equip, equipo manual desde SettingsMenu, consumo, drops...).
    this._unsubInventory      = useGameStore.subscribe((state) => state.inventory, () => this._updateItemBadges());
    this._unsubActiveScroll   = useGameStore.subscribe((state) => state.activeScrollId, () => this._updateItemBadges());
    this._unsubActiveThrowable = useGameStore.subscribe((state) => state.activeThrowableId, () => this._updateItemBadges());
  }

  // Redibuja los badges de pergamino/arrojadizo activos (ícono + "xN") junto a
  // la barra de HP/MP. Se llama al iniciar el HUD, al redimensionar, y cada vez
  // que cambia el inventario o el ítem activo (ver suscripciones en setupHUD).
  _updateItemBadges() {
    if (!this._itemBadgeBg) return;

    const scrollEntry = this._pickActiveItem('scroll');
    const throwEntry  = this._pickActiveItem('throwable');

    this._itemBadgeBg.clear();

    const x = 20;
    const screenHeight = this.scene.scale.height;
    const bottomY = screenHeight - 46;
    const barW = 120;
    const badgeX = x + barW + 24; // a la derecha de la barra de HP/MP, mismo rincón
    const rowH = 22;
    const iconSize = 16;

    const rows = [
      { entry: scrollEntry, icon: this._scrollIcon, count: this._scrollCount, y: bottomY + 2 },
      { entry: throwEntry,  icon: this._throwIcon,  count: this._throwCount,  y: bottomY + 2 + rowH },
    ];

    rows.forEach(({ entry, icon, count, y }) => {
      if (!entry) {
        icon.setVisible(false);
        count.setText('');
        return;
      }

      this._itemBadgeBg.fillStyle(0x000000, 0.6);
      this._itemBadgeBg.fillRoundedRect(badgeX - 4, y - iconSize / 2 - 3, 54, iconSize + 6, 5);

      const iconKey = entry.item?.icon_key;
      const spriteKey = itemSpriteKey(iconKey);
      icon.setPosition(badgeX + iconSize / 2, y);
      icon.setDisplaySize(iconSize, iconSize);
      icon.setVisible(true);
      if (spriteKey && this.scene.textures.exists(spriteKey)) {
        icon.setTexture(spriteKey);
      } else if (iconKey) {
        ensureItemSprite(this.scene, iconKey, (key) => {
          if (icon.active) { icon.setTexture(key); icon.setDisplaySize(iconSize, iconSize); }
        });
      }

      count.setPosition(badgeX + iconSize + 6, y);
      count.setText(`x${entry.quantity}`);
    });
  }

  update(delta) {
    if (this.playerAttackIFrames > 0) {
      this.playerAttackIFrames -= delta;
    }

    // Auto MP Regen (MP_REGEN_PER_SEC por segundo; 0 = desactivado → solo pociones).
    if (MP_REGEN_PER_SEC > 0 && this.playerMp < this.playerMaxMp && !this.isDead) {
      this._mpRegenTimer = (this._mpRegenTimer || 0) + delta;
      if (this._mpRegenTimer >= 1000) {
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + MP_REGEN_PER_SEC);
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
    if (this.scene.isDashing) return; // Invulnerabilidad durante el Dash
    if (this.playerAttackIFrames > 0) return;
    this.playerAttackIFrames = 800; // throttle local de reportes (el server también valida i-frames)
    playGameSfx(this.scene, 'sfx_enemy_atack');

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

      // Hit-stop arcade: aturde al jugador un instante (LobbyScene.update bloquea su input
      // mientras isHurtStaggered()) y le da un pequeño empuje desde el enemigo que golpeó.
      this.hurtStaggerUntil = this.scene.time.now + HURT_STAGGER_MS;
      const body = this.scene.player.body;
      const enemy = data?.enemy;
      if (body) {
        if (enemy) {
          const dx = this.scene.player.x - enemy.x;
          const dy = this.scene.player.y - enemy.y;
          const len = Math.hypot(dx, dy) || 1;
          body.setVelocity((dx / len) * HURT_KNOCKBACK, (dy / len) * HURT_KNOCKBACK);
        } else {
          body.setVelocity(0, 0);
        }
      }

      // Freeze-frames de impacto (jugador + enemigo que golpeó).
      this._hitstop([this.scene.player, enemy].filter(Boolean));

      // Sacudida de cámara + número de daño rojo al recibir el golpe.
      this.scene.cameras?.main?.shake(150, 0.01);
      if (data?.damage > 0) {
        spawnDamageNumber(this.scene, this.scene.player.x, this.scene.player.y - 40, data.damage, { color: '#ff5555', crit: true });
      }

      // Parpadeo de invulnerabilidad mientras corren los i-frames (playerAttackIFrames):
      // comunica que el jugador no puede ser re-golpeado/encadenado un instante.
      this.scene.tweens.add({
        targets: this.scene.player,
        alpha: 0.35,
        duration: IFRAME_BLINK_MS / 8,
        ease: 'Linear',
        yoyo: true,
        repeat: 3,
        onComplete: () => this.scene.player?.setAlpha(1),
      });
    }
  }

  // True mientras el jugador está en hit-stop (aturdimiento breve por un golpe).
  isHurtStaggered() {
    return this.scene.time.now < this.hurtStaggerUntil;
  }

  // True mientras corre la animación de un golpe (combo J, arrojadizo K, hechizo L).
  // Golpear ancla al personaje: el swing se ejecuta en el sitio, igual que el de los
  // enemigos. Es lo que da peso al ataque y lo vuelve una decisión — si pudieras
  // atacar corriendo, el sprite patinaría con la animación de golpe puesta.
  isAttackLocked() {
    return this.scene.time.now < this._attackLockUntil;
  }

  // Devuelve true si la misión activa tiene al menos una tarea de combate
  // (kill_all, defeat_enemy o kill_boss). El campo "type" de la misión no
  // existe a nivel raíz — vive dentro de tasks[].type. Una misión SIN tareas
  // cargadas no es prueba de que sea pacífica: en la duda se permite atacar,
  // porque bloquear el ataque por error deja al jugador indefenso.
  _isCombatMission(mission) {
    if (!mission) return false;
    const tasks = mission.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) return true;
    return tasks.some(t => COMBAT_TASK_TYPES.includes(t.type));
  }

  // Gate único de todas las acciones ofensivas (J, K, L, U, clic y botones
  // virtuales). Existe para que no se pueda atacar durante misiones de recado o
  // diálogo, PERO nunca debe dispararse en un mapa de combate:
  //
  //   - hay enemigos vivos en la sala → te están atacando, siempre puedes responder;
  //   - la misión activa es de OTRA escena → una misión puede arrastrarse entre
  //     mapas (la de comprar ítems de Amy sigue activa al entrar a combate_town_1),
  //     así que no puede decidir si aquí se pelea;
  //   - la misión de esta escena tiene una tarea kill_all / kill_boss / defeat_enemy.
  //
  // Devuelve true (y avisa, throttled) solo cuando el bloqueo es real.
  _isCombatBlocked() {
    if (this.enemySystem?.activeEnemies?.size > 0) return false;

    const { activeMission, currentSceneKey } = useGameStore.getState();
    if (!activeMission) return false;
    if (activeMission.scene_key && currentSceneKey && activeMission.scene_key !== currentSceneKey) return false;
    if (this._isCombatMission(activeMission)) return false;

    const now = this.scene.time.now;
    if (now - (this._lastAttackBlockNotifyTime || 0) > 3000) {
      this._lastAttackBlockNotifyTime = now;
      useNotificationStore.getState().addNotification('warning', 'El ataque está desactivado durante misiones que no son de combate.');
    }
    return true;
  }

  // Hitstop: congela las animaciones de los sprites dados un instante (freeze-frames de
  // impacto). Recibe contenedores (PlayerSprite/EnemySprite) con un `.sprite` interno.
  _hitstop(targets, ms = HITSTOP_MS) {
    const anims = [];
    targets.forEach(t => {
      const a = t?.sprite?.anims;
      if (a && a.isPlaying) { a.pause(); anims.push(a); }
    });
    if (anims.length === 0) return;
    this.scene.time.delayedCall(ms, () => anims.forEach(a => a.resume()));
  }

  _handlePlayerHP(e) {
    const { hp, hp_max } = e.detail || {};
    if (typeof hp === 'number') this.playerHp = hp;
    if (typeof hp_max === 'number' && hp_max > 0) this.playerMaxHp = hp_max;
    this.updateHpBar();
    this._checkAutoHealthPotion();
  }

  onPlayerDeath() {
    console.log("[CombatSystem] Player death (server-authoritative)");
    if (this.isDead) return;

    // La penalización por fallar una Ninja Card ('player_takes_damage', 30) se aplica
    // con el modal todavía abierto, así que el server manda player_died ANTES del
    // resultado. Descartar la muerte aquí dejaba al jugador vivo con 0 HP para siempre
    // (nadie la reintentaba): la aplazamos hasta que la card se cierre, y así además el
    // jugador alcanza a leer "¡INCORRECTO!" antes de ver la pantalla de muerte.
    if (useGameStore.getState().ninjaCardData) {
      console.log('[CombatSystem] Death deferred: Ninja Card still open');
      this._pendingDeath = true;
      return;
    }

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
    // Descartar cualquier muerte aplazada: ya revivimos, no debe dispararse al cerrarse
    // una card posterior.
    this._pendingDeath = false;
    this.isStunned = false;
    this.playerHp = 100;
    // El maná no se resetea localmente: es autoritativo del servidor (se reenvía en el
    // respawn vía player_mp). Resetearlo a 100 aquí causaría un desync momentáneo.
    this.updateHpBar();
  }

  handlePlayerCombo() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

    if (this._isCombatBlocked()) return;

    const now = this.scene.time.now;
    // Un swing a la vez: si la animación del golpe anterior sigue, ignorar la pulsación.
    // Esto evita que machacar J dispare varios golpes/colliders muy rápido.
    if (now < this._attackLockUntil) return;

    // J (único ataque de melee): cada golpe encadenado dentro de 1s sube de combo1 →
    // combo2 → combo3_finisher, con más daño y lock más largo. Si pasa más de 1s sin
    // pulsar J vuelve a empezar desde combo1.
    if (now - (this._lastComboTime || 0) > 1000) {
      this._comboStep = 0;
    }

    const charId = this.scene.player.characterId || '1';
    let animKey = 'combo1';
    let hitRange = 120;

    if (this._comboStep === 0) {
      animKey = 'combo1';
      this._comboStep = 1;
    } else if (this._comboStep === 1) {
      animKey = 'combo2';
      this._comboStep = 2;
    } else if (this._comboStep === 2) {
      // El finisher pega más lejos y es el que más daño hace (20 → el server además le
      // aplica el stun largo 'knocked'): es la recompensa por encadenar los 3 golpes.
      animKey = 'combo3_finisher';
      hitRange = 160;
      this._comboStep = 0;
    }
    const lockDuration = COMBO_LOCKS[animKey];

    this._lastComboTime = now;
    this._attackLockUntil = now + lockDuration; // bloquea hasta que acabe esta animación

    const animKeyFull = `char-${charId}-${animKey}`;
    if (this.scene.anims.exists(animKeyFull)) {
      this.scene.player.playAnimation(animKey, lockDuration);
    }
    playGameSfx(this.scene, `sfx_${animKey}`);

    const nearestEnemy = this._findNearestEnemy(hitRange);

    if (nearestEnemy) {
      console.log(`[CombatSystem Combo] Hit enemy ${nearestEnemy.id} via combo ${animKey}`);
      useGameStore.getState().sendPlayerAttack(nearestEnemy.id, animKey);
      playGameSfx(this.scene, 'sfx_player_atack');

      const hitEnemy = nearestEnemy.enemy;
      // Flinch en el frame del impacto (el server confirma después). El finisher
      // hace 20 de daño = strongHitDamage del server → predicción knocked.
      hitEnemy.predictHit?.(animKey === 'combo3_finisher');
      if (hitEnemy.sprite) {
        hitEnemy.sprite.setTint(0xff2222);
        this.scene.time.delayedCall(200, () => {
          if (hitEnemy.active && hitEnemy.sprite) hitEnemy.sprite.clearTint();
        });
      }
      this._spawnHitEffect(hitEnemy.x, hitEnemy.y);
      // Freeze-frames de impacto en atacante y golpeado + sacudida sutil de cámara.
      this._hitstop([this.scene.player, hitEnemy]);
      this.scene.cameras?.main?.shake(50, 0.004);
    }
  }

  // Enemigo activo más cercano al jugador dentro de maxDist, o null. `filter`
  // opcional restringe candidatos (p.ej. solo los que están delante del jugador).
  _findNearestEnemy(maxDist, filter = null) {
    let nearest = null;
    let minDist = maxDist;
    this.enemySystem.activeEnemies.forEach((enemy, id) => {
      if (!enemy.active || enemy.fsm === 'dead') return;
      if (filter && !filter(enemy)) return;
      const dist = window.Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, enemy.x, enemy.y);
      if (dist < minDist) {
        nearest = { id, enemy, dist };
        minDist = dist;
      }
    });
    return nearest;
  }

  // Devuelve la entrada de inventario a usar para un tipo (scroll/throwable): el slot
  // activo configurado si sigue disponible, o el primero del tipo como fallback.
  _pickActiveItem(type) {
    const state = useGameStore.getState();
    const inventory = state.inventory || [];
    const activeId = type === 'scroll' ? state.activeScrollId
                   : type === 'throwable' ? state.activeThrowableId
                   : null;
    if (activeId) {
      const active = inventory.find(inv => inv.id === activeId && inv.item?.item_type === type && inv.quantity > 0);
      if (active) return active;
    }
    return inventory.find(inv => inv.item?.item_type === type && inv.quantity > 0);
  }

  handlePlayerSpell() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

    if (this._isCombatBlocked()) return;

    // Pergamino activo (configurable en inventario); si no, el primero disponible.
    const scrollEntry = this._pickActiveItem('scroll');
    if (!scrollEntry) {
      useNotificationStore.getState().addNotification('warning', 'Necesitas un Pergamino de Habilidad en tu inventario para lanzar un hechizo.');
      return;
    }

    // El hechizo concreto lo determina el Pergamino que llevas (su nombre/icono).
    const spellType = resolveSpellType(scrollEntry.item);
    const profile = SPELL_PROFILES[spellType] || SPELL_PROFILES[DEFAULT_SPELL];

    // Coste de maná según el hechizo
    if (this.playerMp < profile.mpCost) {
      useNotificationStore.getState().addNotification('warning', `No tienes suficiente Maná (requiere ${profile.mpCost} MP).`);
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastSpellTime || 0) < profile.cooldownMs) return;
    this._lastSpellTime = now;

    // El pergamino es tu "libro de hechizos": basta con poseerlo, no se consume.
    // Descuento local optimista + gasto autoritativo en el servidor (persiste el maná).
    this.playerMp = Math.max(0, this.playerMp - profile.mpCost);
    this.updateHpBar();
    useGameStore.getState().sendSpendMana(profile.mpCost);

    const charId = this.scene.player.characterId || '1';
    if (this.scene.anims.exists(`char-${charId}-${profile.anim}`)) {
      this.scene.player.playAnimation(profile.anim, 800);
    }
    playGameSfx(this.scene, 'sfx_skill');
    // Castear ancla en el sitio mientras dura la animación (ver isAttackLocked).
    this._attackLockUntil = this.scene.time.now + 800;

    // Lanzar el efecto correspondiente (~250ms tras el inicio, al "soltar" el cast).
    this.scene.time.delayedCall(250, () => this._castSpell(spellType, profile));

    // El auto-uso de poción de maná espera a que termine el lock del cast: si
    // se bebe mientras el 'special'/'projectile' sigue bloqueado, playAnimation
    // ignora la animación de poción (los locks solo los interrumpe hurt/die).
    this.scene.time.delayedCall(800, () => this._checkAutoManaPotion());
  }

  // ── Hechizos (multijugador: daño server-autoritativo vía sendPlayerAttack) ──────

  _castSpell(type, profile) {
    switch (type) {
      case 'fire_rain': this._castFireRain(profile, type); break;
      case 'wave':      this._castWave(profile, type); break;
      case 'nova':
      default:          this._castNova(profile, type); break;
    }
  }

  // Aplica un golpe de hechizo a un enemigo: reporta al servidor (con el subtipo, para
  // que aplique el daño autoritativo de ese hechizo) + feedback local.
  _applySpellHit(id, enemy, color, attackType = 'spell') {
    if (!enemy?.active || enemy.fsm === 'dead') return;
    useGameStore.getState().sendPlayerAttack(id, attackType);
    if (enemy.sprite) {
      enemy.sprite.setTint(color);
      this.scene.time.delayedCall(250, () => {
        if (enemy.active && enemy.sprite) enemy.sprite.clearTint();
      });
    }
    this._spawnHitEffect(enemy.x, enemy.y);
  }

  // Destello de pantalla fijado a la cámara.
  _screenFlash(color, alpha, duration) {
    const cam = this.scene.cameras?.main;
    if (!cam) return;
    const flash = this.scene.add.rectangle(0, 0, cam.width, cam.height, color, alpha)
      .setOrigin(0).setScrollFactor(0).setDepth(9998);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration, onComplete: () => flash.destroy() });
  }

  // NOVA: explosión radial desde el jugador.
  _castNova(profile, type = 'nova') {
    const px = this.scene.player.x, py = this.scene.player.y;
    const MAX_RAD = 170;
    this._screenFlash(profile.flash, 0.4, 120);
    this.scene.cameras?.main?.shake(300, 0.014);

    const ring = this.scene.add.graphics().setDepth(this.scene.player.depth - 1);
    let radius = 10;
    const hit = new Set();
    const timer = this.scene.time.addEvent({
      delay: 16, repeat: 28,
      callback: () => {
        ring.clear();
        radius += (MAX_RAD - 10) / 28;
        ring.lineStyle(4, profile.color, Math.max(0, 1 - radius / MAX_RAD));
        ring.strokeCircle(px, py, radius);
        ring.fillStyle(profile.color, 0.06);
        ring.fillCircle(px, py, radius);
        this.enemySystem.activeEnemies.forEach((enemy, id) => {
          if (hit.has(id)) return;
          if (window.Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y) <= radius) {
            hit.add(id);
            this._applySpellHit(id, enemy, profile.color, type);
          }
        });
      },
    });
    this.scene.time.delayedCall(520, () => { ring.destroy(); timer.remove(); });

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spark = this.scene.add.circle(px, py, 5, profile.color, 0.9).setDepth(9000);
      this.scene.tweens.add({
        targets: spark, x: px + Math.cos(angle) * 110, y: py + Math.sin(angle) * 110,
        alpha: 0, scale: 0.2, duration: 480, ease: 'Power2', onComplete: () => spark.destroy(),
      });
    }
  }

  // FIRE_RAIN: bombardeo de bolas de fuego alrededor del jugador.
  _castFireRain(profile, type = 'fire_rain') {
    const DROPS = 16;
    const px = this.scene.player.x, py = this.scene.player.y;
    this._screenFlash(profile.flash, 0.25, 180);
    const hit = new Set();
    this.scene.time.addEvent({
      delay: 110, repeat: DROPS - 1,
      callback: () => {
        const x = px + window.Phaser.Math.Between(-260, 260);
        const ball = this.scene.add.circle(x, py - 320, 9, profile.color, 0.95).setDepth(9000);
        this.scene.tweens.add({
          targets: ball, y: py + window.Phaser.Math.Between(-20, 30),
          duration: 360, ease: 'Quad.easeIn',
          onComplete: () => {
            this._spawnHitEffect(ball.x, ball.y);
            this.enemySystem.activeEnemies.forEach((enemy, id) => {
              if (hit.has(id)) return;
              if (Math.abs(enemy.x - ball.x) < 55 && Math.abs(enemy.y - ball.y) < 70) {
                hit.add(id);
                this._applySpellHit(id, enemy, profile.color, type);
              }
            });
            ball.destroy();
          },
        });
      },
    });
  }

  // WAVE: onda que barre hacia delante en la dirección a la que mira el jugador.
  _castWave(profile, type = 'wave') {
    const facingRight = !this.scene.player.sprite?.flipX;
    const dir = facingRight ? 1 : -1;
    const py = this.scene.player.y - 10;
    this._screenFlash(profile.flash, 0.2, 140);

    const wave = this.scene.add.rectangle(this.scene.player.x + dir * 30, py, 70, 60, profile.color, 0.65).setDepth(9000);
    wave.setStrokeStyle(3, 0x88ddff, 1);
    const hit = new Set();
    const timer = this.scene.time.addEvent({
      delay: 16, repeat: 42,
      callback: () => {
        wave.x += dir * 14;
        this.enemySystem.activeEnemies.forEach((enemy, id) => {
          if (hit.has(id)) return;
          if (Math.abs(enemy.x - wave.x) < 45 && Math.abs(enemy.y - py) < 60) {
            hit.add(id);
            this._applySpellHit(id, enemy, profile.color, type);
          }
        });
      },
    });
    this.scene.time.delayedCall(720, () => { wave.destroy(); timer.remove(); });
  }

  handlePlayerThrow() {
    if (!this.scene.player || this.scene.isTyping()) return;
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

    if (this._isCombatBlocked()) return;

    // Arrojadizo activo (configurable en inventario); si no, el primero disponible.
    const itemEntry = this._pickActiveItem('throwable');
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

    // Consume Mana (autoritativo + persistido) & Item
    this.playerMp = Math.max(0, this.playerMp - 10);
    this.updateHpBar();
    useGameStore.getState().sendSpendMana(10);
    // silent: es un arrojadizo lanzado en combate, no un uso manual desde el
    // inventario; la animación + sfx ya avisan, el toast solo interrumpe.
    useGameStore.getState().useItem(itemEntry.id, { silent: true });

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-projectile`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('projectile', 500);
    }
    playGameSfx(this.scene, 'sfx_throw_knife');
    // Lanzar ancla en el sitio mientras dura la animación (ver isAttackLocked).
    this._attackLockUntil = this.scene.time.now + 500;
    // Igual que en el hechizo: esperar a que el lock del 'projectile' termine
    // antes de intentar la animación de poción (si no, playAnimation la ignora).
    this.scene.time.delayedCall(500, () => this._checkAutoManaPotion());

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

    // Fit the icon into a 28px box preserving aspect ratio. A forced square size
    // (setDisplaySize(28,28)) squished non-square PNGs; this scales by the longest side.
    const fitProjectile = (sprite) => {
      const img = sprite.texture?.getSourceImage?.();
      const w = img?.width || 28, h = img?.height || 28;
      const s = 28 / Math.max(w, h);
      sprite.setDisplaySize(w * s, h * s);
    };

    const proj = this.scene.physics.add.sprite(this.scene.player.x, this.scene.player.y - 20, initialKey);
    if (hasSprite) fitProjectile(proj);
    proj.setDepth(this.scene.player.depth + 10);
    const direction = this.scene.player.sprite.flipX ? -1 : 1;
    // Auto-aim solo si se lanza "bien": hay un enemigo DELANTE del jugador (mismo
    // lado que el facing) y alcanzable (400px/s × 1.5s de vida ≈ 600px; apuntamos
    // hasta 500px). Entonces el proyectil sale angulado hacia él, igual que hace el
    // thrower enemigo. Si el más cercano está detrás, no se gira: sale recto.
    const THROW_SPEED = 400;
    const target = this._findNearestEnemy(500, (e) => (e.x - this.scene.player.x) * direction > 0);
    if (target) {
      // Ángulo desde el punto de spawn del proyectil (y-20), no desde el centro del
      // jugador: a corta distancia el desfase se nota y el tiro pasaba por encima.
      const angle = Math.atan2(target.enemy.y - proj.y, target.enemy.x - proj.x);
      proj.body.setVelocity(Math.cos(angle) * THROW_SPEED, Math.sin(angle) * THROW_SPEED);
    } else {
      proj.body.setVelocityX(direction * THROW_SPEED);
    }
    proj.body.setAllowGravity(false);
    // Spin the throwable as it travels (tumbling), in the throw direction.
    proj.body.setAngularVelocity(direction * 540);

    // Carga diferida del sprite del item si aún no estaba en caché. Antes se
    // omitía cuando el loader estaba ocupado (`!isLoading()`), así que el icono
    // no llegaba nunca si coincidía con otra carga; ensureItemSprite lo encola.
    if (!hasSprite) {
      ensureItemSprite(this.scene, iconKey, (key) => {
        if (proj.active) {
          proj.setTexture(key);
          fitProjectile(proj);
        }
      });
    }

    this.scene.time.delayedCall(1500, () => {
      if (proj.active) proj.destroy();
    });

    this.scene.physics.add.overlap(proj, this.scene.enemiesGroup, (projectile, enemy) => {
      if (enemy.active && enemy.fsm !== 'dead') {
        const instanceId = enemy.config?.instance_id || enemy.npcId;
        // Pasamos el id del item arrojado para que el servidor use su effect_value como daño.
        useGameStore.getState().sendPlayerAttack(instanceId, 'throw', itemEntry.item?.id);
        // Flinch en el frame del impacto. El server usa el effect_value del item como
        // daño y aplica knocked si llega a strongHitDamage (20): misma regla aquí.
        enemy.predictHit?.((itemEntry.item?.effect_value ?? 0) >= 20);
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
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

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

    this._consumeHealthPotion(itemEntry);
  }

  // Si el HP cae por debajo del umbral y hay pociones de vida disponibles, se bebe
  // una sola —sin que el jugador tenga que pulsar Q—. Se llama tras cada
  // actualización de HP autoritativa del servidor (_handlePlayerHP).
  _checkAutoHealthPotion() {
    if (!this.scene.player || this.isDead) return;
    if (this.playerHp <= 0 || this.playerHp / this.playerMaxHp >= AUTO_HEAL_HP_PCT) return;

    const inventory = useGameStore.getState().inventory || [];
    const itemEntry = inventory.find(inv => inv.item?.item_type === 'health' && inv.quantity > 0);
    if (!itemEntry) return;

    const now = this.scene.time.now;
    if (now - (this._lastPotionTime || 0) < 10000) return;
    this._lastPotionTime = now;

    this._consumeHealthPotion(itemEntry);
  }

  // Bebe la poción de vida ya resuelta (llamado tanto por Q manual como por
  // _checkAutoHealthPotion). El caller ya validó cantidad/cooldown.
  _consumeHealthPotion(itemEntry) {
    // Consume item
    useGameStore.getState().useItem(itemEntry.id);
    // La curación del HP de combate la aplica el servidor (manda player_hp).
    useGameStore.getState().sendPlayerHeal();

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-potion`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('potion', 600);
    }
    playGameSfx(this.scene, 'sfx_drink');

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
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

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

    this._consumeManaPotion(itemEntry);
  }

  // Apenas el maná llega a 0, si hay pociones de maná disponibles se bebe una
  // sola sin que el jugador tenga que pulsar R. Se llama tras cada gasto/
  // reconciliación de maná (spell, arrojadizo, dash, player-mp-update).
  _checkAutoManaPotion() {
    if (!this.scene.player || this.isDead) return;
    if (this.playerMp > 0) return;

    const inventory = useGameStore.getState().inventory || [];
    const itemEntry = inventory.find(inv => inv.item?.item_type === 'mana' && inv.quantity > 0);
    if (!itemEntry) return;

    const now = this.scene.time.now;
    if (now - (this._lastManaPotionTime || 0) < 10000) return;
    this._lastManaPotionTime = now;

    this._consumeManaPotion(itemEntry, { silent: true });
  }

  // Bebe la poción de maná ya resuelta (llamado tanto por R manual como por
  // _checkAutoManaPotion). El caller ya validó cantidad/cooldown.
  // silent: true cuando la dispara el auto-refill tras hechizo/lanzamiento (para no
  // interrumpir el combate con un toast); false en el R manual, donde sí es feedback útil.
  _consumeManaPotion(itemEntry, { silent = false } = {}) {
    // Consume item
    useGameStore.getState().useItem(itemEntry.id, { silent });

    const charId = this.scene.player.characterId || '1';
    const animKey = `char-${charId}-potion`;
    if (this.scene.anims.exists(animKey)) {
      this.scene.player.playAnimation('potion', 600);
    }
    playGameSfx(this.scene, 'sfx_drink');

    // Refill local optimista (feedback inmediato) por el EffectValue real de la poción;
    // el servidor reconcilia el valor autoritativo vía refreshMana → player_mp.
    const restore = itemEntry.item?.effect_value ?? 30;
    this.playerMp = Math.min(this.playerMaxMp, this.playerMp + restore);
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
    if (this.isDead || useGameStore.getState().ninjaCardData || this.isStunned || this.isHurtStaggered()) return;

    // Check Mana cost (15 MP)
    if (this.playerMp < 15) {
      useNotificationStore.getState().addNotification('warning', 'No tienes suficiente Maná para esquivar (requiere 15 MP).');
      return;
    }

    const now = this.scene.time.now;
    if (now - (this._lastDashTime || 0) < 1500) return;
    this._lastDashTime = now;

    // Consume Mana (descuento local optimista + gasto autoritativo en el servidor,
    // igual que hechizo/arrojadizo — sin sendSpendMana el gasto nunca se persistía y
    // el siguiente player-mp-update del servidor lo revertía).
    this.playerMp -= 15;
    this.updateHpBar();
    this._checkAutoManaPotion();
    useGameStore.getState().sendSpendMana(15);

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

    // Se escribe en la ESCENA (no en `this`): LobbyScene.update() es quien lee
    // isDashing/dashVelocity cada frame para aplicar el impulso al body de física;
    // dejarlo en el CombatSystem hacía que el dash gastara maná sin mover al jugador.
    const dashSpeed = 400;
    this.scene.dashVelocity = { x: dx * dashSpeed, y: dy * dashSpeed };
    this.scene.isDashing = true;

    this.scene.player.setAlpha(0.6);
    if (this.scene.player.sprite) {
      this.scene.player.sprite.setTint(0x88ccff);
    }

    this.scene.time.delayedCall(150, () => {
      this.scene.isDashing = false;
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
