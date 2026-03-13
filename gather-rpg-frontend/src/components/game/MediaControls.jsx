import { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Settings } from 'lucide-react';
import { useMediaStore } from '../../store/mediaStore';
import { useAuthStore } from '../../store/authStore';
import { GuestUpgradeModal } from '../auth/GuestUpgradeModal';

export const MediaControls = () => {
  const { 
    isVideoEnabled, 
    isAudioEnabled, 
    toggleVideo, 
    toggleAudio, 
    startMedia,
    localStream 
  } = useMediaStore();
  
  const { isGuest } = useAuthStore();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleToggleVideo = async () => {
    if (isGuest()) {
      setShowUpgradeModal(true);
      return;
    }

    if (!localStream) {
      await startMedia();
    } else {
      toggleVideo();
      // If turning off both, maybe stop stream? 
      // For now keep stream active but tracks disabled for faster toggle
    }
  };

  const handleToggleAudio = async () => {
    if (isGuest()) {
      setShowUpgradeModal(true);
      return;
    }

    if (!localStream) {
      await startMedia();
    } else {
      toggleAudio();
    }
  };

  return (
    <>
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4 bg-gray-800 bg-opacity-90 p-3 rounded-full shadow-xl border border-gray-700 pointer-events-auto">
        <button
          onClick={handleToggleAudio}
          className={`p-3 rounded-full transition ${
            isAudioEnabled 
              ? 'bg-gray-600 hover:bg-gray-500 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isGuest() ? "Login to use audio" : "Toggle Microphone"}
        >
          {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button
          onClick={handleToggleVideo}
          className={`p-3 rounded-full transition ${
            isVideoEnabled 
              ? 'bg-gray-600 hover:bg-gray-500 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isGuest() ? "Login to use video" : "Toggle Camera"}
        >
          {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        {/* Settings button (placeholder) */}
        <button className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition">
          <Settings size={24} />
        </button>
      </div>

      <GuestUpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />
    </>
  );
};
