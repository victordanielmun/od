import { usePeerStore } from '../../store/peerStore';
import { useMediaStore } from '../../store/mediaStore';
import { useAuthStore } from '../../store/authStore';
import { VideoTile } from './VideoTile';
import { useGameStore } from '../../store/gameStore';

export const VideoOverlay = () => {
  const peersBySession = usePeerStore(state => state.peersBySession);
  const peerVolumesBySession = usePeerStore(state => state.peerVolumesBySession);
  const localStream = useMediaStore(state => state.localStream);
  const user = useAuthStore(state => state.user);
  const players = useGameStore(state => state.players); // To get usernames
  const activeChallengeId = useGameStore(state => state.activeChallengeId);
  const currentRoomId = useGameStore(state => state.currentRoomId);

  const getUsername = (userId) => {
    const player = players.get(userId);
    return player ? player.username : 'Unknown';
  };

  const activeSessionId = activeChallengeId || (currentRoomId ? `room:${currentRoomId}` : null);
  const peers = activeSessionId ? peersBySession.get(activeSessionId) : null;
  const volumes = activeSessionId ? peerVolumesBySession.get(activeSessionId) : null;
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

      {/* Remote Videos */}
      {peerList.map(([userId, stream]) => (
        <div key={userId} className="pointer-events-auto transform hover:scale-105 transition duration-200">
          <VideoTile 
            stream={stream} 
            username={getUsername(userId)} 
            volume={volumes?.get(userId)}
          />
        </div>
      ))}
    </div>
  );
};
