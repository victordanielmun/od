/**
 * ItemInventory — Gestión de items consumibles en el Beat 'em up
 *
 * Emite 'inventory-changed' cada vez que el conteo cambia.
 */
export default class ItemInventory {
  /**
   * @param {Phaser.Scene} scene
   * @param {number|object} initialSpells   Spells al inicio (número o mapa {fire_rain, wave, nova})
   * @param {number} initialPotions  Pociones al inicio
   */
  constructor(scene, initialSpells = 3, initialPotions = 2, initialManaPotions = 2, initialThrowingDaggers = 5) {
    this.scene   = scene;
    
    if (typeof initialSpells === 'number') {
      this.spells = {
        fire_rain: initialSpells,
        wave: 0,
        nova: 0
      };
    } else if (initialSpells && typeof initialSpells === 'object') {
      this.spells = {
        fire_rain: initialSpells.fire_rain || 0,
        wave:      initialSpells.wave || 0,
        nova:      initialSpells.nova || 0
      };
    } else {
      this.spells = { fire_rain: 0, wave: 0, nova: 0 };
    }

    this.potions = initialPotions;
    this.manaPotions = initialManaPotions;
    this.throwingDaggers = initialThrowingDaggers;
    this.maxSpells  = 9;
    this.maxPotions = 9;
    this.maxManaPotions = 9;
    this.maxThrowingDaggers = 20;
  }

  // ── Consultas ────────────────────────────────────────────────────────────
  hasSpell()  { return Object.values(this.spells).some(q => q > 0); }
  hasSpellType(type) { return (this.spells[type] || 0) > 0; }
  hasPotion() { return this.potions > 0; }
  hasManaPotion() { return this.manaPotions > 0; }
  hasThrowingDagger() { return this.throwingDaggers > 0; }
  getState()  { return { spells: this.spells, potions: this.potions, manaPotions: this.manaPotions, throwingDaggers: this.throwingDaggers }; }

  // ── Consumo ──────────────────────────────────────────────────────────────

  consumeSpell(type) {
    // Los spells no se consumen al usarse (se requiere tener el scroll)
    if (type) return this.hasSpellType(type);
    return this.hasSpell();
  }

  consumePotion() {
    if (this.potions <= 0) return false;
    this.potions--;
    this._emit();
    return true;
  }

  consumeManaPotion() {
    if (this.manaPotions <= 0) return false;
    this.manaPotions--;
    this._emit();
    return true;
  }

  consumeThrowingDagger() {
    if (this.throwingDaggers <= 0) return false;
    this.throwingDaggers--;
    this._emit();
    return true;
  }

  // ── Adición (drops de enemigos) ──────────────────────────────────────────

  addSpell(n = 1) {
    this.addSpellType('fire_rain', n);
  }

  addSpellType(type, n = 1) {
    if (this.spells[type] !== undefined) {
      this.spells[type] = Math.min(this.spells[type] + n, this.maxSpells);
      this._emit();
    }
  }

  addPotion(n = 1) {
    this.potions = Math.min(this.potions + n, this.maxPotions);
    this._emit();
  }

  addManaPotion(n = 1) {
    this.manaPotions = Math.min(this.manaPotions + n, this.maxManaPotions);
    this._emit();
  }

  addThrowingDagger(n = 1) {
    this.throwingDaggers = Math.min(this.throwingDaggers + n, this.maxThrowingDaggers);
    this._emit();
  }

  // ── Privado ──────────────────────────────────────────────────────────────
  _emit() {
    this.scene.events.emit('inventory-changed', this.getState());
  }
}
