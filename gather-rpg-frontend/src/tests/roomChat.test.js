import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import wsClient from '../services/websocket';

// El chat de sala vive en instancias de grupo (cooperativas y privadas). El
// servidor devuelve el eco al propio emisor, así que el store NO debe añadir el
// mensaje de forma optimista: si lo hiciera, el emisor lo vería dos veces.

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';

function connectStore() {
  useAuthStore.setState({ token: 'fake-token', user: { id: 'u-1', username: 'Ana' } });
  useGameStore.setState({ listenersInitialized: false, roomMessages: [], blockedIds: new Set() });
  useGameStore.getState().connect();
}

describe('Chat de sala', () => {
  beforeEach(() => {
    wsClient.removeAllListeners();
    connectStore();
  });

  it('acumula los mensajes que difunde el servidor', () => {
    wsClient.emit('chat_broadcast', {
      user_id: 'u-2', username: 'Beto', message: '¡vamos al boss!', timestamp: '2026-08-03T10:00:00Z'
    });

    const messages = useGameStore.getState().roomMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ username: 'Beto', message: '¡vamos al boss!' });
  });

  it('saca una burbuja sobre el sprite del emisor', () => {
    const onBubble = vi.fn();
    window.addEventListener('chat-message-received', onBubble);

    wsClient.emit('chat_broadcast', { user_id: 'u-2', username: 'Beto', message: 'hola' });

    expect(onBubble).toHaveBeenCalled();
    expect(onBubble.mock.calls[0][0].detail).toEqual({ senderId: 'u-2', text: 'hola' });
    window.removeEventListener('chat-message-received', onBubble);
  });

  it('los avisos del sistema van al panel pero no generan burbuja', () => {
    const onBubble = vi.fn();
    window.addEventListener('chat-message-received', onBubble);

    wsClient.emit('chat_broadcast', {
      user_id: SYSTEM_ID, username: 'Sistema', message: 'Un aliado se ha unido'
    });

    expect(useGameStore.getState().roomMessages).toHaveLength(1);
    expect(onBubble).not.toHaveBeenCalled(); // el sistema no tiene sprite al que colgarse
    window.removeEventListener('chat-message-received', onBubble);
  });

  it('descarta los mensajes de usuarios bloqueados', () => {
    useGameStore.setState({ blockedIds: new Set(['u-3']) });

    wsClient.emit('chat_broadcast', { user_id: 'u-3', username: 'Caro', message: 'spam' });

    expect(useGameStore.getState().roomMessages).toHaveLength(0);
  });

  it('envía el mensaje sin añadirlo localmente: el eco del servidor lo pinta', async () => {
    wsClient.connect('fake-token');
    await new Promise(resolve => setTimeout(resolve, 100));
    const sendSpy = vi.spyOn(wsClient, 'send');

    useGameStore.setState({ currentRoomId: 'room-1' });
    useGameStore.getState().sendRoomMessage('  hola  ');

    expect(sendSpy).toHaveBeenCalledWith('chat_message', { room_id: 'room-1', message: 'hola' });
    expect(useGameStore.getState().roomMessages).toHaveLength(0);
    sendSpy.mockRestore();
  });

  it('no envía nada sin sala o con el mensaje en blanco', () => {
    const sendSpy = vi.spyOn(wsClient, 'send');

    useGameStore.setState({ currentRoomId: null });
    useGameStore.getState().sendRoomMessage('hola');
    expect(sendSpy).not.toHaveBeenCalled();

    useGameStore.setState({ currentRoomId: 'room-1' });
    useGameStore.getState().sendRoomMessage('   ');
    expect(sendSpy).not.toHaveBeenCalled();

    sendSpy.mockRestore();
  });
});
