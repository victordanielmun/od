import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CombatSystem } from '../game/combat/CombatSystem';
import { useGameStore } from '../store/gameStore';

// Escena de Phaser mínima: solo lo que toca el constructor/muerte de CombatSystem.
function makeSceneMock() {
  const delayedCalls = [];
  return {
    _delayedCalls: delayedCalls,
    player: {
      playAnimation: vi.fn(),
      body: { setVelocity: vi.fn() },
      sprite: { setTint: vi.fn(), clearTint: vi.fn() },
    },
    add: { graphics: () => ({ setScrollFactor() { return this; }, setDepth() { return this; }, clear() {}, fillStyle() {}, fillRoundedRect() {}, lineStyle() {}, strokeRoundedRect() {}, destroy() {} }) },
    scale: { width: 800, height: 600, on: vi.fn(), off: vi.fn() },
    events: { on: vi.fn(), off: vi.fn() },
    time: { now: 1000, delayedCall: (ms, cb) => { delayedCalls.push(cb); return { remove() {} }; } },
    isTyping: () => false,
  };
}

describe('CombatSystem — muerte con Ninja Card abierta', () => {
  let scene;
  let combat;

  beforeEach(() => {
    useGameStore.setState({ ninjaCardData: null });
    scene = makeSceneMock();
    combat = new CombatSystem(scene, { activeEnemies: new Map() });
  });

  afterEach(() => {
    combat.destroy();
    useGameStore.setState({ ninjaCardData: null });
  });

  it('mata al jugador normalmente cuando no hay card abierta', () => {
    window.dispatchEvent(new CustomEvent('player-died-server'));

    expect(combat.isDead).toBe(true);
  });

  // Regresión del bug: la penalización por fallar una card ('player_takes_damage')
  // llega con el modal abierto, así que player_died se recibía y se DESCARTABA —
  // el jugador se quedaba vivo con 0 HP para siempre.
  it('NO descarta la muerte recibida mientras la card está abierta: la aplaza', () => {
    useGameStore.setState({ ninjaCardData: { target_instance_id: 'e1', challenge: {} } });

    window.dispatchEvent(new CustomEvent('player-died-server'));

    expect(combat.isDead).toBe(false);        // aún no muere (el modal sigue arriba)
    expect(combat._pendingDeath).toBe(true);  // pero la muerte NO se perdió
  });

  it('ejecuta la muerte aplazada al cerrarse la card', () => {
    useGameStore.setState({ ninjaCardData: { target_instance_id: 'e1', challenge: {} } });
    window.dispatchEvent(new CustomEvent('player-died-server'));
    expect(combat.isDead).toBe(false);

    useGameStore.getState().clearNinjaCardData();

    expect(combat.isDead).toBe(true);
    expect(combat._pendingDeath).toBe(false);
  });

  it('no revive-y-mata: una muerte aplazada se descarta si el jugador ya respawneó', () => {
    useGameStore.setState({ ninjaCardData: { target_instance_id: 'e1', challenge: {} } });
    window.dispatchEvent(new CustomEvent('player-died-server'));
    expect(combat._pendingDeath).toBe(true);

    combat.resetDeathState();              // respawn antes de que se cierre la card
    useGameStore.getState().clearNinjaCardData();

    expect(combat.isDead).toBe(false);     // no debe matarlo tras revivir
  });
});
