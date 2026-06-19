const Phaser = window.Phaser;

// Combat action keys → CombatSystem handler name. Each only fires while the
// canvas is focused and the player isn't typing in an HTML field.
const COMBAT_KEYS = [
  ['J', 'handlePlayerAttack'],
  ['K', 'handlePlayerCombo'],
  ['L', 'handlePlayerSpell'],
  ['U', 'handlePlayerThrow'],
  ['Q', 'handlePlayerPotion'],
  ['R', 'handlePlayerManaPotion'],
];

// Virtual (on-screen touch) button → CombatSystem handler for action buttons.
const VIRTUAL_ACTIONS = {
  attack: 'handlePlayerAttack',
  combo: 'handlePlayerCombo',
  spell: 'handlePlayerSpell',
  throw: 'handlePlayerThrow',
  potion: 'handlePlayerPotion',
  manaPotion: 'handlePlayerManaPotion',
  dash: 'handlePlayerDash',
};

// Owns the LobbyScene's keyboard / pointer / virtual input wiring and the
// canvas-focus tracking that gates whether the game should react to keys.
// Publishes `cursors`, `wasd` and `virtualInputs` onto the scene since
// CombatSystem and the scene's update loop read them directly.
export class LobbyInputController {
  constructor(scene) {
    this.scene = scene;
    this.keys = [];          // combat/action Phaser keys, for teardown
    this._canvasHasFocus = false;
  }

  setup() {
    const scene = this.scene;
    const KC = Phaser.Input.Keyboard.KeyCodes;

    scene.virtualInputs = { left: false, right: false, up: false, down: false, shift: false };

    // Movement keys (read by scene.update() and CombatSystem)
    scene.cursors = scene.input.keyboard.createCursorKeys();
    scene.wasd = scene.input.keyboard.addKeys({
      up: KC.W, down: KC.S, left: KC.A, right: KC.D
    });

    // Combat action keys: J, K, L, U, Q, R
    COMBAT_KEYS.forEach(([keyName, handler]) => {
      const key = scene.input.keyboard.addKey(KC[keyName]);
      key.on('down', () => {
        if (scene.isTyping() || !this._isCanvasFocused()) return;
        scene.combatSystem[handler]();
      });
      this.keys.push(key);
    });

    // SPACE: esquivar/dash con teclado (cambiado desde ataque)
    const dashKey = scene.input.keyboard.addKey(KC.SPACE);
    dashKey.on('down', () => {
      if (scene.isTyping() || !this._isCanvasFocused()) return;
      scene.combatSystem.handlePlayerDash();
    });
    this.keys.push(dashKey);

    // H: abrir/cerrar popup de ayuda
    const helpKey = scene.input.keyboard.addKey(KC.H);
    helpKey.on('down', () => {
      if (scene.isTyping() || !this._isCanvasFocused()) return;
      window.dispatchEvent(new CustomEvent('lobby-open-help'));
    });
    this.keys.push(helpKey);

    // Listener para botones virtuales táctiles
    this.onVirtualInput = (e) => {
      const { key, isDown } = e.detail;
      console.log(`[LobbyInput] virtual key=${key}, isDown=${isDown}`);
      const vi = scene.virtualInputs;
      if (key in vi) {
        vi[key] = isDown;
      } else if (isDown) {
        if (VIRTUAL_ACTIONS[key]) {
          scene.combatSystem[VIRTUAL_ACTIONS[key]]();
        } else if (key === 'interact') {
          scene.interactionSystem?.processSyncInteractions();
        }
      }
    };
    window.addEventListener('virtual-input', this.onVirtualInput);

    // Stop Phaser from calling preventDefault() on WASD, Arrows, and Space.
    // This allows React input fields to receive these keystrokes normally!
    scene.input.keyboard.removeCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,U,Q,R,H');

    this._setupCanvasFocus();

    // TAREA 7: Clic izquierdo = ataque. (También desactivamos menú contextual por si acaso).
    this._onContextMenu = (e) => e.preventDefault();
    scene.game.canvas.addEventListener('contextmenu', this._onContextMenu);
    scene.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown() && !scene.isTyping()) {
        scene.combatSystem.handlePlayerAttack();
      }
    });
  }

  _setupCanvasFocus() {
    const scene = this.scene;

    // Track canvas focus state so we know when the game canvas is truly active
    this._onCanvasFocus = () => { this._canvasHasFocus = true; };
    this._onCanvasBlur = () => { this._canvasHasFocus = false; };

    // External disable/enable signals (admin pages, modals, etc.)
    this._onDisableCanvasInput = () => { this._canvasHasFocus = false; };
    this._onEnableCanvasInput = () => {
      // Only re-enable if no HTML input has focus and we are on the lobby page
      if (!scene.isTyping() && !window.location.pathname.startsWith('/admin')) {
        this._canvasHasFocus = true;
      }
    };
    window.addEventListener('phaser-disable-input', this._onDisableCanvasInput);
    window.addEventListener('phaser-enable-input', this._onEnableCanvasInput);

    const canvasEl = scene.game?.canvas;
    if (canvasEl) {
      canvasEl.setAttribute('tabindex', '0');
      canvasEl.addEventListener('focus', this._onCanvasFocus);
      canvasEl.addEventListener('blur', this._onCanvasBlur);
    }
  }

  // True if the Phaser canvas is the focused element, or the player seems to be
  // interacting with it (no HTML element has focus and not on an admin route).
  _isCanvasFocused() {
    const el = document.activeElement;
    if (!el) return true;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLButtonElement ||
      el.isContentEditable
    ) return false;
    if (window.location.pathname.startsWith('/admin')) return false;
    // If phaser-disable-input was dispatched externally → blocked
    if (this._canvasHasFocus === false && el !== document.body && el !== this.scene.game?.canvas) {
      return false;
    }
    return true;
  }

  destroy() {
    const scene = this.scene;

    if (this.onVirtualInput) {
      window.removeEventListener('virtual-input', this.onVirtualInput);
      this.onVirtualInput = null;
    }
    window.removeEventListener('phaser-disable-input', this._onDisableCanvasInput);
    window.removeEventListener('phaser-enable-input', this._onEnableCanvasInput);

    const canvasEl = scene.game?.canvas;
    if (canvasEl) {
      if (this._onCanvasFocus) canvasEl.removeEventListener('focus', this._onCanvasFocus);
      if (this._onCanvasBlur) canvasEl.removeEventListener('blur', this._onCanvasBlur);
      if (this._onContextMenu) canvasEl.removeEventListener('contextmenu', this._onContextMenu);
    }

    // CRITICAL: Clean up Phaser keyboard plugin so restarting the scene
    // doesn't cause WASD to stop responding due to detached key listeners.
    if (scene.input && scene.input.keyboard) {
      scene.input.keyboard.removeAllKeys(true);
      scene.input.keyboard.clearCaptures();
    }
    this.keys = [];
  }
}
