/**
 * ComboSystem — Sistema de combos estilo Final Fight
 *
 * Lógica de Link Window:
 *   El siguiente golpe del combo SOLO se acepta durante los últimos frames
 *   de la animación actual (linkFrame en PLAYER_ATTACKS o automático).
 *   Presionar antes encola el input; presionar después resetea el combo.
 */

// Secuencia del combo de puños en orden
const COMBO_SEQUENCE = ['combo1', 'combo2', 'combo3_finisher'];

export default class ComboSystem {
  /**
   * @param {Phaser.Scene}    scene
   * @param {PlayerSprite}    player
   * @param {HitboxSystem}    hitboxSystem
   */
  constructor(scene, player, hitboxSystem) {
    this.scene        = scene;
    this.player       = player;
    this.hitboxSystem = hitboxSystem;

    // Estado del combo
    this.comboStep        = 0;      // 0 = libre, 1 = después de combo1, 2 = después de combo2
    this.nextInputQueued  = false;  // Input presionado durante la animación activa
    this.inLinkWindow     = false;  // ¿Estamos en la ventana de link?
    this.isBusy           = false;  // ¿Hay un ataque combo activo?

    // Escuchar eventos de animación del sprite interno del jugador
    this.player.sprite.on('animationupdate',  this._onAnimFrame.bind(this));
    this.player.sprite.on('animationcomplete', this._onAnimComplete.bind(this));
  }

  // ── API Pública ──────────────────────────────────────────────────────────

  /** Llamado cuando el jugador presiona el botón de puño (Z) */
  onPunchInput() {
    if (this.hitboxSystem.isAttacking) {
      // Durante la animación: encolar si hay slot disponible y no está ya en queue
      if (!this.nextInputQueued && this.comboStep < COMBO_SEQUENCE.length - 1) {
        this.nextInputQueued = true;

        // Si ya estamos en link window, ejecutar inmediatamente
        if (this.inLinkWindow) {
          this._advanceCombo();
        }
      }
      return;
    }

    // Libre → iniciar o continuar el combo
    if (this.comboStep === 0 || !this.isBusy) {
      this._executeComboStep(0);
    }
  }

  /** Reset completo (llamado externamente si el jugador recibe daño, muere, etc.) */
  reset() {
    this.comboStep       = 0;
    this.nextInputQueued = false;
    this.inLinkWindow    = false;
    this.isBusy          = false;
    this.scene.events.emit('combo-reset');
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  _executeComboStep(step) {
    this.comboStep       = step;
    this.nextInputQueued = false;
    this.inLinkWindow    = false;
    this.isBusy          = true;

    const attackKey = COMBO_SEQUENCE[step];
    this.hitboxSystem.startAttack(attackKey);

    // Emitir para el HUD (muestra 1, 2, 3 HIT)
    this.scene.events.emit('combo-step', { step, label: step + 1 });
  }

  _advanceCombo() {
    const nextStep = this.comboStep + 1;
    if (nextStep < COMBO_SEQUENCE.length) {
      this._executeComboStep(nextStep);
    } else {
      // Llegamos al finisher, el combo terminó
      this.reset();
    }
  }

  /** Escucha cada frame de la animación para detectar cuándo entrar en link window */
  _onAnimFrame(anim, frame) {
    if (!this.hitboxSystem.isAttacking) return;

    // Solo nos importan los frames de las animaciones del combo
    const currentKey = anim.key; // ej: "char-1-combo1"
    const isComboAnim = COMBO_SEQUENCE.some(k => currentKey.includes(k));
    if (!isComboAnim) return;

    const totalFrames = anim.frames.length;
    // Activar link window en los últimos 2 frames
    if (frame.index >= totalFrames - 2 && !this.inLinkWindow) {
      this.inLinkWindow = true;

      // Si había un input en cola → avanzar inmediatamente
      if (this.nextInputQueued && this.comboStep < COMBO_SEQUENCE.length - 1) {
        this._advanceCombo();
      }
    }
  }

  /** Cuando termina una animación de combo */
  _onAnimComplete(anim) {
    const key = anim.key;
    const isComboAnim = COMBO_SEQUENCE.some(k => key.includes(k));
    if (!isComboAnim) return;

    // Si era el último paso o no hubo continuación → reset
    this.isBusy = false;
    if (this.comboStep >= COMBO_SEQUENCE.length - 1 || !this.nextInputQueued) {
      this.reset();
    }
  }
}
