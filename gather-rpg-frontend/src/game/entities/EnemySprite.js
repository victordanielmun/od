import * as Phaser from 'phaser';
import { NPCSprite } from './NPCSprite';
import { ENEMY_CONFIG } from '../config/EnemyConfig';
import { BOSS_STATE_TO_ANIM, getBossScale } from '../config/BossConfig';
import { spawnDamageNumber } from '../systems/floatingText';
import { ensureItemSprite } from '../systems/itemSprites';
import { playGameSfx } from '../audio/playGameSfx';

// Estados posibles de la FSM
const STATES = {
  IDLE:    'idle',
  WANDER:  'wander', // sin objetivo: se pasea cerca de donde apareció (lo mueve el servidor)
  CHASE:   'chase',
  ATTACK:  'attack',
  THROW:   'throw',
  SKILL:   'skill',
  CHARGE:  'charge',
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

// Alto objetivo (px) del sprite en pantalla = alto del jugador. El personaje usa frames
// de ~304px a escala 0.25 → 76px en pantalla (ver CharacterConfig). Las hojas de enemigos
// vienen con frames muy distintos (enemy 1/3 ~67px, enemy 2/4 ~308px); sin normalizar los
// grandes salen enormes. Escalamos cada enemigo a este alto para igualarlo al jugador.
const TARGET_ENEMY_HEIGHT = 95;

// El boss debe verse algo más grande que un personaje normal: 1.25× el alto objetivo
// (≈ 1.25× el jugador). Se normaliza igual que el enemigo, por el alto real del frame.
const BOSS_SIZE_FACTOR = 1.5;

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
    // true en cuanto llega el primer update del servidor: a partir de ahí la FSM
    // local no decide a quién perseguir, solo reproduce lo que dicta la sala.
    // (El beat'em up usa este mismo sprite SIN servidor y sigue decidiendo solo.)
    this.serverDriven = false;

    // Asegurar que tiene físicas si no se añadieron en super
    if (!this.body) {
      scene.physics.add.existing(this);
    }
    
    if (this.body) {
      this.body.enable = true;
      this.body.setCircle(30, -30, -10);
      // Su posición es autoritativa del servidor (o de su propia FSM local en el
      // beat'em up): que el jugador choque contra él no debe desplazarlo. Sin esto
      // Arcade Physics reparte el solape entre ambos cuerpos en cada paso de
      // físicas —independientemente de que su velocidad se ponga a 0 en preUpdate—
      // y el enemigo tiembla/desliza contra la posición real cuando el jugador lo
      // pisa en melee (máximo justo durante el golpe). Mismo patrón que ya usan
      // PlayerSprite (jugadores remotos) y NPCManager para los NPCs.
      this.body.setImmovable(true);
      this.body.pushable = false;
    }

    // Normalizar el tamaño del sprite según su frame real (el boss se reescala aparte
    // en _setupBoss, así que esto solo afecta a enemigos normales).
    this._normalizeScale();
  }

  // Ajusta la escala del sprite para que su alto en pantalla ronde TARGET_ENEMY_HEIGHT.
  // Solo encoge (clamp a 1.0): los enemigos pequeños se quedan a su tamaño nativo y los
  // grandes (enemy 2/4 o cualquier otro con frame alto) se reducen para no salir gigantes.
  _normalizeScale() {
    if (!this.sprite || !this.sprite.texture) return;
    const tex = this.sprite.texture;
    // 'idle_0' es el frame de reposo: la mejor referencia del alto del personaje.
    const frame = tex.has('idle_0') ? tex.get('idle_0') : tex.get(this.sprite.frame?.name);
    const h = frame?.height || this.sprite.height;
    if (h > 0) {
      this.sprite.setScale(Math.min(1.0, TARGET_ENEMY_HEIGHT / h));
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
      const attackAnim = `${this._animPrefix()}-${this._resolveAnim(STATES.ATTACK)}`;
      if (anim.key === attackAnim) {
        this._attackHitDealt = false;
      }
    });

    this._normalizeScale();
    this._changeState(STATES.IDLE);
    if (this.healthBar) this.healthBar.setVisible(true);
  }

  // ─── Sincronizar desde el Servidor (Multiplayer) ─────────────────────────
  syncFromServer(data) {
    if (this.fsm === STATES.DEAD) return;
    this.serverDriven = true;
    this.enemyType = data.type || 'melee';
    if (this.enemyType === 'boss') this._setupBoss();
    const oldX = this.x;
    // Actualizar posición (suavizado o directo). El editor de mapas pausa a los
    // enemigos poniendo `paused=true` (ver EditorController.pauseEnemies) para
    // que no estorben mientras se edita — pero la IA sigue corriendo en el
    // servidor, así que sin este check el enemigo se seguiría teletransportando
    // a su posición autoritativa en cada tick aunque preUpdate ya no lo mueva
    // localmente. El resto del estado (HP, animaciones) sigue sincronizando.
    if (!this.paused) {
        this.setPosition(data.x, data.y);
    }

    // Actualizar estado de la animación
    if (data.fsm_state) {
        // Ventana de predicción local (predictHit): al conectar un golpe, este cliente
        // ya puso hurt/knocked sin esperar el round-trip al servidor. Los updates en
        // vuelo que traen el estado ANTERIOR al golpe (chase/attack/...) no deben
        // cancelar esa predicción; los estados que son CONSECUENCIA de un golpe
        // (hurt/knocked/dead/ninja_card) entran siempre y disuelven la predicción.
        const hitOutcome = data.fsm_state === 'hurt' || data.fsm_state === 'knocked' ||
                           data.fsm_state === 'dead' || data.fsm_state === 'ninja_card';
        const predicting = this._predictedHurtUntil && this.scene.time.now < this._predictedHurtUntil;
        if (!predicting || hitOutcome) {
            if (hitOutcome) this._predictedHurtUntil = 0;
            const wasSkill = this.fsm === STATES.SKILL;
            const wasCharge = this.fsm === STATES.CHARGE;
            const wasNinjaCard = this.fsm === 'ninja_card';
            this._changeState(data.fsm_state);
            // El stun (hurt/knocked) es autoritativo del servidor. Mantener el timer
            // local arriba mientras el server siga mandando ese estado, para que la
            // FSM local no salga sola del aturdimiento entre ticks (evita parpadeo).
            if (data.fsm_state === 'hurt' || data.fsm_state === 'knocked') {
                this.stateTimer = 250;
            }
            // El AoE del boss se dispara una sola vez, al entrar en 'skill'.
            if (this.fsm === STATES.SKILL && !wasSkill) {
                this._doSkill();
            }
            // Reiniciar el flag de contacto al iniciar una nueva embestida.
            if (this.fsm === STATES.CHARGE && !wasCharge) {
                this._chargeHitDealt = false;
            }
            // Señal visual inmediata al quedar congelado en la Ninja Card: el servidor
            // marca fsm_state='ninja_card' (y este cliente deja de moverlo) ANTES de
            // resolver y enviar la pregunta (consulta a la carta + viaje de red), así
            // que sin esto el enemigo se queda plantado en idle sin ninguna pista de
            // qué está pasando durante ese hueco.
            if (this.fsm === 'ninja_card' && !wasNinjaCard) {
                this._flashNinjaCardCue();
            }
        }
    }

    // Tregua de entrada (la fija EnemySystem desde el store): mientras dura, este
    // enemigo no puede tenerme a MÍ como objetivo. Sin esto la FSM local me
    // perseguía igual — el fallback de abajo apunta al jugador local aunque el
    // servidor no le haya asignado objetivo — y los ogros seguían encima nada
    // más aparecer en el mapa.
    const inGrace = this.combatGrace === true;
    const myPlayerId = this.scene.playerManager?.myPlayerId;

    if (data.target_id) {
        this.targetId = String(data.target_id);
        if (this.targetId === String(myPlayerId)) {
            this.target = inGrace ? null : this.scene.player;
        } else if (this.scene.playerSprites && this.scene.playerSprites.has(this.targetId)) {
            this.target = this.scene.playerSprites.get(this.targetId);
        } else {
            this.target = inGrace ? null : this.scene.player;
        }
    } else {
        this.target = inGrace ? null : this.scene.player;
    }

    // Orientar el sprite hacia el jugador siempre que esté enganchado con él
    // (persiguiendo, atacando o aturdido). Si no, según el movimiento. Antes el
    // estado hurt/knocked no actualizaba el flip y el enemigo quedaba mirando al
    // lado contrario del jugador si este se movía durante el aturdimiento.
    const engaged = this.fsm === STATES.CHASE || this.fsm === STATES.ATTACK ||
                    this.fsm === STATES.HURT || this.fsm === STATES.KNOCKED;
    if (this.target && this.target.active && engaged) {
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
    const dmg = this.hp - current; // positivo = daño recibido en este update del servidor
    this.hp = current;
    this.maxHp = max;
    this._drawHealthBar();

    // Número de daño flotante (solo si bajó HP; el primer sync entra como negativo).
    if (dmg > 0 && this.maxHp > 0) {
        spawnDamageNumber(this.scene, this.x, this.y - 30, dmg, { color: '#ffe066' });
    }

    // La muerte la decide el SERVIDOR. Llegar a 0 de vida no es morir: el golpe
    // mortal abre la Ninja Card y el enemigo solo cae si se acierta. Matarlo aquí
    // hacía que se reprodujera la animación de muerte mientras el servidor seguía
    // esperando la respuesta. Se espera a fsm_state='dead' o al evento enemy_died.
    if (this.hp <= 0 && this.fsm !== STATES.DEAD && !this.serverDriven) {
        this._changeState(STATES.DEAD);
    }
  }

  // Fuerza la animación de muerte ('dying'). A diferencia de updateHealth(), esto NO
  // está condicionado a !serverDriven: solo se llama desde EnemySystem al recibir el
  // evento enemy_died (autoritativo del servidor), así que aquí sabemos con certeza
  // que ya murió de verdad — no es la predicción local que ese guard evita.
  playDeathAnimation() {
    this._changeState(STATES.DEAD);
  }

  _drawHealthBar() {
    if (!this.healthBar) {
        this.healthBar = this.scene.add.graphics();
        this.add(this.healthBar);
    }
    
    this.healthBar.clear();

    // El boss muestra una barra más grande y alta para destacar como jefe.
    const isBoss = this.enemyType === 'boss';
    const width = isBoss ? 90 : 40;
    const height = isBoss ? 7 : 4;
    const x = -width / 2;
    const y = isBoss ? -56 : -40;

    // Background
    this.healthBar.fillStyle(0x000000, 0.7);
    this.healthBar.fillRect(x - 1, y - 1, width + 2, height + 2);

    // HP Fill
    const fillPercent = Math.max(0, this.hp / this.maxHp);
    const fillColor = fillPercent > 0.5 ? 0x00ff00 : (fillPercent > 0.25 ? 0xffff00 : 0xff0000);

    this.healthBar.fillStyle(fillColor, 1);
    this.healthBar.fillRect(x, y, width * fillPercent, height);

    // Borde dorado para el boss.
    if (isBoss) {
      this.healthBar.lineStyle(1.5, 0xffd700, 1);
      this.healthBar.strokeRect(x - 1, y - 1, width + 2, height + 2);
    }
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

    // HURT / KNOCKED / DEAD siempre interrumpen cualquier estado (incluido ATTACK)
    const isInterrupt = (
      newState === STATES.HURT ||
      newState === STATES.KNOCKED ||
      newState === STATES.DEAD
    );

    // Solo proteger la transición attack→chase/idle (no interrumpir el swing)
    if (!isInterrupt && this.fsm === STATES.ATTACK &&
        (newState === STATES.CHASE || newState === STATES.IDLE)) {
      const attackAnim = `${this._animPrefix()}-${this._resolveAnim(STATES.ATTACK)}`;
      if (this.sprite.anims.currentAnim?.key === attackAnim) return;
    }

    this.fsm = newState;

    // Mapeamos estado de combate → clave de animación que ya existe en NPCConfig
    const animKey = this._resolveAnim(newState);
    const fullAnimKey = `${this._animPrefix()}-${animKey}`;
    
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

  // Convierte estado FSM → nombre de animación base (set de enemigo o de boss).
  _resolveAnim(state) {
    if (this.enemyType === 'boss') {
      return BOSS_STATE_TO_ANIM[state] || 'idle';
    }
    return ENEMY_CONFIG.STATE_TO_ANIM[state] || 'idle';
  }

  // Prefijo de clave de animación: 'boss-<id>' para bosses, 'enemy-<id>' resto.
  _animPrefix() {
    if (this.enemyType === 'boss') {
      if (!this.bossId) {
        this.bossId = this.scene.textures.exists(`boss-${this.npcId}-base`) ? this.npcId : '1';
      }
      return `boss-${this.bossId}`;
    }
    return `enemy-${this.npcId}`;
  }

  // Cambia la textura/escala del sprite interno al set del boss (una vez).
  _setupBoss() {
    if (this._bossSetup) return;
    this._bossSetup = true;
    const prefix = this._animPrefix(); // resuelve this.bossId
    const baseKey = `${prefix}-base`;
    if (this.sprite && this.scene.textures.exists(baseKey)) {
      this.sprite.setTexture(baseKey);
      this.sprite.setScale(this._computeBossScale(baseKey));
    }
  }

  // Escala del boss normalizada por el alto de su frame de reposo, a 1.25× el objetivo
  // del personaje. Así un boss queda siempre ~1.25× el jugador aunque su hoja venga con
  // frames de otro tamaño. Si no encuentra el frame, cae al valor fijo de BossConfig.
  _computeBossScale(baseKey) {
    const tex = this.scene.textures.get(baseKey);
    // 'frame_000' es el primer frame del idle en la hoja base del boss.
    const frame = tex && tex.has('frame_000') ? tex.get('frame_000') : null;
    const h = frame?.height || 0;
    if (h > 0) return (TARGET_ENEMY_HEIGHT * BOSS_SIZE_FACTOR) / h;
    return getBossScale(this.bossId);
  }

  // Cadencia de ataque en ms. El servidor manda attack_rate (snake_case); el modo
  // local BeatEmUp usa attackRate (camelCase). Fallback 1200ms. Esto hace que un
  // enemigo 'fast' (attack_rate bajo) ataque notablemente más seguido.
  _getAttackRate() {
    return this.config?.attack_rate ?? this.config?.attackRate ?? 1200;
  }

  // ─── Recibir daño (llamado desde HitboxSystem) ───────────────────────────
  takeDamage(amount, knockbackVec) {
    if (this.fsm === STATES.DEAD) return;
    // También ignorar golpes mientras ya está en HURT (salvo que sea DEAD)
    // Quedarse sin vida NO es morir cuando manda el servidor: el golpe mortal
    // abre la Ninja Card y el enemigo solo cae si se acierta. Anticiparlo aquí
    // reproducía la animación de muerte con la pregunta todavía en pantalla.
    const canDieLocally = !this.serverDriven;

    if (this.fsm === STATES.HURT || this.fsm === STATES.KNOCKED) {
      // Acumular daño pero no re-triggear la animación
      this.hp -= amount;
      if (this.hp <= 0 && canDieLocally) this._changeState(STATES.DEAD);
      return;
    }

    this.hp -= amount;

    if (this.hp <= 0 && canDieLocally) {
      this._changeState(STATES.DEAD);
      return;
    }

    // Golpe fuerte → knocked (vuela), golpe normal → hurt
    const isStrong = amount >= (this.config?.knockThreshold ?? 20);
    this._changeState(isStrong ? STATES.KNOCKED : STATES.HURT);

    // T03: Reset cooldown → no puede atacar inmediatamente al recuperarse
    this.attackCooldown = this._getAttackRate() * 0.8;

    // T02: Parar inmediatamente antes del knockback
    if (this.body) this.body.setVelocity(0, 0);

    if (knockbackVec && this.body) {
      const force = isStrong ? 400 : 200;
      this.body.setVelocity(
        knockbackVec.x * force,
        knockbackVec.y * (force * 0.4)
      );
    }
  }

  // ─── Predicción local del golpe ───────────────────────────────────────────
  // Reproduce el hurt/knocked EN EL MISMO FRAME del impacto, sin esperar el
  // round-trip al servidor (con el tick de IA de 100ms el flinch llegaba
  // 100-250ms tarde y el hitstop congelaba la pose equivocada). El estado real
  // sigue siendo autoritativo: syncFromServer deja pasar los estados que son
  // consecuencia del golpe (hurt/knocked/dead/ninja_card) y, si el server nunca
  // confirma el stun, el stateTimer local expira y la FSM vuelve sola a chase.
  predictHit(isStrong = false) {
    if (!this.active || this.fsm === STATES.DEAD) return;
    // Durante la Ninja Card el enemigo está congelado esperando la respuesta:
    // no pisar ese estado con un flinch local.
    if (this.fsm === 'ninja_card') return;

    this._predictedHurtUntil = this.scene.time.now + 400;

    // Golpe encadenado durante un stun: re-disparar la animación de dolor para
    // que cada impacto se lea (el server extiende HurtUntil por su lado). Un
    // golpe fuerte durante un hurt normal sube el stun a knocked.
    if (this.fsm === STATES.HURT || this.fsm === STATES.KNOCKED) {
      if (isStrong && this.fsm === STATES.HURT) {
        this._changeState(STATES.KNOCKED);
        return;
      }
      const key = `${this._animPrefix()}-${this._resolveAnim(this.fsm)}`;
      if (this.scene.anims.exists(key)) this.sprite.play(key);
      this.stateTimer = Math.max(this.stateTimer, STATE_DURATION[this.fsm] ?? 350);
      return;
    }

    this._changeState(isStrong ? STATES.KNOCKED : STATES.HURT);
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
        // Enganchar al jugador por cercanía es decisión del SERVIDOR cuando la
        // sala manda (él reparte un atacante por jugador y manda a deambular al
        // resto). Predecirlo aquí hacía que un enemigo al que el servidor había
        // mandado a pasear se lanzara igual a por ti, tirando cada uno de su lado.
        // En el beat'em up no hay servidor: ahí la FSM local sí decide.
        if (!this.serverDriven && this._distToTarget() < (this.config?.detectRange ?? 280)) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.WANDER:
        // Paseo sin objetivo: la posición la marca el servidor (tramos cortos
        // alrededor de su punto de aparición), aquí solo se anima.
        if (this.body) this.body.setVelocity(0, 0);
        break;

      case STATES.CHASE:
        // Guard: si perdemos el target, volver a idle
        if (!this.target) {
          this._changeState(STATES.IDLE);
          break;
        }
        // Cuando manda el servidor, la POSICIÓN es suya: aquí solo se anima y se
        // mira hacia el jugador. Perseguir también en local arrastraba al enemigo
        // hacia el jugador entre tick y tick, incluso mientras el servidor lo
        // tenía clavado ejecutando el golpe: los rangos no coinciden (servidor
        // 90px, cliente 70), así que en esa franja el servidor decía "attack" y
        // el cliente seguía en "chase" empujando. De ahí el "se mueve mientras
        // ataca". En el beat'em up local no hay servidor y la FSM sí persigue.
        if (this.serverDriven || this.enemyType === 'thrower') {
          if (this.body) this.body.setVelocity(0, 0);
          if (this.target?.active) {
            this.setFacing(this.target.x < this.x ? 'left' : 'right');
          }
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
          const fullAnimKey = `${this._animPrefix()}-${animKey}`;
          if (this.scene.anims.exists(fullAnimKey)) {
              this.sprite.play(fullAnimKey, true);
          } else {
              this.playAnimation(animKey);
          }
          this._doAttack();
          this._attackHitDealt = false;
          this.attackCooldown = this._getAttackRate();
        }
        if (this._distToTarget() > (this.config?.attackRange ?? 70) + 20) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.SKILL:
        // El boss "canaliza" la habilidad: no se mueve, mira al jugador. El AoE
        // se dispara una vez al entrar al estado (ver syncFromServer → _doSkill).
        if (this.body) this.body.setVelocity(0, 0);
        if (this.target && this.target.active) {
          this.setFacing(this.target.x < this.x ? 'left' : 'right');
        }
        break;

      case STATES.CHARGE:
        // Embestida: la posición la mueve el servidor. Anular la velocidad local
        // evita que un knockback residual (takeDamage, ver KNOCKED) que no haya
        // decaído del todo se siga integrando por encima de la posición real.
        if (this.body) this.body.setVelocity(0, 0);
        // Aplica daño por contacto una sola vez por embestida (gateado por targetId).
        if (this.target && this.target.active && !this._chargeHitDealt) {
          const myPlayerId = this.scene.playerManager?.myPlayerId;
          const isMine = !this.targetId || !myPlayerId || this.targetId === myPlayerId;
          const d = this._distToTarget();
          if (isMine && d < 95) {
            this._chargeHitDealt = true;
            this.scene.events.emit('enemy-attack', {
              enemy: this,
              damage: Math.round((this.config?.damage ?? 10) * 1.35),
            });
          }
        }
        break;

      case STATES.THROW:
        // Enemigo a distancia: no se mueve, mira al jugador y lanza proyectiles
        // según su cadencia. El estado lo gobierna el servidor (fsm_state=throw).
        if (this.body) this.body.setVelocity(0, 0);
        if (this.target && this.target.active) {
          this.setFacing(this.target.x < this.x ? 'left' : 'right');
        }
        this.attackCooldown -= delta;
        if (this.attackCooldown <= 0) {
          const animKey = this._resolveAnim(STATES.THROW);
          const fullAnimKey = `${this._animPrefix()}-${animKey}`;
          if (this.scene.anims.exists(fullAnimKey)) {
            this.sprite.play(fullAnimKey, true);
          } else {
            this.playAnimation(animKey);
          }
          this._doThrow();
          this.attackCooldown = this._getAttackRate();
        }
        break;

      case STATES.HURT:
        // T02: Inmovilización total — no puede moverse ni atacar
        if (this.body) this.body.setVelocity(0, 0);
        if (this.stateTimer <= 0) {
          this._changeState(STATES.CHASE);
        }
        break;

      case STATES.KNOCKED:
        // Deslizamiento decelerado del knockback (tiene velocidad inicial)
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

  isTargetInAttackRange(target = this.target, padding = 0) {
    if (!target || !target.active) return false;

    const getBodyCenter = (obj) => {
      const body = obj?.body;
      if (body) {
        return {
          x: body.position.x + body.halfWidth,
          y: body.position.y + body.halfHeight,
        };
      }
      return { x: obj.x, y: obj.y };
    };

    const getCombatRadius = (obj, fallback = 25) => {
      const body = obj?.body;
      if (body) return Math.max(body.halfWidth, body.halfHeight);
      return fallback;
    };

    const selfCenter = getBodyCenter(this);
    const targetCenter = getBodyCenter(target);
    const selfRadius = getCombatRadius(this, 30);
    const targetRadius = getCombatRadius(target, 25);

    const centerDistance = Phaser.Math.Distance.Between(
      selfCenter.x, selfCenter.y,
      targetCenter.x, targetCenter.y
    );
    const edgeGap = centerDistance - (selfRadius + targetRadius);
    const verticalGap = Math.abs(selfCenter.y - targetCenter.y);
    const horizontalGap = Math.abs(selfCenter.x - targetCenter.x) - (selfRadius + targetRadius);

    // El servidor mueve al enemigo hasta ~90px (centro a centro) antes de pasar a 'attack'
    // (ver room.go attackRange = 90). El alcance del cliente debe cubrir esa distancia o el
    // enemigo "ataca pero no llega": a 90px el edgeGap ronda 35, así que damos margen.
    const baseRange = this.config?.attackRange ?? 90;
    const extraReach = Math.max(45, baseRange * 0.5) + padding;

    return verticalGap <= 80 && horizontalGap <= extraReach + 18 && edgeGap <= extraReach;
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
      this.sprite.setFlipX(dir === 'left');
    }
  }

  _doAttack() {
    // 1. Reproducir la animación de ataque para todos
    const animKey = this._resolveAnim(STATES.ATTACK);
    const fullAnimKey = `${this._animPrefix()}-${animKey}`;
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
    if (!this.isTargetInAttackRange(this.target, 8)) return;

    if (this._attackHitDealt) return;
    this._attackHitDealt = true;

    // Emitir evento — LobbyScene lo escucha para aplicar daño al jugador
    this.scene.events.emit('enemy-attack', {
      enemy:  this,
      damage: this.config?.damage ?? 10,
    });
  }

  // Lanza un proyectil enemigo hacia el jugador (tipo 'thrower'). Solo el cliente
  // que es el objetivo crea el proyectil "con daño"; los demás solo ven la anim.
  _doThrow() {
    const myPlayerId = this.scene.playerManager?.myPlayerId;
    if (this.targetId && myPlayerId && this.targetId !== myPlayerId) return;
    if (!this.target || !this.target.active) return;

    const scene = this.scene;

    // Textura de proyectil enemigo (círculo rojo) — fallback siempre disponible.
    if (!scene.textures.exists('enemy-projectile')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xff3344, 1);
      g.fillCircle(10, 10, 7);
      g.lineStyle(2, 0xffaa88, 0.9);
      g.strokeCircle(10, 10, 9);
      g.generateTexture('enemy-projectile', 20, 20);
      g.destroy();
    }

    // Si el thrower tiene un sprite de proyectil asignado (icon_key), úsalo; si no
    // está cargado, se carga on-demand y se reemplaza en vuelo. Fallback: círculo.
    const iconKey = this.config?.projectile_sprite;
    const spriteKey = iconKey ? `item-sprite-${iconKey}` : null;
    const hasSprite = spriteKey && scene.textures.exists(spriteKey);
    const initialKey = hasSprite ? spriteKey : 'enemy-projectile';

    // Fit into a 24px box preserving aspect ratio (avoids squishing non-square PNGs).
    const fitProjectile = (sprite) => {
      const img = sprite.texture?.getSourceImage?.();
      const w = img?.width || 24, h = img?.height || 24;
      const s = 24 / Math.max(w, h);
      sprite.setDisplaySize(w * s, h * s);
    };

    const proj = scene.physics.add.sprite(this.x, this.y - 10, initialKey);
    if (hasSprite) fitProjectile(proj);
    proj.setDepth(this.depth + 5);
    proj.body.setAllowGravity(false);

    // Antes se omitía la carga cuando el loader estaba ocupado (`!isLoading()`),
    // así que el icono no llegaba nunca si coincidía con otra carga.
    if (!hasSprite) {
      ensureItemSprite(scene, iconKey, (key) => {
        if (proj.active) {
          proj.setTexture(key);
          fitProjectile(proj);
        }
      });
    }

    playGameSfx(scene, 'sfx_throw_knife');

    // Dirigir hacia la posición actual del jugador (velocidad balanceada para esquivar con paso lateral).
    const speed = 210;
    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    proj.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    // Spin as it travels, in the horizontal direction of flight.
    proj.body.setAngularVelocity((Math.cos(angle) >= 0 ? 1 : -1) * 540);

    scene.time.delayedCall(2500, () => { if (proj.active) proj.destroy(); });

    const damage = this.config?.damage ?? 10;
    scene.physics.add.overlap(proj, this.target, (projectile) => {
      // Reutiliza el flujo de daño del jugador (HP/iframes en CombatSystem).
      scene.events.emit('enemy-attack', { enemy: this, damage });
      projectile.destroy();
    });
  }

  // Habilidad AoE del boss (type=boss). Telegrafía un círculo de daño; tras una
  // demora justa (1000ms), si el jugador sigue dentro, recibe daño aumentado (puede esquivar).
  _doSkill() {
    const myPlayerId = this.scene.playerManager?.myPlayerId;
    if (this.targetId && myPlayerId && this.targetId !== myPlayerId) return;
    if (!this.target || !this.target.active) return;

    const scene = this.scene;
    playGameSfx(scene, 'sfx_skill');
    const radius = 130; // Radio balanceado y legible

    const gfx = scene.add.circle(this.x, this.y, radius, 0xff3344, 0.22).setDepth(this.depth - 1);
    gfx.setStrokeStyle(3, 0xff3344, 0.9);
    scene.tweens.add({ targets: gfx, alpha: 0.05, scale: 1.08, duration: 1100, onComplete: () => gfx.destroy() });

    const damage = Math.round((this.config?.damage ?? 10) * 1.35);
    scene.time.delayedCall(1000, () => {
      if (!this.target || !this.target.active) return;
      const d = window.Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (d <= radius) {
        scene.events.emit('enemy-attack', { enemy: this, damage });
      }
    });
  }

  // Destello dorado + pulso al quedar congelado en 'ninja_card' (ver syncFromServer).
  // Puramente cosmético: comunica "está pasando algo" durante el hueco entre que el
  // servidor lo marca y que el modal de la carta termina de cargar.
  _flashNinjaCardCue() {
    if (this.sprite) {
      this.sprite.setTint(0xffd700);
      this.scene.time.delayedCall(500, () => {
        if (this.active && this.sprite) this.sprite.clearTint();
      });
    }
    const glow = this.scene.add.circle(this.x, this.y, 34, 0xffd700, 0.35).setDepth(this.depth - 1);
    this.scene.tweens.add({
      targets: glow,
      scale: 1.8,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy(),
    });
  }
}
