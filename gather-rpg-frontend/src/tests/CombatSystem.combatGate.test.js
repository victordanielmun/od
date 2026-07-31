import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CombatSystem } from '../game/combat/CombatSystem';
import { useGameStore } from '../store/gameStore';

// El gate de combate decide si J/K/L/U (y el clic y los botones táctiles) hacen
// algo. Bloquear de más deja al jugador indefenso en un mapa con enemigos, que es
// justo lo que hay que impedir: estos tests fijan ese contrato.

function makeSceneMock() {
  return {
    player: { playAnimation: vi.fn(), body: { setVelocity: vi.fn() }, sprite: { setTint: vi.fn(), clearTint: vi.fn() } },
    add: { graphics: () => ({ setScrollFactor() { return this; }, setDepth() { return this; }, clear() {}, fillStyle() {}, fillRoundedRect() {}, lineStyle() {}, strokeRoundedRect() {}, destroy() {} }) },
    scale: { width: 800, height: 600, on: vi.fn(), off: vi.fn() },
    events: { on: vi.fn(), off: vi.fn() },
    time: { now: 1000, delayedCall: (ms, cb) => ({ remove() {} }) },
    isTyping: () => false,
  };
}

const mission = (type, sceneKey = 'combate_town_1') => ({
  id: 1,
  scene_key: sceneKey,
  tasks: [{ id: 10, type }],
});

describe('CombatSystem — gate de acciones ofensivas', () => {
  let combat;
  let enemySystem;

  beforeEach(() => {
    enemySystem = { activeEnemies: new Map() };
    useGameStore.setState({ activeMission: null, currentSceneKey: 'combate_town_1', ninjaCardData: null });
    combat = new CombatSystem(makeSceneMock(), enemySystem);
  });

  afterEach(() => {
    combat.destroy();
    useGameStore.setState({ activeMission: null, currentSceneKey: 'lobby' });
  });

  it.each(['kill_all', 'kill_boss', 'defeat_enemy'])('permite atacar en misiones de tipo %s', (type) => {
    useGameStore.setState({ activeMission: mission(type) });

    expect(combat._isCombatBlocked()).toBe(false);
  });

  it('bloquea el ataque en una misión de recado de ESTA escena', () => {
    useGameStore.setState({ activeMission: mission('talk_to_npc') });

    expect(combat._isCombatBlocked()).toBe(true);
  });

  // Una misión puede arrastrarse entre mapas (la de comprar ítems sigue activa al
  // entrar a un mapa de combate): no puede decidir si aquí se pelea.
  it('no bloquea si la misión activa es de OTRA escena', () => {
    useGameStore.setState({ activeMission: mission('talk_to_npc', 'pet_store') });

    expect(combat._isCombatBlocked()).toBe(false);
  });

  // Si hay ogros encima, poder responder no puede depender de cómo esté
  // configurada la misión en el admin.
  it('no bloquea nunca si hay enemigos vivos en la sala', () => {
    useGameStore.setState({ activeMission: mission('talk_to_npc') });
    enemySystem.activeEnemies.set('e1', {});

    expect(combat._isCombatBlocked()).toBe(false);
  });

  it('no bloquea si la misión llegó sin tareas cargadas', () => {
    useGameStore.setState({ activeMission: { id: 2, scene_key: 'combate_town_1', tasks: [] } });

    expect(combat._isCombatBlocked()).toBe(false);
  });

  it('no bloquea cuando no hay misión activa', () => {
    expect(combat._isCombatBlocked()).toBe(false);
  });
});
