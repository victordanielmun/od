import wsClient from '../websocket';

export class SignalingClient {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
  }

  sendOffer(targetUserId, offer, sessionId) {
    wsClient.send('webrtc_offer', {
      target_user_id: targetUserId,
      sdp: offer.sdp,
      type: offer.type,
      session_id: sessionId
    });
  }

  sendAnswer(targetUserId, answer, sessionId) {
    wsClient.send('webrtc_answer', {
      target_user_id: targetUserId,
      sdp: answer.sdp,
      type: answer.type,
      session_id: sessionId
    });
  }

  sendIceCandidate(targetUserId, candidate, sessionId) {
    const candidateString = candidate?.candidate ?? candidate;
    const sdpMid = candidate?.sdpMid ?? candidate?.sdp_mid ?? null;
    const sdpMLineIndex = candidate?.sdpMLineIndex ?? candidate?.sdp_m_line_index ?? null;

    wsClient.send('webrtc_ice_candidate', {
      target_user_id: targetUserId,
      candidate: candidateString,
      sdp_mid: sdpMid,
      sdp_m_line_index: sdpMLineIndex,
      session_id: sessionId
    });
  }

  sendDisconnect(peerUserId, sessionId) {
    wsClient.send('webrtc_disconnect', { peer_user_id: peerUserId, session_id: sessionId });
  }
}

export const signalingClient = new SignalingClient();
