import { usePeerStore } from '../../store/peerStore';
import { useMediaStore } from '../../store/mediaStore';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { VideoTile } from './VideoTile';
import { Mic, MicOff, Users } from 'lucide-react';

/**
 * CoopAudioPanel — "Meeting room" audio overlay for cooperative mission instances.
 *
 * Shown when the current room type is cooperative. All participants of the
 * room are connected at full volume from the moment they join, regardless
 * of their map position. Users can:
 *   - Mute/unmute their own microphone (self-mute).
 *   - Mute individual remote peers (local-only, no server broadcast).
 *   - See which participants have self-muted (server-broadcast indicator).
 */
export const CoopAudioPanel = ({ sessionId }) => {
  const peersBySession    = usePeerStore(s => s.peersBySession);
  const peerVolumesBySession = usePeerStore(s => s.peerVolumesBySession);
  const selfMutedUsers    = usePeerStore(s => s.selfMutedUsers);
  const mutedPeers        = usePeerStore(s => s.mutedPeers);
  const toggleMutePeer    = usePeerStore(s => s.toggleMutePeer);
  const isPeerMuted       = usePeerStore(s => s.isPeerMuted);
  const isUserSelfMuted   = usePeerStore(s => s.isUserSelfMuted);

  const localStream      = useMediaStore(s => s.localStream);
  const isAudioEnabled   = useMediaStore(s => s.isAudioEnabled);
  const toggleAudio      = useMediaStore(s => s.toggleAudio);
  const startMedia       = useMediaStore(s => s.startMedia);

  const user             = useAuthStore(s => s.user);
  const players          = useGameStore(s => s.players);

  const peers    = sessionId ? (peersBySession.get(sessionId) || new Map()) : new Map();
  const volumes  = sessionId ? (peerVolumesBySession.get(sessionId) || new Map()) : new Map();
  const peerList = Array.from(peers.entries()); // [[userId, stream], ...]

  const getUsername = (userId) => {
    const player = players.get(String(userId));
    return player ? player.username : 'Jugador';
  };

  const handleToggleAudio = async () => {
    if (!localStream) {
      await startMedia();
    } else {
      toggleAudio();
    }
  };

  // Don't render if there's nothing to show
  if (!localStream && peerList.length === 0) return null;

  const participantCount = peerList.length + (localStream ? 1 : 0);

  return (
    <div className="absolute bottom-20 left-4 flex flex-col gap-2 pointer-events-auto z-40">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 bg-opacity-90 rounded-full border border-indigo-500 border-opacity-50 shadow-lg">
        <Users size={13} className="text-indigo-400" />
        <span className="text-xs text-indigo-300 font-semibold tracking-wide">
          Sala Cooperativa · {participantCount} {participantCount === 1 ? 'participante' : 'participantes'}
        </span>
        {/* Self-mute toggle */}
        <button
          onClick={handleToggleAudio}
          title={isAudioEnabled ? 'Silenciarme' : 'Activar micrófono'}
          className={`ml-2 p-1.5 rounded-full transition-all ${
            isAudioEnabled
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {isAudioEnabled ? <Mic size={12} /> : <MicOff size={12} />}
        </button>
      </div>

      {/* Participant tiles */}
      <div className="flex flex-col gap-2">
        {/* Local user tile */}
        {localStream && (
          <div className="flex items-center gap-2">
            <VideoTile
              stream={localStream}
              username={`${user?.username ?? 'Tú'} (Tú)`}
              muted={true}
              isSelfMuted={!isAudioEnabled}
              showMuteButton={false}
            />
          </div>
        )}

        {/* Remote peer tiles */}
        {peerList.map(([userId, stream]) => {
          const uId = String(userId);
          const locallyMuted = isPeerMuted(sessionId, uId);
          const selfMuted    = isUserSelfMuted(sessionId, uId);
          // In cooperative rooms volume comes as 1.0 from backend (no proximity attenuation).
          // Apply local mute on top of whatever the server says.
          const vol = locallyMuted ? 0 : (volumes.get(uId) ?? 1);

          return (
            <VideoTile
              key={uId}
              stream={stream}
              username={getUsername(uId)}
              volume={vol}
              isSelfMuted={selfMuted}
              isLocallyMuted={locallyMuted}
              showMuteButton={true}
              onToggleMute={() => toggleMutePeer(sessionId, uId)}
            />
          );
        })}
      </div>
    </div>
  );
};
