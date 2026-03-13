import { describe, it, expect, vi, beforeEach } from 'vitest';
import wsClient from '../services/websocket';

describe('WebSocket Client', () => {
  beforeEach(() => {
    // Reset client state
    wsClient.listeners = new Map();
    wsClient.ws = null;
    wsClient.isConnected = false;
  });

  it('should emit events to listeners', () => {
    const mockCallback = vi.fn();
    wsClient.on('test_event', mockCallback);

    wsClient.emit('test_event', { data: 'test' });

    expect(mockCallback).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should send messages via WebSocket when connected', async () => {
    const token = 'fake-token';
    wsClient.connect(token);

    // Wait for mock connection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Spy on the underlying WebSocket send
    const sendSpy = vi.spyOn(wsClient.ws, 'send');

    wsClient.send('chat_message', { text: 'hello' });

    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({
      type: 'chat_message',
      payload: { text: 'hello' }
    }));
  });

  it('should handle incoming messages and emit corresponding events', async () => {
     const token = 'fake-token';
    wsClient.connect(token);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    const mockCallback = vi.fn();
    wsClient.on('server_message', mockCallback);

    // Simulate incoming message
    const event = {
      data: JSON.stringify({
        type: 'server_message',
        payload: { status: 'ok' }
      })
    };
    
    wsClient.ws.onmessage(event);

    expect(mockCallback).toHaveBeenCalledWith({ status: 'ok' });
  });
});
