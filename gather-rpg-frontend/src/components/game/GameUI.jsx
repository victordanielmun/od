import { Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';

export const GameUI = ({ 
  isMicOn, 
  isVideoOn, 
  onToggleMic, 
  onToggleVideo, 
  connectionQuality = 100 
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div className="flex justify-center items-end gap-4">
        {/* Toolbar */}
        <div className="bg-gray-900/90 backdrop-blur px-6 py-3 rounded-2xl flex items-center gap-4 pointer-events-auto shadow-xl border border-gray-700">
          <button
            onClick={onToggleMic}
            className={`p-3 rounded-full transition-all ${
              isMicOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            onClick={onToggleVideo}
            className={`p-3 rounded-full transition-all ${
              isVideoOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          <div className="w-px h-8 bg-gray-700" />

          <button 
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
            title="Settings"
          >
            <Settings size={24} />
          </button>
        </div>

        {/* Connection Status */}
        <div className="absolute bottom-4 right-4 bg-gray-900/80 px-3 py-1 rounded-lg text-xs text-gray-400 pointer-events-auto">
          Ping: {Math.round(100 - connectionQuality)}ms
        </div>
      </div>
    </div>
  );
};
