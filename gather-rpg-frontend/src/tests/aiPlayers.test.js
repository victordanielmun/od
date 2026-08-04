import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import wsClient from '../services/websocket';

// Los jugadores con IA del lobby llegan por la misma tubería de posiciones que
// una persona: el cliente los pinta igual. Lo único que los distingue es el flag
// is_ai, que el frontend necesita para no ofrecerles los flujos sociales reales.

function connectStore() {
  useAuthStore.setState({ token: 'fake-token', user: { id: 'u-1', username: 'Ana' } });
  useGameStore.setState({
    listenersInitialized: false,
    players: new Map(),
    blockedIds: new Set(),
    isMapLoading: false
  });
  useGameStore.getState().connect();
}

function botPosition(overrides = {}) {
  return {
    user_id: 'bot-mia', x: 500, y: 400, direction: 'right', anim: 'walk',
    username: 'Mia', character_id: '1', is_ai: true, timestamp: Date.now(),
    ...overrides
  };
}

describe('Jugadores con IA', () => {
  beforeEach(() => {
    wsClient.removeAllListeners();
    connectStore();
  });

  it('entran en el mapa de jugadores como cualquier otro', () => {
    wsClient.emit('positions_update', { positions: [botPosition()] });

    const bot = useGameStore.getState().players.get('bot-mia');
    expect(bot).toBeDefined();
    expect(bot.username).toBe('Mia');
    expect(bot.x).toBe(500);
  });

  it('conservan la marca is_ai', () => {
    wsClient.emit('positions_update', { positions: [botPosition()] });
    expect(useGameStore.getState().players.get('bot-mia').is_ai).toBe(true);
  });

  it('no pierden la marca si una posición llega sin el flag', () => {
    wsClient.emit('positions_update', { positions: [botPosition()] });
    // El backend lo omite cuando es false (omitempty); un update posterior no
    // puede convertir un bot en persona.
    wsClient.emit('positions_update', { positions: [botPosition({ is_ai: undefined, x: 520 })] });

    const bot = useGameStore.getState().players.get('bot-mia');
    expect(bot.is_ai).toBe(true);
    expect(bot.x).toBe(520);
  });

  it('un jugador real no queda marcado como IA', () => {
    wsClient.emit('positions_update', {
      positions: [{ user_id: 'u-2', x: 100, y: 100, username: 'Beto', character_id: '2' }]
    });

    expect(useGameStore.getState().players.get('u-2').is_ai).toBe(false);
  });
});
