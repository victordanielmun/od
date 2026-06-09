import { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';

/**
 * VideoTile renders a single participant's audio/video stream.
 *
 * Props:
 *  - stream: MediaStream | null
 *  - username: string
 *  - muted: bool          — true for the local (self) stream to avoid echo
 *  - volume: number       — 0-1, applied to the <video> element
 *  - isSelfMuted: bool    — the user has self-muted (mic indicator)
 *  - isLocallyMuted: bool — WE have muted this peer locally
 *  - onToggleMute: fn     — callback to toggle local mute for this peer
 *  - showMuteButton: bool — whether to show the per-peer mute button
 */
export const VideoTile = ({
  stream,
  username,
  muted = false,
  volume = 1,
  isSelfMuted = false,
  isLocallyMuted = false,
  onToggleMute = null,
  showMuteButton = false,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current) return;
    // If locally muted by US, silence it completely regardless of proximity volume
    const effectiveVolume = isLocallyMuted ? 0 : Math.max(0, Math.min(1, Number(volume)));
    if (!Number.isFinite(effectiveVolume)) return;
    videoRef.current.volume = effectiveVolume;
  }, [volume, isLocallyMuted]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-700 w-48 h-36 group">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold text-white">
            {username ? username[0].toUpperCase() : '?'}
          </div>
        </div>
      )}

      {/* Username bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 flex items-center gap-1">
        {/* Self-muted indicator (they muted themselves) */}
        {isSelfMuted && (
          <MicOff size={12} className="text-red-400 flex-shrink-0" />
        )}
        <p className="text-white text-xs font-medium truncate drop-shadow-md">
          {username}
        </p>
      </div>

      {/* Locally-muted overlay (WE muted them) */}
      {isLocallyMuted && (
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center pointer-events-none">
          <MicOff size={24} className="text-red-400 opacity-80" />
        </div>
      )}

      {/* Per-peer mute button (visible on hover) */}
      {showMuteButton && onToggleMute && !muted && (
        <button
          onClick={onToggleMute}
          title={isLocallyMuted ? 'Activar audio de este participante' : 'Silenciar este participante'}
          className={`
            absolute top-2 right-2 p-1 rounded-full transition-all
            opacity-0 group-hover:opacity-100
            ${isLocallyMuted
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-gray-700 bg-opacity-80 hover:bg-gray-600'}
          `}
        >
          <MicOff size={14} className="text-white" />
        </button>
      )}
    </div>
  );
};
