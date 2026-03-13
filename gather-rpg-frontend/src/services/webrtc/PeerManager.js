import SimplePeer from 'simple-peer';
import wsClient from '../websocket';
import { signalingClient } from './SignalingClient';
import { usePeerStore } from '../../store/peerStore';
import { useMediaStore } from '../../store/mediaStore';

export class PeerManager {
  constructor() {
    this.peers = new Map();
    this.setupSignalListeners();
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
  }

  handleOffer(userId, offer, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
    if (!this.peers.has(key)) this.createPeer(userId, false, sessionId);
    const peer = this.peers.get(key);
    if (peer) {
        peer.signal(offer);
    }
  }

  handleAnswer(userId, answer, sessionId) {
    if (!sessionId) return;
    const peer = this.peers.get(this.peerKey(sessionId, userId));
    if (peer) {
      peer.signal(answer);
    }
  }

  handleIceCandidate(userId, candidate, sessionId) {
    if (!sessionId) return;
    const peer = this.peers.get(this.peerKey(sessionId, userId));
    if (peer) {
      peer.signal(candidate);
    }
  }

  removePeer(userId, sessionId) {
    if (!sessionId) return;
    const key = this.peerKey(sessionId, userId);
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
    usePeerStore.getState().clearPeers();
  }
}

export const peerManager = new PeerManager();
