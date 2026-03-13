import { useEffect, useRef } from 'react';

export const VideoTile = ({ stream, username, muted = false, volume = 1 }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current) return;
    const nextVolume = Math.max(0, Math.min(1, Number(volume)));
    if (!Number.isFinite(nextVolume)) return;
    videoRef.current.volume = nextVolume;
  }, [volume]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-700 w-48 h-36">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted} // Local video should be muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-white">
            {username ? username[0].toUpperCase() : '?'}
          </div>
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
        <p className="text-white text-xs font-medium truncate shadow-black drop-shadow-md">
          {username}
        </p>
      </div>
    </div>
  );
};
