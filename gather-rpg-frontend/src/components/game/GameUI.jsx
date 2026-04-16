import { Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';

export const GameUI = ({ 
  isMicOn, 
  isVideoOn, 
  onToggleMic, 
  onToggleVideo, 
  connectionQuality = 100 
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none flex flex-col items-center gap-4">
      {/* Wooden Toolbar */}
      <div className="bg-[var(--color-base-dark)] border-4 border-[var(--color-gold)] px-8 py-4 flex items-center gap-6 pointer-events-auto shadow-[0_15px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Grain texture overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
        
        <button
          onClick={onToggleMic}
          className={`p-4 border-2 transition-all active:translate-y-1 shadow-lg ${
            isMicOn 
              ? 'bg-[var(--color-base-dark)] border-[var(--color-gold)] text-[var(--color-gold)] hover:text-white' 
              : 'bg-[var(--color-orange-vibrant)] border-[var(--color-gold)] text-white'
          }`}
          title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-4 border-2 transition-all active:translate-y-1 shadow-lg ${
            isVideoOn 
              ? 'bg-[var(--color-base-dark)] border-[var(--color-gold)] text-[var(--color-gold)] hover:text-white' 
              : 'bg-[var(--color-orange-vibrant)] border-[var(--color-gold)] text-white'
          }`}
          title={isVideoOn ? "Turn Off Camera" : "Turn On Camera"}
        >
          {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <div className="w-1 h-10 bg-[var(--color-base-dark)] border-l border-[var(--color-gold-dark)]/50" />

        <button 
          className="p-4 bg-[var(--color-base-dark)] border-2 border-[var(--color-gold)] text-[var(--color-gold)] hover:text-white transition-all active:translate-y-1 shadow-lg"
          title="Menu Settings"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Latency Badge (Parchment style) */}
      <div className="absolute bottom-6 right-6 bg-[var(--color-parchment)] border-2 border-[var(--color-gold)] px-4 py-1.5 shadow-lg pointer-events-auto">
        <span className="text-[10px] font-medieval uppercase tracking-widest text-[var(--color-base-dark)]">
          Latency: {Math.round(100 - connectionQuality)}ms
        </span>
      </div>
    </div>
  );
};
