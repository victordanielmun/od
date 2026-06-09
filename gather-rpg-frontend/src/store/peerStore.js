import { create } from 'zustand';

export const usePeerStore = create((set, get) => ({
  peersBySession: new Map(), // sessionId -> Map(userId -> stream)
  peerVolumesBySession: new Map(), // sessionId -> Map(userId -> volume)
  // userId's that the LOCAL user has manually muted (client-side only)
  mutedPeers: new Map(), // sessionId -> Set(userId)
  // userId's that have self-muted themselves (server-broadcast)
  selfMutedUsers: new Map(), // sessionId -> Map(userId -> bool)

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

  /** Toggle local mute for a remote peer (client-side only, no server broadcast needed) */
  toggleMutePeer: (sessionId, userId) => {
    set(state => {
      const mutedPeers = new Map(state.mutedPeers);
      const sessionMuted = new Set(mutedPeers.get(sessionId) || []);
      if (sessionMuted.has(userId)) {
        sessionMuted.delete(userId);
      } else {
        sessionMuted.add(userId);
      }
      mutedPeers.set(sessionId, sessionMuted);
      return { mutedPeers };
    });
  },

  isPeerMuted: (sessionId, userId) => {
    const sessionMuted = get().mutedPeers.get(sessionId);
    return sessionMuted ? sessionMuted.has(userId) : false;
  },

  /** Update whether a remote user has self-muted (from server broadcast) */
  setUserSelfMuted: (sessionId, userId, isMuted) => {
    set(state => {
      const selfMutedUsers = new Map(state.selfMutedUsers);
      const sessionSelfMuted = new Map(selfMutedUsers.get(sessionId) || []);
      if (isMuted) {
        sessionSelfMuted.set(userId, true);
      } else {
        sessionSelfMuted.delete(userId);
      }
      selfMutedUsers.set(sessionId, sessionSelfMuted);
      return { selfMutedUsers };
    });
  },

  isUserSelfMuted: (sessionId, userId) => {
    const sessionSelfMuted = get().selfMutedUsers.get(sessionId);
    return sessionSelfMuted ? !!sessionSelfMuted.get(userId) : false;
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

      // Clean up mute state for removed peer
      const mutedPeers = new Map(state.mutedPeers);
      const sessionMuted = new Set(mutedPeers.get(sessionId) || []);
      sessionMuted.delete(userId);
      if (sessionMuted.size > 0) mutedPeers.set(sessionId, sessionMuted);
      else mutedPeers.delete(sessionId);

      const selfMutedUsers = new Map(state.selfMutedUsers);
      const sessionSelfMuted = new Map(selfMutedUsers.get(sessionId) || []);
      sessionSelfMuted.delete(userId);
      if (sessionSelfMuted.size > 0) selfMutedUsers.set(sessionId, sessionSelfMuted);
      else selfMutedUsers.delete(sessionId);

      return { peersBySession, peerVolumesBySession, mutedPeers, selfMutedUsers };
    });
  },

  clearPeers: () => {
    set({
      peersBySession: new Map(),
      peerVolumesBySession: new Map(),
      mutedPeers: new Map(),
      selfMutedUsers: new Map(),
    });
  }
}));
