import { create } from 'zustand';
import { streamManager } from '../services/webrtc/StreamManager';
import wsClient from '../services/websocket';

export const useMediaStore = create((set, get) => ({
  localStream: null,
  isVideoEnabled: false,
  isAudioEnabled: false,
  error: null,

  startMedia: async () => {
    try {
      const stream = await streamManager.initializeMedia();
      set({
        localStream: stream,
        isVideoEnabled: true,
        isAudioEnabled: true,
        error: null
      });
      // Establish any peer connections that the server requested while the mic
      // was still off (joining a mission/chess room before enabling audio).
      const { peerManager } = await import('../services/webrtc/PeerManager');
      peerManager.flushPendingConnections();
      return stream;
    } catch (error) {
      set({ error: 'Could not access camera/microphone' });
      return null;
    }
  },

  toggleVideo: () => {
    const { isVideoEnabled } = get();
    const newState = !isVideoEnabled;
    streamManager.toggleVideo(newState);
    set({ isVideoEnabled: newState });
  },

  toggleAudio: () => {
    const { isAudioEnabled } = get();
    const newState = !isAudioEnabled;
    streamManager.toggleAudio(newState);
    set({ isAudioEnabled: newState });
    // Notify all room participants of our mute state so they can show the mute indicator
    wsClient.send('audio_mute_state', { is_muted: !newState });
  },

  stopMedia: () => {
    streamManager.stopAllTracks();
    set({ 
      localStream: null, 
      isVideoEnabled: false, 
      isAudioEnabled: false 
    });
  }
}));
