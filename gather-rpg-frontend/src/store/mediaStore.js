import { create } from 'zustand';
import { streamManager } from '../services/webrtc/StreamManager';

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
