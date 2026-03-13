import { useState, useEffect, useRef, useCallback } from 'react';
import { RoomList } from '../components/lobby/RoomList';
import { CreateRoomModal } from '../components/lobby/CreateRoomModal';
import { CharacterSelector } from '../components/lobby/CharacterSelector';
import { LobbyGameCanvas } from '../components/lobby/LobbyGameCanvas';
import { BottomHUD } from '../components/lobby/BottomHUD';
import { Sidebar } from '../components/lobby/Sidebar';
import { MapEditorUI } from '../components/lobby/MapEditorUI';
import { PrivateMapPINToast } from '../components/lobby/PrivateMapPINToast';
import { NotificationContainer } from '../components/common/NotificationContainer';
import { Minus, Plus, X, Copy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';

export const LobbyLayout = () => {
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(null); // 'missions', 'character', 'shop', 'route', null
  const [routeUrl, setRouteUrl] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingChallengeId, setPendingChallengeId] = useState(null);
  const [challengeChatInput, setChallengeChatInput] = useState('');
  const challengeMessagesEndRef = useRef(null);

  const activeChallengeId = useGameStore(state => state.activeChallengeId);
  const challengeParticipants = useGameStore(state => state.challengeParticipants);
  const challengeMessages = useGameStore(state => state.challengeMessages);
  const leaveChallenge = useGameStore(state => state.leaveChallenge);
  const sendChallengeMessage = useGameStore(state => state.sendChallengeMessage);
  const userRole = useAuthStore(state => state.user?.role);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const currentInviteCode = useGameStore(state => state.currentInviteCode);
  const rooms = useRoomStore(state => state.rooms);
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const roomName = currentRoom ? currentRoom.name : (currentRoomId ? `Sala ${String(currentRoomId).slice(0, 8)}...` : 'Sin sala');

  const scrollChallengeToBottom = useCallback(() => {
    challengeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeOverlay !== 'challenge') return;
    scrollChallengeToBottom();
  }, [activeOverlay, challengeMessages, scrollChallengeToBottom]);

  useEffect(() => {
    const handleInteraction = (e) => {
      const { role } = e.detail;
      if (role === 'mission') setActiveOverlay('missions');
      if (role === 'class') setActiveOverlay('character');
      if (role === 'shop') alert("Shop coming soon!");
    };

    window.addEventListener('lobby-interaction', handleInteraction);
    return () => window.removeEventListener('lobby-interaction', handleInteraction);
  }, []);

  useEffect(() => {
    const handleOpenChallenge = (e) => {
      setPendingChallengeId(e?.detail?.challengeId || null);
      setActiveOverlay('challenge');
    };

    window.addEventListener('lobby-open-challenge', handleOpenChallenge);
    return () => window.removeEventListener('lobby-open-challenge', handleOpenChallenge);
  }, []);

  useEffect(() => {
    const handleOpenRoute = (e) => {
      const url = e?.detail?.route;
      if (url) {
        setRouteUrl(url);
        setActiveOverlay('route');
      }
    };

    window.addEventListener('lobby-open-route', handleOpenRoute);
    return () => window.removeEventListener('lobby-open-route', handleOpenRoute);
  }, []);

  useEffect(() => {
    if (activeChallengeId) {
      setPendingChallengeId(null);
      setActiveOverlay('challenge');
      return;
    }
    if (activeOverlay === 'challenge') {
      setActiveOverlay(null);
      setPendingChallengeId(null);
    }
  }, [activeChallengeId, activeOverlay]);

  const handleSendChallengeChat = (e) => {
    e.preventDefault();
    if (!challengeChatInput.trim()) return;
    sendChallengeMessage(challengeChatInput.trim());
    setChallengeChatInput('');
  };

  const zoomIn = () => {
    window.dispatchEvent(new CustomEvent('phaser-camera-zoom', { detail: { sceneKey: 'LobbyScene', direction: 'in' } }));
  };

  const zoomOut = () => {
    window.dispatchEvent(new CustomEvent('phaser-camera-zoom', { detail: { sceneKey: 'LobbyScene', direction: 'out' } }));
  };

  const gameRef = useRef(null); // Add ref to control game from UI
  const [isEditorMode, setIsEditorMode] = useState(false);

  // Listen for editor mode changes from MapEditorUI
  useEffect(() => {
    const onEditorMode = (e) => setIsEditorMode(e.detail?.active ?? false);
    window.addEventListener('editor-mode-changed', onEditorMode);
    return () => window.removeEventListener('editor-mode-changed', onEditorMode);
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden relative">
      {/* Map Editor UI (Admin Tool) */}
      {userRole === 'admin' && (
        <MapEditorUI gameRef={gameRef} />
      )}

      {/* Game Layer */}
      <div className="absolute inset-0 z-0">
        <div className={`w-full h-full ${activeOverlay === 'challenge' ? 'invisible' : ''}`}>
          <LobbyGameCanvas ref={gameRef} />
        </div>
      </div>

      {/* Notification Layer (Z-Index 100) */}
      <NotificationContainer />

      {/* Private Map PIN Toast (Z-Index 200) — appears when a new private room is created */}
      <PrivateMapPINToast />

      {/* Bottom HUD — hidden in editor mode */}
      {!isEditorMode && <BottomHUD />}

      {/* Sidebar Layer — hidden in editor mode */}
      {!isEditorMode && (
        <div className="absolute top-0 left-0 h-full z-30 pointer-events-none">
          <div className="pointer-events-auto h-full">
            <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-20 pointer-events-none">
        <div className="flex flex-col items-end gap-2">
          <div className="bg-gray-900/80 border border-gray-700 text-white px-3 py-2 rounded shadow-lg">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Sala actual</div>
            <div className="text-sm font-medium truncate max-w-[240px]">{roomName}</div>
          </div>

          {currentInviteCode && (
            <div className="bg-purple-950/80 border border-purple-600/60 text-white px-3 py-2 rounded-xl shadow-lg flex items-center gap-3">
              <div>
                <div className="text-[10px] text-purple-300 uppercase tracking-wider">PIN Sala Privada</div>
                <div className="text-lg font-bold tracking-[0.3em] text-white font-mono">{currentInviteCode}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentInviteCode);
                }}
                className="bg-purple-700/60 hover:bg-purple-600/80 p-1.5 rounded-lg transition border border-purple-500/40"
                title="Copiar PIN"
              >
                <Copy size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              type="button"
              onClick={zoomOut}
              className="bg-gray-900/80 border border-gray-700 text-white w-9 h-9 rounded shadow-lg hover:bg-gray-800 transition flex items-center justify-center"
              aria-label="Zoom -"
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="bg-gray-900/80 border border-gray-700 text-white w-9 h-9 rounded shadow-lg hover:bg-gray-800 transition flex items-center justify-center"
              aria-label="Zoom +"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Overlays (Z-Index 40) */}
      {activeOverlay && (
        <div className="absolute inset-0 bg-black/70 z-40 flex items-center justify-center p-8 backdrop-blur-sm">
          {activeOverlay === 'challenge' ? (
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative shadow-2xl border border-gray-700 animate-fade-in flex flex-col">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Reto</div>
                  <div className="text-white text-xl font-light truncate">
                    {activeChallengeId || pendingChallengeId || 'Uniéndose...'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeChallengeId && (
                    <button
                      onClick={leaveChallenge}
                      className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded shadow transition pointer-events-auto"
                    >
                      Leave
                    </button>
                  )}
                  {!activeChallengeId && (
                    <button
                      onClick={() => setActiveOverlay(null)}
                      className="text-gray-400 hover:text-white transition pointer-events-auto"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 p-6">
                <div className="col-span-1 bg-gray-900/40 border border-gray-700 rounded p-4 min-h-0 flex flex-col">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">Participantes</div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {challengeParticipants.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">Sin participantes.</div>
                    ) : (
                      challengeParticipants.map((p) => (
                        <div key={String(p.user_id)} className="text-sm text-gray-200 bg-gray-800/60 border border-gray-700 rounded px-3 py-2 truncate">
                          {p.username || String(p.user_id).slice(0, 8) + '...'}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="col-span-2 bg-gray-900/40 border border-gray-700 rounded p-4 min-h-0 flex flex-col">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">Chat del reto</div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {challengeMessages.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">Sin mensajes.</div>
                    ) : (
                      challengeMessages.map((m, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-orange-300 font-semibold">{m.username}</span>
                          <span className="text-gray-400">: </span>
                          <span className="text-gray-200">{m.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={challengeMessagesEndRef} />
                  </div>

                  <form onSubmit={handleSendChallengeChat} className="mt-3 flex gap-2">
                    <input
                      value={challengeChatInput}
                      onChange={(e) => setChallengeChatInput(e.target.value)}
                      placeholder={activeChallengeId ? "Mensaje..." : "Uniéndose al reto..."}
                      disabled={!activeChallengeId}
                      className="flex-1 bg-gray-800 disabled:opacity-50 text-white text-sm px-3 py-2 rounded border border-gray-700 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!activeChallengeId}
                      className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded"
                    >
                      Enviar
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative shadow-2xl border border-gray-700 animate-fade-in">
              <button
                onClick={() => setActiveOverlay(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
              >
                <X size={24} />
              </button>

              <div className="p-8">
                {activeOverlay === 'missions' && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-3xl text-white font-light">Mission Board</h2>
                      <button
                        onClick={() => setIsRoomModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"
                      >
                        + Custom Room
                      </button>
                    </div>
                    <RoomList />
                  </>
                )}

                {activeOverlay === 'character' && (
                  <div className="flex flex-col items-center">
                    <h2 className="text-3xl text-white font-light mb-6">Class Trainer</h2>
                    <CharacterSelector onSelect={() => setActiveOverlay(null)} />
                  </div>
                )}
                
                {activeOverlay === 'route' && (
                  <div className="w-full h-full flex flex-col pt-6">
                    <iframe 
                      src={routeUrl} 
                      className="w-full flex-grow border-0 rounded-lg min-h-[70vh]" 
                      title="Route Viewer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals (Z-Index 50) */}
      <CreateRoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
      />
    </div>
  );
};
