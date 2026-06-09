import { usePeerStore } from '../../store/peerStore';
import { useMediaStore } from '../../store/mediaStore';
import { useAuthStore } from '../../store/authStore';
import { VideoTile } from './VideoTile';
import { CoopAudioPanel } from './CoopAudioPanel';
import { useGameStore } from '../../store/gameStore';

/**
 * VideoOverlay — decides which audio/video UI to show based on session type:
 *
 *  • Cooperative room  → CoopAudioPanel (all participants, full-room audio, mute controls)
 *  • Challenge session → grid of VideoTile (existing proximity-based behavior)
 *  • Proximity room    → grid of VideoTile (proximity-based, volume from server)
 */
export const VideoOverlay = () => {
  const peersBySession       = usePeerStore(state => state.peersBySession);
  const peerVolumesBySession = usePeerStore(state => state.peerVolumesBySession);
  const isPeerMuted          = usePeerStore(state => state.isPeerMuted);
  const isUserSelfMuted      = usePeerStore(state => state.isUserSelfMuted);
  const toggleMutePeer       = usePeerStore(state => state.toggleMutePeer);
  const localStream          = useMediaStore(state => state.localStream);
  const user                 = useAuthStore(state => state.user);
  const players              = useGameStore(state => state.players);
  const activeChallengeId    = useGameStore(state => state.activeChallengeId);
  const currentRoomId        = useGameStore(state => state.currentRoomId);
  const activeMission        = useGameStore(state => state.activeMission);

  const getUsername = (userId) => {
    const player = players.get(userId);
    return player ? player.username : 'Unknown';
  };

  // ── Determine active session and room type ────────────────────────────────
  const roomSessionId    = currentRoomId ? `room:${currentRoomId}` : null;
  const isCooperative    = activeMission?.mode === 'cooperative';
  const activeSessionId  = activeChallengeId || roomSessionId;

  // ── Cooperative room → dedicated CoopAudioPanel ──────────────────────────
  if (isCooperative && roomSessionId) {
    return <CoopAudioPanel sessionId={roomSessionId} />;
  }

  // ── Challenge / proximity room → existing tile grid ───────────────────────
  const peers    = activeSessionId ? peersBySession.get(activeSessionId) : null;
  const volumes  = activeSessionId ? peerVolumesBySession.get(activeSessionId) : null;
  const peerList = peers ? Array.from(peers.entries()) : [];

  if (!localStream && peerList.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 flex flex-col space-y-4 pointer-events-none">
      {/* Local Video */}
      {localStream && (
        <div className="pointer-events-auto transform hover:scale-105 transition duration-200">
          <VideoTile
            stream={localStream}
            username={`${user?.username} (You)`}
            muted={true}
          />
        </div>
      )}

      {/* Remote peers */}
      {peerList.map(([userId, stream]) => {
        const uId          = String(userId);
        const locallyMuted = isPeerMuted(activeSessionId, uId);
        const selfMuted    = isUserSelfMuted(activeSessionId, uId);
        const vol          = locallyMuted ? 0 : (volumes?.get(uId) ?? 1);

        return (
          <div key={uId} className="pointer-events-auto transform hover:scale-105 transition duration-200">
            <VideoTile
              stream={stream}
              username={getUsername(uId)}
              volume={vol}
              isSelfMuted={selfMuted}
              isLocallyMuted={locallyMuted}
              showMuteButton={true}
              onToggleMute={() => toggleMutePeer(activeSessionId, uId)}
            />
          </div>
        );
      })}
    </div>
  );
};
