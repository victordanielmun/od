import SimplePeer from 'simple-peer';
import wsClient from '../websocket';
import { signalingClient } from './SignalingClient';
import { usePeerStore } from '../../store/peerStore';
import { useMediaStore } from '../../store/mediaStore';

export class PeerManager {
  constructor() {
    this.peers = new Map();
    // Connections requested by the server while we had no localStream yet.
    // key -> { userId, initiator, sessionId }
    this.pendingConnections = new Map();
    // Signals (offer/answer/ICE) that arrived before the peer could be created.
    // key -> [signalData, ...]
    this.pendingSignals = new Map();
    this.setupSignalListeners();
  }

  bufferSignal(key, data) {
    const list = this.pendingSignals.get(key) || [];
    list.push(data);
    this.pendingSignals.set(key, list);
  }

  /**
   * Re-attempt every connection that was deferred because the microphone was
   * still off. Called after startMedia() so audio works even when the user
   * enables their mic AFTER joining a room / mission / chess session.
   */
  flushPendingConnections() {
    if (!useMediaStore.getState().localStream) return;
    const pending = Array.from(this.pendingConnections.values());
    this.pendingConnections.clear();
    pending.forEach(({ userId, initiator, sessionId }) => {
      this.createPeer(userId, initiator, sessionId);
    });
  }

  peerKey(sessionId, userId) {
    return `${sessionId}:${String(userId)}`;
  }

  setupSignalListeners() {
    wsClient.on('webrtc_offer', (payload) => {
      this.handleOffer(payload.from_user_id, { type: payload.type, sdp: payload.sdp }, payload.session_id);
    });

    wsClient.on('webrtc_answer', (payload) => {
      this.handleAnswer(payload.from_user_id, { type: payload.type, sdp: payload.sdp }, payload.session_id);
    });

    wsClient.on('webrtc_ice_candidate', (payload) => {
      this.handleIceCandidate(payload.from_user_id, {
        candidate: payload.candidate,
        sdpMid: payload.sdp_mid,
        sdpMLineIndex: payload.sdp_m_line_index
      }, payload.session_id);
    });
    
    wsClient.on('webrtc_disconnect', (payload) => {
        this.removePeer(payload.peer_user_id || payload.from_user_id, payload.session_id);
    });

    wsClient.on('audio_volume_update', (payload) => {
      if (!payload?.session_id) return;
      const peerId = String(payload.peer_user_id);
      if (!peerId) return;
      const volume = Number(payload.volume);
      if (!Number.isFinite(volume)) return;
      usePeerStore.getState().setPeerVolume(payload.session_id, peerId, volume);
    });
  }

  createPeer(userId, initiator = false, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    if (this.peers.has(key)) return;

    const localStream = useMediaStore.getState().localStream;
    if (!localStream) {
        // Mic not enabled yet — defer until startMedia() runs flushPendingConnections().
        this.pendingConnections.set(key, { userId, initiator, sessionId });
        return;
    }

    const peer = new SimplePeer({
      initiator,
      stream: localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        signalingClient.sendOffer(userId, data, sessionId);
      } else if (data.type === 'answer') {
        signalingClient.sendAnswer(userId, data, sessionId);
      } else if (data.candidate) {
        signalingClient.sendIceCandidate(userId, data, sessionId);
      }
    });

    peer.on('stream', (stream) => {
      usePeerStore.getState().addPeer(sessionId, String(userId), stream);
    });

    peer.on('close', () => {
      this.removePeer(userId, sessionId);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      this.removePeer(userId, sessionId);
    });

    this.peers.set(key, peer);

    // Replay any signals that arrived before this peer existed.
    const buffered = this.pendingSignals.get(key);
    if (buffered) {
      buffered.forEach(sig => peer.signal(sig));
      this.pendingSignals.delete(key);
    }
  }

  handleOffer(userId, offer, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    if (!this.peers.has(key)) this.createPeer(userId, false, sessionId);
    const peer = this.peers.get(key);
    if (peer) {
        peer.signal(offer);
    } else {
        // No localStream yet: keep the offer so it can be answered once the
        // peer is created (after the mic is enabled).
        this.bufferSignal(key, offer);
    }
  }

  handleAnswer(userId, answer, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    const peer = this.peers.get(key);
    if (peer) {
      peer.signal(answer);
    } else {
      this.bufferSignal(key, answer);
    }
  }

  handleIceCandidate(userId, candidate, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    const peer = this.peers.get(key);
    if (peer) {
      peer.signal(candidate);
    } else {
      this.bufferSignal(key, candidate);
    }
  }

  removePeer(userId, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    this.pendingConnections.delete(key);
    this.pendingSignals.delete(key);
    const peer = this.peers.get(key);
    if (peer) {
      peer.destroy();
      this.peers.delete(key);
      usePeerStore.getState().removePeer(sessionId, String(userId));
    }
  }

  destroy() {
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
    this.pendingConnections.clear();
    this.pendingSignals.clear();
    usePeerStore.getState().clearPeers();
  }
}

export const peerManager = new PeerManager();
