import { create } from 'zustand';

export const usePeerStore = create((set) => ({
  peersBySession: new Map(), // sessionId -> Map(userId -> stream)
  peerVolumesBySession: new Map(), // sessionId -> Map(userId -> volume)

  addPeer: (sessionId, userId, stream) => {
    set(state => {
      const peersBySession = new Map(state.peersBySession);
      const sessionPeers = new Map(peersBySession.get(sessionId) || []);
      sessionPeers.set(userId, stream);
      peersBySession.set(sessionId, sessionPeers);
      return { peersBySession };
    });
  },

  setPeerVolume: (sessionId, userId, volume) => {
    set(state => {
      const peerVolumesBySession = new Map(state.peerVolumesBySession);
      const sessionVolumes = new Map(peerVolumesBySession.get(sessionId) || []);
      sessionVolumes.set(userId, volume);
      peerVolumesBySession.set(sessionId, sessionVolumes);
      return { peerVolumesBySession };
    });
  },

  removePeer: (sessionId, userId) => {
    set(state => {
      const peersBySession = new Map(state.peersBySession);
      const sessionPeers = new Map(peersBySession.get(sessionId) || []);
      sessionPeers.delete(userId);
      if (sessionPeers.size === 0) {
        peersBySession.delete(sessionId);
      } else {
        peersBySession.set(sessionId, sessionPeers);
      }

      const peerVolumesBySession = new Map(state.peerVolumesBySession);
      const sessionVolumes = new Map(peerVolumesBySession.get(sessionId) || []);
      sessionVolumes.delete(userId);
      if (sessionVolumes.size === 0) {
        peerVolumesBySession.delete(sessionId);
      } else {
        peerVolumesBySession.set(sessionId, sessionVolumes);
      }

      return { peersBySession, peerVolumesBySession };
    });
  },

  clearPeers: () => {
    set({ peersBySession: new Map(), peerVolumesBySession: new Map() });
  }
}));
