/**
 * BeatEmUpHUD — HUD de combate con Quick Slot de hechizo + badge de arrojadizos
 *
 * Las pociones (vida y maná) se beben solas cuando hacen falta (ver
 * PlayerController._checkAutoHealthPotion / _checkAutoManaPotion), así que ya
 * no ocupan slot ni tecla: este HUD solo muestra lo que el jugador SÍ elige
 * activamente — el pergamino equipado y las dagas disponibles.
 *
 * Layout:
 *   TOP-LEFT  : Barra de HP/MP
 *   BTM-RIGHT : Slot de hechizo activo (clickeable / touch)
 *               + Badge de arrojadizo (clickeable / touch)
 *
 * Controles resultantes:
 *   Flechas    → Movimiento
 *   Z          → Punch combo (Z→Z→Z = jab→cross→uppercut)
 *   X          → Kick / Strong (tap = kick, hold >400ms = strong)
 *   C / SPACE  → Lanzar el hechizo activo (teclado)
 *   V          → Lanzar arrojadizo (teclado)
 *   Click/Tap del slot de hechizo → lanzar hechizo
 *   Click/Tap del badge de arrojadizo → lanzar arrojadizo
 *
 * Eventos emitidos:
 *   'quickslot-use'    → el jugador quiere lanzar el hechizo activo
 *   'quickslot-throw'  → el jugador quiere lanzar un arrojadizo
 *
 * Eventos escuchados:
 *   'player-damaged'     { hp, maxHp, mp, maxMp }
 *   'inventory-changed'  { spells, throwingDaggers }
 */
export default class BeatEmUpHUD {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene    = scene;
    this._hp      = 100;
    this._maxHp   = 100;
    this._mp      = 50;
    this._maxMp   = 50;
    this._spells  = { fire_rain: 0, wave: 0, nova: 0 };
    this._throwingDaggers = 0;
    this._activeSpell = 'fire_rain';

