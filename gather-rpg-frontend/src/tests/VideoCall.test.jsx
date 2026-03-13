import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('simple-peer', () => {
  class MockSimplePeer {
    constructor() {
      this._handlers = new Map();
      this.signal = vi.fn();
      this.destroy = vi.fn();
    }

    on(event, cb) {
      this._handlers.set(event, cb);
    }

    __emit(event, data) {
      const cb = this._handlers.get(event);
      if (cb) cb(data);
    }
  }

  return { default: MockSimplePeer };
});

vi.mock('../store/mediaStore', () => ({
  useMediaStore: {
    getState: () => ({
      localStream: { id: 'mock-stream' }
    })
  }
}));

vi.mock('../store/peerStore', () => {
  const store = {
    addPeer: vi.fn(),
    removePeer: vi.fn(),
    setPeerVolume: vi.fn(),
    clearPeers: vi.fn()
  };

  return {
    usePeerStore: {
      getState: () => store
    }
  };
});

vi.mock('../services/websocket', () => {
  const listeners = new Map();

  const wsClient = {
    on: (type, cb) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
      return () => listeners.get(type)?.delete(cb);
    },
    emit: (type, payload) => {
      listeners.get(type)?.forEach(cb => cb(payload));
    },
    send: vi.fn(),
    __reset: () => listeners.clear()
  };

  return { default: wsClient };
});

vi.mock('../services/webrtc/SignalingClient', () => ({
  signalingClient: {
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn()
  }
}));

describe('Video Call / PeerManager', () => {
  let PeerManager;
  let wsClient;
  let signalingClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    vi.resetModules();
    wsClient = (await import('../services/websocket')).default;
    wsClient.__reset();
    ({ signalingClient } = await import('../services/webrtc/SignalingClient'));
    ({ PeerManager } = await import('../services/webrtc/PeerManager'));
  });

  afterEach(() => {
    wsClient.__reset();
  });

  it('should handle webrtc_offer and create a peer', () => {
    const manager = new PeerManager();
    const senderId = 'user-123';
    const sessionId = 'room:test';
    const payload = { from_user_id: senderId, sdp: 'mock-sdp-offer', type: 'offer', session_id: sessionId };

    const createPeerSpy = vi.spyOn(manager, 'createPeer');
    const handleOfferSpy = vi.spyOn(manager, 'handleOffer');

    wsClient.emit('webrtc_offer', payload);

    expect(handleOfferSpy).toHaveBeenCalledWith(senderId, { type: 'offer', sdp: 'mock-sdp-offer' }, sessionId);
    expect(createPeerSpy).toHaveBeenCalledWith(senderId, false, sessionId);
    expect(manager.peers.has(`${sessionId}:${senderId}`)).toBe(true);

    const peer = manager.peers.get(`${sessionId}:${senderId}`);
    expect(peer.signal).toHaveBeenCalledWith({ type: 'offer', sdp: 'mock-sdp-offer' });
  });

  it('should handle webrtc_answer and signal the peer', () => {
    const manager = new PeerManager();
    const senderId = 'user-456';
    const sessionId = 'room:test';

    manager.createPeer(senderId, true, sessionId);
    const peer = manager.peers.get(`${sessionId}:${senderId}`);

    wsClient.emit('webrtc_answer', { from_user_id: senderId, sdp: 'mock-sdp-answer', type: 'answer', session_id: sessionId });
    expect(peer.signal).toHaveBeenCalledWith({ type: 'answer', sdp: 'mock-sdp-answer' });
  });

  it('should handle webrtc_ice_candidate', () => {
    const manager = new PeerManager();
    const senderId = 'user-789';
    const sessionId = 'room:test';

    manager.createPeer(senderId, true, sessionId);
    const peer = manager.peers.get(`${sessionId}:${senderId}`);

    wsClient.emit('webrtc_ice_candidate', {
      from_user_id: senderId,
      candidate: 'candidate:123',
      sdp_mid: 'audio',
      sdp_m_line_index: 0,
      session_id: sessionId
    });

    expect(peer.signal).toHaveBeenCalledWith({ candidate: 'candidate:123', sdpMid: 'audio', sdpMLineIndex: 0 });
  });

  it('should remove peer on disconnect', () => {
    const manager = new PeerManager();
    const senderId = 'user-999';
    const sessionId = 'room:test';

    manager.createPeer(senderId, true, sessionId);
    expect(manager.peers.has(`${sessionId}:${senderId}`)).toBe(true);

    wsClient.emit('webrtc_disconnect', { peer_user_id: senderId, session_id: sessionId });
    expect(manager.peers.has(`${sessionId}:${senderId}`)).toBe(false);
  });

  it('should send offer/answer/ice via signaling client', () => {
    const manager = new PeerManager();
    const senderId = 'user-111';
    const sessionId = 'room:test';

    manager.createPeer(senderId, true, sessionId);
    const peer = manager.peers.get(`${sessionId}:${senderId}`);

    peer.__emit('signal', { type: 'offer', sdp: 'sdp-offer' });
    expect(signalingClient.sendOffer).toHaveBeenCalledWith(senderId, { type: 'offer', sdp: 'sdp-offer' }, sessionId);

    peer.__emit('signal', { type: 'answer', sdp: 'sdp-answer' });
    expect(signalingClient.sendAnswer).toHaveBeenCalledWith(senderId, { type: 'answer', sdp: 'sdp-answer' }, sessionId);

    peer.__emit('signal', { candidate: 'candidate:abc', sdpMid: 'audio', sdpMLineIndex: 0 });
    expect(signalingClient.sendIceCandidate).toHaveBeenCalledWith(senderId, {
      candidate: 'candidate:abc',
      sdpMid: 'audio',
      sdpMLineIndex: 0
    }, sessionId);
  });

  it('should update peer volume on audio_volume_update', async () => {
    const manager = new PeerManager();
    const peerStore = (await import('../store/peerStore')).usePeerStore;
    const setPeerVolume = peerStore.getState().setPeerVolume;

    const sessionId = 'room:test';
    const peerUserId = 'user-222';
    wsClient.emit('audio_volume_update', { session_id: sessionId, peer_user_id: peerUserId, volume: 0.4, distance: 12 });

    expect(setPeerVolume).toHaveBeenCalledWith(sessionId, peerUserId, 0.4);
    expect(manager).toBeDefined();
  });
});
