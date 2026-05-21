import { NPCSprite } from './NPCSprite';
import { ENEMY_CONFIG } from '../config/EnemyConfig';

// Estados posibles de la FSM
const STATES = {
  IDLE:    'idle',
  CHASE:   'chase',
  ATTACK:  'attack',
  HURT:    'hurt',
  KNOCKED: 'knocked',
  DEAD:    'dead',
};

// Cuántos ms dura cada estado transitorio
const STATE_DURATION = {
  hurt:    350,
  knocked: 800,
  dead:    600,  // tiempo antes de volver al pool
};

export default class EnemySprite extends NPCSprite {
  constructor(scene, x, y, charId, username = 'Enemy') {
    // El constructor de NPCSprite ya crea el sprite interno y el nameTag
    super(scene, x, y, charId, username, 'enemy');

    this.fsm = STATES.IDLE;
    this.hp  = 0;
    this.maxHp = 0;
    this.config = null;    // datos que llegan del backend
    this.stateTimer = 0;   // ms restantes en estado transitorio
    this.attackCooldown = 0;
    this._attackHitDealt = false;
    this.target = null;    // referencia al jugador

    // Asegurar que tiene físicas si no se añadieron en super
    if (!this.body) {
      scene.physics.add.existing(this);
    }
    
    if (this.body) {
      this.body.enable = true;
      this.body.setCircle(30, -30, -10);
    }
  }

  // ─── Inicializar desde el pool ───────────────────────────────────────────
  spawn(x, y, config, target) {
    this.config = config;
    this.target = target;
    this.hp     = config.hp;
    this.maxHp  = config.hp;
    this.npcId  = config.npcId;

    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    if (this.body) {
      this.body.enable = true;
      // Ajustar hitbox si es necesario
      this.body.setCircle(30, -30, -10);
    }

    // Actualizar nombre si viene en config
    if (config.name) {
      this.nameTag.setText(config.name);
    }

    this.sprite.on('animationcomplete', (anim) => {
      const attackAnim = `enemy-${this.npcId}-${this._resolveAnim(STATES.ATTACK)}`;
      if (anim.key === attackAnim) {
        this._attackHitDealt = false;
      }
    });

    this._changeState(STATES.IDLE);
    if (this.healthBar) this.healthBar.setVisible(true);
  }

  // ─── Sincronizar desde el Servidor (Multiplayer) ─────────────────────────
  syncFromServer(data) {
    if (this.fsm === STATES.DEAD) return;
    const oldX = this.x;
    // Actualizar posición (suavizado o directo)
    this.setPosition(data.x, data.y);
    
    // Actualizar estado de la animación
    if (data.fsm_state) {
        this._changeState(data.fsm_state);
    }

    if (data.target_id) {
        this.targetId = String(data.target_id);
        const myPlayerId = this.scene.playerManager?.myPlayerId;
        if (this.targetId === String(myPlayerId)) {
            this.target = this.scene.player;
        } else if (this.scene.playerSprites && this.scene.playerSprites.has(this.targetId)) {
            this.target = this.scene.playerSprites.get(this.targetId);
        } else {
            this.target = this.scene.player;
        }
    } else {
        this.target = this.scene.player;
    }

    // Orientar el sprite según el objetivo o el movimiento
    if (this.target && this.target.active && (this.fsm === STATES.CHASE || this.fsm === STATES.ATTACK)) {
        this.setFacing(this.target.x < this.x ? 'left' : 'right');
    } else if (data.x < oldX) {
        this.setFacing('left');
    } else if (data.x > oldX) {
        this.setFacing('right');
    }

    // Actualizar HP
    if (data.hp !== undefined) {
        this.updateHealth(data.hp, data.hp_max || 100);
    }
  }

  updateHealth(current, max) {
    this.hp = current;
    this.maxHp = max;
    this._drawHealthBar();

    if (this.hp <= 0 && this.fsm !== STATES.DEAD) {
        this._changeState(STATES.DEAD);
    }
  }

  _drawHealthBar() {
    if (!this.healthBar) {
        this.healthBar = this.scene.add.graphics();
        this.add(this.healthBar);
    }
    
    this.healthBar.clear();
    
    const width = 40;
    const height = 4;
    const x = -width / 2;
    const y = -40;

    // Background
    this.healthBar.fillStyle(0x000000, 0.7);
    this.healthBar.fillRect(x, y, width, height);

    // HP Fill
    const fillPercent = Math.max(0, this.hp / this.maxHp);
    const fillColor = fillPercent > 0.5 ? 0x00ff00 : (fillPercent > 0.25 ? 0xffff00 : 0xff0000);
    
    this.healthBar.fillStyle(fillColor, 1);
    this.healthBar.fillRect(x, y, width * fillPercent, height);
  }

