/**
 * ComboHUD — Contador visual de combo estilo arcade
 *
 * Escucha eventos:
 *   'combo-step'  { step, label }  → muestra "N HIT!!"
 *   'combo-reset'                  → desvanece el contador
 *   'player-hit'  { damage }       → flash de daño
 */
export default class ComboHUD {
  constructor(scene) {
    this.scene       = scene;
    this.hitCount    = 0;
    this.fadeTimer   = null;
    this._container  = null;
    this._hitText    = null;
    this._labelText  = null;

    this._build();
    this._bindEvents();
  }

  // ── Construcción ─────────────────────────────────────────────────────────

  _build() {
    // Posición: centro-derecha, encima de la línea de fondo
    const cx = 580;
    const cy = 260;

    this._container = this.scene.add.container(cx, cy).setDepth(500).setAlpha(0);

    // Número de hits (grande)
    this._hitText = this.scene.add.text(0, 0, '0', {
      fontSize:        '56px',
      fontFamily:      '"Press Start 2P", monospace',
      color:           '#ffffff',
      stroke:          '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
    }).setOrigin(0.5, 0.5);

    // Etiqueta "HIT!!"
    this._labelText = this.scene.add.text(0, 46, 'HIT!!', {
      fontSize:        '14px',
      fontFamily:      '"Press Start 2P", monospace',
      color:           '#ffdd00',
      stroke:          '#aa6600',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    this._container.add([this._hitText, this._labelText]);
  }

  _bindEvents() {
    this.scene.events.on('combo-step',  this._onComboStep,  this);
    this.scene.events.on('combo-reset', this._onComboReset, this);
    this.scene.events.on('player-hit',  this._onPlayerHit,  this);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  _onComboStep({ step, label }) {
    this.hitCount = label;
    this._hitText.setText(String(label));

    // Color progresivo según el paso del combo
    const colors = ['#ffffff', '#ffff88', '#ffaa00'];
    const color  = colors[Math.min(step, colors.length - 1)];
    this._hitText.setStyle({ color });

    // Animación de escala (pop)
    const scale = 1 + step * 0.12;
    this._container.setAlpha(1).setScale(0.5);
    this.scene.tweens.add({
      targets:  this._container,
      scaleX:   scale,
      scaleY:   scale,
      duration: 120,
      ease:     'Back.Out',
    });

    // Si es el finisher (step 2) → sacudir y poner rojo
    if (step >= 2) {
      this._hitText.setStyle({ color: '#ff4400' });
      this._labelText.setText('COMBO!!');
      this.scene.cameras.main.shake(180, 0.008);
    } else {
      this._labelText.setText('HIT!!');
    }

    // Reiniciar el temporizador de desvanecimiento
    if (this.fadeTimer) this.fadeTimer.remove();
    this.fadeTimer = this.scene.time.delayedCall(1800, () => {
      this._fadeOut();
    });
  }

  _onComboReset() {
    if (this.fadeTimer) this.fadeTimer.remove();
    this.fadeTimer = this.scene.time.delayedCall(600, () => {
      this._fadeOut();
    });
    this.hitCount = 0;
  }

  _onPlayerHit({ damage }) {
    // Flash rojo corto cuando el jugador recibe daño
    const flash = this.scene.add.rectangle(400, 300, 800, 600, 0xff0000, 0.25)
      .setDepth(998);
    this.scene.tweens.add({
      targets: flash, alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  _fadeOut() {
    this.scene.tweens.add({
      targets:  this._container,
      alpha:    0,
      scaleX:   0.8,
      scaleY:   0.8,
      duration: 400,
      ease:     'Power2',
    });
  }

  handleResize(gameSize) {
    const W = gameSize.width;
    const H = gameSize.height;

    const cx = W * 0.725;
    const cy = H * 0.433;

    if (this._container) {
      this._container.setPosition(cx, cy);
    }
  }

  destroy() {
    this.scene.events.off('combo-step',  this._onComboStep,  this);
    this.scene.events.off('combo-reset', this._onComboReset, this);
    this.scene.events.off('player-hit',  this._onPlayerHit,  this);
    this._container?.destroy();
  }
}