    this._buildHP();
    this._buildQuickSlot();
    this._bindEvents();
  }

    // ── HP & MP Bars (esquina superior izquierda) ───────────────────────────

  _buildHP() {
    const x = 16, y = 16;

    // Panel fondo semitransparente estilo medieval-dark / glassmorphism
    this._hpPanel = this.scene.add.graphics().setDepth(600).setScrollFactor(0);
    this._hpPanel.fillStyle(0x001C14, 0.75); // Verde Botella Casi Negro
    this._hpPanel.fillRoundedRect(x - 6, y - 4, 212, 34, 6);

    // Borde doble elegante (oro cálido y bronce)
    this._hpPanel.lineStyle(1.5, 0xF7C42D, 0.85); // Oro
    this._hpPanel.strokeRoundedRect(x - 6, y - 4, 212, 34, 6);
    this._hpPanel.lineStyle(0.75, 0x8b6d1b, 0.5); // Bronce
    this._hpPanel.strokeRoundedRect(x - 8, y - 6, 216, 38, 8);

    // HP Label
    this._hpLabel = this.scene.add.text(x, y + 1, 'HP', {
      fontSize:   '10px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#10b981', // Verde esmeralda vibrante
      stroke:     '#000000',
      strokeThickness: 2,
    }).setDepth(601).setScrollFactor(0);

    // Fondo HP bar (charcoal oscuro con borde fino)
    this._hpBarBg = this.scene.add.graphics().setDepth(601).setScrollFactor(0);
    this._hpBarBg.fillStyle(0x151515, 0.9);
    this._hpBarBg.fillRoundedRect(x + 28, y + 2, 140, 8, 2);
    this._hpBarBg.lineStyle(1, 0x8b6d1b, 0.4);
    this._hpBarBg.strokeRoundedRect(x + 28, y + 2, 140, 8, 2);

    // HP Barra activa
    this._hpBar = this.scene.add.graphics().setDepth(602).setScrollFactor(0);

    // HP Números
    this._hpNumbers = this.scene.add.text(x + 174, y - 1, '100', {
      fontSize:   '10px',
      fontFamily: '"Montserrat", sans-serif',
      fontWeight: 'bold',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setDepth(603).setScrollFactor(0);

    // MP Label
    this._mpLabel = this.scene.add.text(x, y + 15, 'MP', {
      fontSize:   '10px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#00a8ff', // Azul maná
      stroke:     '#000000',
      strokeThickness: 2,
    }).setDepth(601).setScrollFactor(0);

    // Fondo MP bar (charcoal oscuro con borde fino)
    this._mpBarBg = this.scene.add.graphics().setDepth(601).setScrollFactor(0);
    this._mpBarBg.fillStyle(0x151515, 0.9);
    this._mpBarBg.fillRoundedRect(x + 28, y + 16, 140, 8, 2);
    this._mpBarBg.lineStyle(1, 0x003049, 0.4);
    this._mpBarBg.strokeRoundedRect(x + 28, y + 16, 140, 8, 2);

    // MP Barra activa
    this._mpBar = this.scene.add.graphics().setDepth(602).setScrollFactor(0);

    // MP Números
    this._mpNumbers = this.scene.add.text(x + 174, y + 13, '50', {
      fontSize:   '10px',
      fontFamily: '"Montserrat", sans-serif',
      fontWeight: 'bold',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setDepth(603).setScrollFactor(0);

    this._drawHPBar(100, 100);
    this._drawMPBar(50, 50);
  }

  // ── Quick Slot (esquina inferior derecha) ────────────────────────────────

  _buildQuickSlot() {
    const W = this.scene.scale.width  || 800;
    const H = this.scene.scale.height || 600;

    const SLOT_W = 76;
    const SLOT_H = 76;
    const PAD    = 14;

    const ax = W - SLOT_W - PAD;
    const ay = H - SLOT_H - PAD - 42;

    this._slotBg = this.scene.add.graphics().setDepth(600).setScrollFactor(0);

    // Ícono del slot activo
    this._slotIcon = this.scene.add.text(ax + SLOT_W / 2, ay + SLOT_H / 2 - 10, '✦', {
      fontSize:   '28px',
      color:      '#ffdd44',
      stroke:     '#000000',
      strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(602).setScrollFactor(0);

    // Etiqueta tipo
    this._slotLabel = this.scene.add.text(ax + SLOT_W / 2, ay + SLOT_H - 20, 'SPELL', {
      fontSize:   '7px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#ffdd44',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(602).setScrollFactor(0);

    // Contador del slot activo
    this._slotCount = this.scene.add.text(ax + SLOT_W - 8, ay + 8, 'x0', {
      fontSize:   '9px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(603).setScrollFactor(0);

    // Hint [SPACE] para desktop
    this._spaceHint = this.scene.add.text(ax + SLOT_W / 2, ay - 12, '[SPACE]', {
      fontSize:   '8px',
      fontFamily: '"Montserrat", sans-serif',
      fontWeight: 'bold',
      color:      '#bbbbbb',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(602).setScrollFactor(0);

    // Zona interactiva (touch / click)
    this._slotZone = this.scene.add.zone(ax, ay, SLOT_W, SLOT_H)
      .setOrigin(0).setDepth(605).setScrollFactor(0).setInteractive({ useHandCursor: true });

    this._slotZone.on('pointerdown', () => this.scene.events.emit('quickslot-use'));
    
    // Corregir closures usando this._slotPos
    this._slotZone.on('pointerover', () => {
      const p = this._slotPos;
      if (p) this._drawSlotBg(this._slotBg, p.ax, p.ay, p.SLOT_W, p.SLOT_H, true, true);
    });
    this._slotZone.on('pointerout',  () => {
      const p = this._slotPos;
      if (p) this._drawSlotBg(this._slotBg, p.ax, p.ay, p.SLOT_W, p.SLOT_H, true, false);
    });

    // ── Badge de arrojadizo (pequeño, debajo — ya no es un slot swapeable) ──
    const sx = W - SLOT_W - PAD;
    const sy = H - 40 - PAD;
    const SW = SLOT_W;
    const SH = 36;

    this._secBg = this.scene.add.graphics().setDepth(600).setScrollFactor(0);

    this._secIcon = this.scene.add.text(sx + 14, sy + SH / 2, '🗡', {
      fontSize:   '16px',
      color:      '#66ddff',
      stroke:     '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, stroke: true, fill: true }
    }).setOrigin(0, 0.5).setDepth(602).setScrollFactor(0);

    this._secLabel = this.scene.add.text(sx + 36, sy + SH / 2 - 8, 'DAGGER', {
      fontSize:   '7px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#66ddff',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(602).setScrollFactor(0);

    this._secCount = this.scene.add.text(sx + SW - 8, sy + 6, 'x0', {
      fontSize:   '8px',
      fontFamily: '"Press Start 2P", monospace',
      color:      '#ffffff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(603).setScrollFactor(0);

    // Zona interactiva: tocar el badge lanza un arrojadizo (igual que la tecla V).
    this._throwZone = this.scene.add.zone(sx, sy, SW, SH)
      .setOrigin(0).setDepth(605).setScrollFactor(0).setInteractive({ useHandCursor: true });

    this._throwZone.on('pointerdown', () => this.scene.events.emit('quickslot-throw'));

    // Corregir closures usando this._slotPos
    this._throwZone.on('pointerover', () => {
      const p = this._slotPos;
      if (p) this._drawSlotBg(this._secBg, p.sx, p.sy, p.SW, p.SH, false, true);
    });
    this._throwZone.on('pointerout',  () => {
      const p = this._slotPos;
      if (p) this._drawSlotBg(this._secBg, p.sx, p.sy, p.SW, p.SH, false, false);
    });

    // Guardar posiciones para redraws e inicializar
    this._slotPos = { ax, ay, SLOT_W, SLOT_H, sx, sy, SW, SH };
    this._drawSlotBg(this._slotBg, ax, ay, SLOT_W, SLOT_H, true);
    this._drawSlotBg(this._secBg, sx, sy, SW, SH, false);
  }

  // ── Draw helpers ─────────────────────────────────────────────────────────

  _drawSlotBg(gfx, x, y, w, h, isMain, hover = false) {
    gfx.clear();
    const alpha  = hover ? 0.90 : 0.75;
    // Slot principal (hechizo): dorado. Badge de arrojadizo: celeste, fijo — ya
    // no hay nada que "intercambiar", solo muestran lo que está activo.
    const border = hover ? 0xffffff : (isMain ? 0xF7C42D : 0x66ddff);

    // Glow effect (outer glow)
    if (isMain) {
      gfx.lineStyle(4, border, hover ? 0.35 : 0.2);
      gfx.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 10);
    } else {
      gfx.lineStyle(2, border, hover ? 0.2 : 0.1);
      gfx.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 9);
    }

    // Translucent dark fill (Verde Botella Casi Negro)
    gfx.fillStyle(0x001C14, alpha);
    gfx.fillRoundedRect(x, y, w, h, 8);

    // Double border
    gfx.lineStyle(1.5, border, hover ? 1.0 : 0.8);
    gfx.strokeRoundedRect(x, y, w, h, 8);
    
    gfx.lineStyle(0.75, 0x8b6d1b, hover ? 0.6 : 0.4);
    gfx.strokeRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, 9.5);
  }

  _drawHPBar(hp, maxHp) {
    this._hpBar.clear();
    const x = 16, y = 16;
    const W = 140, H = 8;
    const pct   = Math.max(0, Math.min(1, hp / maxHp));
    const fillW = pct * W;

    const color = pct > 0.5 ? 0x10b981 : (pct > 0.25 ? 0xF7C42D : 0xE14B26);

    if (fillW > 2) {
      this._hpBar.fillStyle(color, 1);
      this._hpBar.fillRoundedRect(x + 28, y + 2, fillW, H, 2);
      // Shiny overlay
      this._hpBar.fillStyle(0xffffff, 0.15);
      this._hpBar.fillRoundedRect(x + 28, y + 2, fillW, H / 2, 2);
    }
  }

  _drawMPBar(mp, maxMp) {
    this._mpBar.clear();
    const x = 16, y = 16;
    const W = 140, H = 8;
    const pct   = Math.max(0, Math.min(1, mp / maxMp));
    const fillW = pct * W;

    const color = 0x00a8ff; // Mana Blue

    if (fillW > 2) {
      this._mpBar.fillStyle(color, 1);
      this._mpBar.fillRoundedRect(x + 28, y + 16, fillW, H, 2);
      // Shiny overlay
      this._mpBar.fillStyle(0xffffff, 0.15);
      this._mpBar.fillRoundedRect(x + 28, y + 16, fillW, H / 2, 2);
    }
  }

  // ── Refresco del HUD ──────────────────────────────────────────────────────

  _refreshSlotUI() {
    const spellsObj = typeof this._spells === 'object' ? this._spells : { fire_rain: this._spells || 0, wave: 0, nova: 0 };
    const activeSpellKey = this._activeSpell || 'fire_rain';

    const spellMeta = {
      fire_rain: { icon: '🔥', label: 'FIRE RAIN', color: '#ff7722' },
      wave:      { icon: '🌊', label: 'WAVE',      color: '#33ccff' },
      nova:      { icon: '💥', label: 'NOVA',      color: '#cc55ff' }
    };
    const activeMeta = spellMeta[activeSpellKey] || { icon: '✦', label: 'SPELL', color: '#ffdd44' };

    const mainCount = spellsObj[activeSpellKey] || 0;
    const secCount  = this._throwingDaggers || 0;

    const hasMain = mainCount > 0;

    this._slotIcon.setText(activeMeta.icon).setStyle({ color: activeMeta.color });
    this._slotLabel.setText(activeMeta.label).setStyle({ color: activeMeta.color });
    this._slotCount.setText(`x${mainCount}`);
    this._slotIcon.setAlpha(hasMain ? 1 : 0.35);
    this._slotCount.setAlpha(hasMain ? 1 : 0.35);

    this._secCount.setText(`x${secCount}`);
    const hasSec = secCount > 0;
    this._secIcon.setAlpha(hasSec ? 1 : 0.35);
    this._secCount.setAlpha(hasSec ? 1 : 0.35);

    // Update border color of main and sec graphics slots
    const p = this._slotPos;
    if (p) {
      this._drawSlotBg(this._slotBg, p.ax, p.ay, p.SLOT_W, p.SLOT_H, true);
      this._drawSlotBg(this._secBg, p.sx, p.sy, p.SW, p.SH, false);
    }

    // Pulsar hint de SPACE si no hay hechizo
    this._spaceHint.setAlpha(hasMain ? 0.6 : 0.25);
  }

  syncActiveSpell(spellKey) {
    this._activeSpell = spellKey;
    this._refreshSlotUI();
  }

    // ── Eventos del juego ────────────────────────────────────────────────────

  _bindEvents() {
    this.scene.events.on('player-damaged',    this._onPlayerDamaged,   this);
    this.scene.events.on('inventory-changed', this._onInventoryChanged, this);
  }

  _onPlayerDamaged({ hp, maxHp, mp, maxMp }) {
    this._hp    = hp;
    this._maxHp = maxHp;
    this._mp    = mp ?? this._mp;
    this._maxMp = maxMp ?? this._maxMp;
    this._drawHPBar(hp, maxHp);
    this._drawMPBar(this._mp, this._maxMp);
    this._hpNumbers.setText(`${Math.max(0, Math.ceil(hp))}`);
    this._mpNumbers.setText(`${Math.max(0, Math.ceil(this._mp))}`);
  }

  _onInventoryChanged({ spells, throwingDaggers }) {
    this._spells = spells;
    this._throwingDaggers = throwingDaggers ?? this._throwingDaggers;
    this._refreshSlotUI();
  }

  // ── Responsividad / Ajuste de tamaño ─────────────────────────────────────

  handleResize(gameSize) {
    const W = gameSize.width;
    const H = gameSize.height;

    const SLOT_W = 76;
    const SLOT_H = 76;
    const PAD    = 14;

    const ax = W - SLOT_W - PAD;
    const ay = H - SLOT_H - PAD - 42;

    const sx = W - SLOT_W - PAD;
    const sy = H - 40 - PAD;
    const SW = SLOT_W;
    const SH = 36;

    // Actualizar coordenadas de los elementos del slot activo
    if (this._slotIcon) this._slotIcon.setPosition(ax + SLOT_W / 2, ay + SLOT_H / 2 - 10);
    if (this._slotLabel) this._slotLabel.setPosition(ax + SLOT_W / 2, ay + SLOT_H - 20);
    if (this._slotCount) this._slotCount.setPosition(ax + SLOT_W - 8, ay + 8);
    if (this._spaceHint) this._spaceHint.setPosition(ax + SLOT_W / 2, ay - 12);
    if (this._slotZone) {
      this._slotZone.setPosition(ax, ay);
    }

    // Actualizar coordenadas de los elementos del slot secundario
    if (this._secIcon) this._secIcon.setPosition(sx + 14, sy + SH / 2);
    if (this._secLabel) this._secLabel.setPosition(sx + 36, sy + SH / 2 - 8);
    if (this._secCount) this._secCount.setPosition(sx + SW - 8, sy + 6);
    if (this._throwZone) {
      this._throwZone.setPosition(sx, sy);
    }

    // Guardar posiciones para redraws
    this._slotPos = { ax, ay, SLOT_W, SLOT_H, sx, sy, SW, SH };

    // Redibujar fondos
    this._refreshSlotUI();
  }

  // ── API Pública ──────────────────────────────────────────────────────────

  syncState(hp, maxHp, mp, maxMp, spells, throwingDaggers) {
    this._onPlayerDamaged({ hp, maxHp, mp, maxMp });
    this._onInventoryChanged({ spells, throwingDaggers });
  }

  destroy() {
    this.scene.events.off('player-damaged',    this._onPlayerDamaged,   this);
    this.scene.events.off('inventory-changed', this._onInventoryChanged, this);
    
    // Limpieza de objetos del juego
    this._hpPanel?.destroy();
    this._hpLabel?.destroy();
    this._hpBarBg?.destroy();
    this._hpBar?.destroy();
    this._hpNumbers?.destroy();
    this._mpLabel?.destroy();
    this._mpBarBg?.destroy();
    this._mpBar?.destroy();
    this._mpNumbers?.destroy();
    
    this._slotBg?.destroy();
    this._slotIcon?.destroy();
    this._slotLabel?.destroy();
    this._slotCount?.destroy();
    this._spaceHint?.destroy();
    this._slotZone?.destroy();
    
    this._secBg?.destroy();
    this._secIcon?.destroy();
    this._secLabel?.destroy();
    this._secCount?.destroy();
    this._throwZone?.destroy();
  }
}