  // ─── Devolver al pool ────────────────────────────────────────────────────
  _returnToPool() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable  = false;   // importante: deshabilitar física
      this.body.setVelocity(0, 0);
    }
    this.target = null;
    this.sprite.stop();
  }

  // ─── Cambiar estado FSM ──────────────────────────────────────────────────
  _changeState(newState) {
    if (this.fsm === newState) return;

    // EVITAR LOOP: Si está atacando, no interrumpir con chase/idle hasta terminar
    if (this.fsm === STATES.ATTACK && (newState === STATES.CHASE || newState === STATES.IDLE)) {
        const attackAnim = `enemy-${this.npcId}-${this._resolveAnim(STATES.ATTACK)}`;
        if (this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key === attackAnim) {
            return;
        }
    }

    this.fsm = newState;

    // Mapeamos estado de combate → clave de animación que ya existe en NPCConfig
    const animKey = this._resolveAnim(newState);
    const fullAnimKey = `enemy-${this.npcId}-${animKey}`;
    
    if (this.scene.anims.exists(fullAnimKey)) {
        this.sprite.play(fullAnimKey, true);
    } else {
        // Fallback a NPCSprite logic por si acaso
        this.playAnimation(animKey);
    }

    // Arrancar temporizador en estados con duración fija
    if (STATE_DURATION[newState] !== undefined) {
      this.stateTimer = STATE_DURATION[newState];
    }
  }

  // Convierte estado FSM → nombre de animación base
  _resolveAnim(state) {
    return ENEMY_CONFIG.STATE_TO_ANIM[state] || 'idle';
  }

  // ─── Recibir daño (llamado desde HitboxSystem) ───────────────────────────
  takeDamage(amount, knockbackVec) {
    if (this.fsm === STATES.DEAD) return;

    this.hp -= amount;

    if (this.hp <= 0) {
      this._changeState(STATES.DEAD);
      return;
    }

    // Golpe fuerte → knocked (vuela), golpe normal → hurt
    const isStrong = amount >= (this.config?.knockThreshold ?? 20);
    this._changeState(isStrong ? STATES.KNOCKED : STATES.HURT);

    if (knockbackVec && this.body) {
      const force = isStrong ? 400 : 200;
      this.body.setVelocity(
        knockbackVec.x * force,
        knockbackVec.y * (force * 0.4)
      );
    }
  }

  // ─── Update — motor de la FSM ─────────────────────────────────────────────
  preUpdate(time, delta) {
    if (!this.active) return;

    if (this.paused) {
      if (this.body) this.body.setVelocity(0, 0);
      return;
    }

    // Actualizar depth para pseudo-3D (Y = Z)
    this.setDepth(this.y + 0.1);

    // Decrementar temporizador de estados transitorios
    if (this.stateTimer > 0) {
      this.stateTimer -= delta;
    }

    switch (this.fsm) {

      case STATES.IDLE:
        if (this.body) this.body.setVelocity(0, 0);
        if (this._distToTarget() < (this.config?.detectRange ?? 280)) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.CHASE:
        // Guard: si perdemos el target, volver a idle
        if (!this.target) {
          this._changeState(STATES.IDLE);
          break;
        }
        this._moveTowardTarget();
        if (this._distToTarget() < (this.config?.attackRange ?? 70)) {
          this._changeState(STATES.ATTACK);
        }
        break;

      case STATES.ATTACK:
        if (this.body) this.body.setVelocity(0, 0);
        // Asegurar que el enemigo mira hacia el jugador al atacar
        if (this.target && this.target.active) {
          this.setFacing(this.target.x < this.x ? 'left' : 'right');
        }
        this.attackCooldown -= delta;
        if (this.attackCooldown <= 0) {
          const animKey = this._resolveAnim(STATES.ATTACK);
          const fullAnimKey = `enemy-${this.npcId}-${animKey}`;
          if (this.scene.anims.exists(fullAnimKey)) {
              this.sprite.play(fullAnimKey, true);
          } else {
              this.playAnimation(animKey);
          }
          this._doAttack();
          this._attackHitDealt = false;
          this.attackCooldown = this.config?.attackRate ?? 1200;
        }
        if (this._distToTarget() > (this.config?.attackRange ?? 70) + 20) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.HURT:
        // Frena progresivamente mientras dura la animación de hurt
        if (this.body) {
          this.body.setVelocity(
            this.body.velocity.x * 0.85,
            this.body.velocity.y * 0.85
          );
        }
        if (this.stateTimer <= 0) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.KNOCKED:
        // Deslizamiento más largo (ya tiene velocidad del knockback)
        if (this.body) {
          this.body.setVelocity(
            this.body.velocity.x * 0.88,
            this.body.velocity.y * 0.88
          );
        }
        if (this.stateTimer <= 0) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.DEAD:
        if (this.body) this.body.setVelocity(0, 0);
        if (this.stateTimer <= 0) {
          // Emitir evento para que la escena lo registre (score, drops...)
          this.scene.events.emit('enemy-died', this);
          this._returnToPool();
        }
        break;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  _distToTarget() {
    if (!this.target) return Infinity;
    return Phaser.Math.Distance.Between(
      this.x, this.y,
      this.target.x, this.target.y
    );
  }

  _moveTowardTarget() {
    if (!this.target) return;
    const speed = this.config?.speed ?? 90;
    
    // Usar moveToObject de la escena física
    this.scene.physics.moveToObject(this, this.target, speed);

    // Flip horizontal según dirección
    this.setFacing(this.target.x < this.x ? 'left' : 'right');
  }

  setFacing(dir) {
    if (this.sprite) {
      this.sprite.setFlipX(dir === 'right');
    }
  }

  _doAttack() {
    // 1. Reproducir la animación de ataque para todos
    const animKey = this._resolveAnim(STATES.ATTACK);
    const fullAnimKey = `enemy-${this.npcId}-${animKey}`;
    if (this.sprite) {
      if (this.scene.anims.exists(fullAnimKey)) {
        this.sprite.play(fullAnimKey, true);
      } else {
        this.playAnimation(animKey);
      }
    }

    // 2. Solo emitir el daño local si NOSOTROS somos el objetivo
    const myPlayerId = this.scene.playerManager?.myPlayerId;
    if (this.targetId && myPlayerId && this.targetId !== myPlayerId) {
        return; // Solo reproducimos la animación, pero no restamos HP local
    }

    // Guard: no atacar si no hay target válido (y somos nosotros)
    if (!this.target || !this.target.active) return;

    if (this._attackHitDealt) return;
    this._attackHitDealt = true;

    // Emitir evento — LobbyScene lo escucha para aplicar daño al jugador
    this.scene.events.emit('enemy-attack', {
      enemy:  this,
      damage: this.config?.damage ?? 10,
    });
  }
}
