import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Minus, Plus, X, Brain, LogOut, User, Coins, Heart, Sparkles, Award } from 'lucide-react';
import { RoomList } from '../components/lobby/RoomList';
import { CreateRoomModal } from '../components/lobby/CreateRoomModal';
import { CharacterSelector } from '../components/lobby/CharacterSelector';
import { LobbyGameCanvas } from '../components/lobby/LobbyGameCanvas';
import { BottomHUD } from '../components/lobby/BottomHUD';
import { Sidebar } from '../components/lobby/Sidebar';
import { MapEditorUI } from '../components/lobby/MapEditorUI';
import { DeathOverlay } from '../components/lobby/DeathOverlay';
import { PrivateMapPINToast } from '../components/lobby/PrivateMapPINToast';
import { NotificationContainer } from '../components/common/NotificationContainer';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import { NPCDialogue } from '../components/game/NPCDialogue';
import MissionTracker from '../components/game/MissionTracker';
import { NinjaCardHUD } from '../components/combat/NinjaCardHUD';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { VirtualArcadeControls } from '../components/lobby/VirtualArcadeControls';
import { useDeviceType } from '../hooks/useDeviceType';

export const LobbyLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const { isTouch } = useDeviceType();
  const virtualControlsMode = useGameStore(state => state.virtualControlsMode);

  const [rpgStats, setRpgStats] = useState(null);

  useEffect(() => {
    const fetchRPGStats = async () => {
      try {
        const response = await api.get('/player/stats');
        setRpgStats(response.data);
      } catch (err) {
        console.error('Failed to load RPG stats in lobby:', err);
      }
    };
    fetchRPGStats();

    window.addEventListener('refresh-player-stats', fetchRPGStats);
    return () => window.removeEventListener('refresh-player-stats', fetchRPGStats);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(null); // 'missions', 'character', 'shop', 'route', null
  const [routeUrl, setRouteUrl] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingChallengeId, setPendingChallengeId] = useState(null);
  const [challengeChatInput, setChallengeChatInput] = useState('');
  const [npcData, setNpcData] = useState(null);
  const [showMissionBanner, setShowMissionBanner] = useState(false);
  const lastShownMissionIdRef = useRef(null);
  const challengeMessagesEndRef = useRef(null);

  // ── Canvas Input Focus Management ─────────────────────────────────────────
  // Dispatch phaser-disable-input when any React overlay/modal is open so that
  // the Phaser canvas stops consuming keyboard events (SPACE, L, J, K, etc.)
  useEffect(() => {
    const hasOverlay = !!(activeOverlay || isRoomModalOpen || isSidebarOpen);
    if (hasOverlay) {
      window.dispatchEvent(new CustomEvent('phaser-disable-input'));
    } else {
      window.dispatchEvent(new CustomEvent('phaser-enable-input'));
    }
  }, [activeOverlay, isRoomModalOpen, isSidebarOpen]);

  const activeChallengeId = useGameStore(state => state.activeChallengeId);
  const challengeParticipants = useGameStore(state => state.challengeParticipants);
  const challengeMessages = useGameStore(state => state.challengeMessages);
  const leaveChallenge = useGameStore(state => state.leaveChallenge);
  const sendChallengeMessage = useGameStore(state => state.sendChallengeMessage);
  const userRole = useAuthStore(state => state.user?.role);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const currentInviteCode = useGameStore(state => state.currentInviteCode);
  const rooms = useRoomStore.getState().rooms;
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const roomName = currentRoom ? currentRoom.name : (currentRoomId ? `${t('lobby.hud.room')} ${String(currentRoomId).slice(0, 8)}...` : t('lobby.hud.no_room'));

  const activeMission = useGameStore(state => state.activeMission);
  const fetchActiveMission = useGameStore(state => state.fetchActiveMission);
  const currentSceneKey = useGameStore(state => state.currentSceneKey);

  const scrollChallengeToBottom = useCallback(() => {
    challengeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeOverlay !== 'challenge') return;
    scrollChallengeToBottom();
  }, [activeOverlay, challengeMessages, scrollChallengeToBottom]);

  useEffect(() => {
    const handleInteraction = (e) => {
      console.log('[LobbyLayout] Evento "lobby-interaction" recibido con detail:', e.detail);
      const { role, templateId } = e.detail;

      if (role === 'mission') setActiveOverlay('missions');
      else if (role === 'class') setActiveOverlay('character');
      else if (role === 'shop') alert("Shop coming soon!");
      else if (templateId) {
        console.log(`[LobbyLayout] TemplateId detectado (${templateId}). Abriendo overlay npc_dialogue.`);
        setNpcData({
          templateId: e.detail.templateId,
          definitionId: e.detail.definitionId,
          characterId: e.detail.characterId, // Passes the sprite/asset ID
          name: e.detail.name || "NPC",
          role: e.detail.role || "Citizen",
          interactionMode: e.detail.interactionMode || 'hybrid',
          voiceType: e.detail.voiceType || 'male',
          missionId: e.detail.missionId,
          shopId: e.detail.shopId,
          roomId: e.detail.roomId
        });
        setActiveOverlay('npc_dialogue');
      } else {
        console.warn('[LobbyLayout] Evento lobby-interaction ignorado. Sin action/role reconocido ni templateId:', e.detail);
      }
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

  useEffect(() => {
    if (currentRoomId && currentSceneKey) {
      console.log(`[LobbyLayout] Fetching mission for scene: ${currentSceneKey}`);
      fetchActiveMission(currentSceneKey);
    }
  }, [currentRoomId, currentSceneKey, fetchActiveMission]);

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

  // Improved Mission Banner Logic: Show when mission data arrives AND game is ready
  useEffect(() => {
    if (activeMission && !activeOverlay && currentSceneKey !== 'lobby') {
      const missionId = activeMission.id || activeMission.title;
      if (lastShownMissionIdRef.current !== missionId) {
        lastShownMissionIdRef.current = missionId;
        setShowMissionBanner(true);
      }
    } else {
      setShowMissionBanner(false);
      if (!activeMission) {
        lastShownMissionIdRef.current = null;
      }
    }
  }, [activeMission, activeOverlay, currentSceneKey]);

  // Handle the auto-hide timer when showMissionBanner is activated
  useEffect(() => {
    let timer;
    if (showMissionBanner) {
      timer = setTimeout(() => {
        setShowMissionBanner(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showMissionBanner]);


  const gameRef = useRef(null); // Add ref to control game from UI
  const [isEditorMode, setIsEditorMode] = useState(false);

  // Listen for editor mode changes from MapEditorUI
  useEffect(() => {
    const onEditorMode = (e) => setIsEditorMode(e.detail?.active ?? false);
    window.addEventListener('editor-mode-changed', onEditorMode);
    return () => window.removeEventListener('editor-mode-changed', onEditorMode);
  }, []);

  const showVirtualControls = !isEditorMode && (
    virtualControlsMode === 'always' ||
    (virtualControlsMode === 'auto' && isTouch)
  );

  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden relative font-sans selection:bg-yellow-500 selection:text-black">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Map Editor UI (Admin Tool) */}
      {userRole === 'admin' && (
        <MapEditorUI gameRef={gameRef} />
      )}



      {/* Floating Action Menu (Top-Right overlay on Canvas) */}
      {!isEditorMode && (
        <div className="absolute top-4 right-4 z-20 pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => navigate('/learn')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 transition-all text-xs font-bold hover:scale-105 cursor-pointer shadow-lg"
            title="Practice English"
          >
            <Brain size={14} />
            <span>Practice</span>
          </button>
        </div>
      )}

      {/* Game Layer */}
      <div className="absolute inset-0 z-0">
        <div className={`w-full h-full ${activeOverlay === 'challenge' ? 'invisible' : ''}`}>
          <LobbyGameCanvas ref={gameRef} />
        </div>
      </div>

      {/* Virtual Controls Overlay */}
      {showVirtualControls && <VirtualArcadeControls />}

      {/* Notification Layer (Z-Index 100) */}
      <NotificationContainer />

      {/* Death Overlay (Z-Index 1000) */}
      <DeathOverlay />
      <NinjaCardHUD />

      {/* Mission Welcome Banner */}
      {showMissionBanner && activeMission && currentSceneKey !== 'lobby' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-10 duration-1000 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-xl border-t-4 border-b-4 border-yellow-500/50 p-8 shadow-[0_0_50px_rgba(234,179,8,0.3)] flex flex-col items-center min-w-[500px] rounded-2xl">
            <div className="text-yellow-500 font-extrabold text-xs uppercase tracking-[0.5em] mb-2 opacity-80">Aventura Iniciada</div>
            <h1 className="text-white font-extrabold text-5xl uppercase tracking-tighter drop-shadow-2xl mb-4">
              {activeMission.title}
            </h1>
            <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
            <div className="mt-4 text-yellow-200/70 font-serif italic text-lg tracking-wide text-center max-w-md">
              {activeMission.description_en || activeMission.scene_key || 'Aventura Misteriosa'}
            </div>
          </div>
        </div>
      )}

      {/* HUD & Tracker */}
      {!isEditorMode && (
        <>
          <BottomHUD />
        </>
      )}

      {/* Kill Mission HUD Widget — visible durante misiones de eliminar enemigos */}
      {activeMission && !isEditorMode && (() => {
        const killTasks = (activeMission.tasks || []).filter(t =>
          (t.type === 'defeat_enemy' || t.type === 'kill_boss' || t.type === 'kill_all') &&
          (t.required_kills > 0 || t.type === 'kill_all')
        );
        if (killTasks.length === 0) return null;
        return (
          <div className="absolute top-36 right-4 z-20 pointer-events-none space-y-2">
            {killTasks.map(task => {
              const done = task.kills_done || 0;
              const req = task.required_kills || 1;
              const pct = Math.min(100, (done / req) * 100);
              const isComplete = task.is_completed || done >= req;
              return (
                <div
                  key={task.id}
                  className="bg-black/70 backdrop-blur border border-red-900/50 rounded-xl px-4 py-2.5 min-w-[200px] shadow-lg"
                  style={{ boxShadow: isComplete ? '0 0 16px rgba(239,68,68,0.4)' : undefined }}
                >
                  <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-1 truncate">
                    {task.description || (isComplete ? '✅ Completado' : '⚔️ Objetivo')}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: isComplete
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)'
                        }}
                      />
                    </div>
                    <span className="text-white font-mono text-xs font-bold whitespace-nowrap">
                      {done}/{req}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}


      {/* Sidebar Layer — hidden in editor mode */}
      {!isEditorMode && (
        <div className="absolute top-0 left-0 h-full z-30 pointer-events-none">
          <Sidebar
            isOpen={isSidebarOpen}
            toggle={() => setIsSidebarOpen(!isSidebarOpen)}
            rpgStats={rpgStats}
          />
        </div>
      )}

      {/* Floating HUD controls on top right (Room indicators, PIN code, Zoom) */}
      <div className="absolute top-[68px] right-4 z-20 pointer-events-none">
        <div className="flex flex-col items-end gap-2.5">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2.5 rounded-2xl shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="text-[9px] text-yellow-400 font-extrabold uppercase tracking-widest mb-0.5">{t('lobby.hud.current_room')}</div>
            <div className="text-sm font-semibold truncate max-w-[240px] text-gray-100">{roomName}</div>
          </div>

          {currentInviteCode && (
            <div className="bg-black/60 backdrop-blur-md border border-purple-500/30 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
              <div>
                <div className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest mb-0.5">{t('lobby.hud.private_pin')}</div>
                <div className="text-lg font-bold tracking-[0.3em] text-white font-mono">{currentInviteCode}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentInviteCode);
                }}
                className="bg-purple-600/20 hover:bg-purple-600/40 p-2 rounded-xl transition border border-purple-500/30 cursor-pointer pointer-events-auto active:scale-95"
                title={t('lobby.hud.copy_pin')}
              >
                <Copy size={14} className="text-purple-300" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={zoomOut}
              className="bg-black/60 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-white w-9 h-9 rounded-xl shadow-lg hover:bg-white/5 active:scale-95 transition flex items-center justify-center cursor-pointer"
              aria-label="Zoom -"
            >
              <Minus size={16} className="text-gray-400 hover:text-white" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="bg-black/60 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-white w-9 h-9 rounded-xl shadow-lg hover:bg-white/5 active:scale-95 transition flex items-center justify-center cursor-pointer"
              aria-label="Zoom +"
            >
              <Plus size={16} className="text-gray-400 hover:text-white" />
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
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">{t('lobby.challenge.title')}</div>
                  <div className="text-white text-xl font-light truncate">
                    {activeChallengeId || pendingChallengeId || t('lobby.challenge.joining')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeChallengeId && (
                    <button
                      onClick={leaveChallenge}
                      className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded shadow transition pointer-events-auto"
                    >
                      {t('lobby.challenge.leave')}
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
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">{t('lobby.challenge.participants')}</div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {challengeParticipants.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">{t('lobby.challenge.no_participants')}</div>
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
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">{t('lobby.challenge.chat_title')}</div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {challengeMessages.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">{t('lobby.challenge.no_messages')}</div>
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
                      placeholder={activeChallengeId ? t('lobby.challenge.input_placeholder') : t('lobby.challenge.joining_placeholder')}
                      disabled={!activeChallengeId}
                      className="flex-1 bg-gray-800 disabled:opacity-50 text-white text-sm px-3 py-2 rounded border border-gray-700 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!activeChallengeId}
                      className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded"
                    >
                      {t('lobby.challenge.send')}
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
                      <h2 className="text-3xl text-white font-light">{t('lobby.overlays.mission_board')}</h2>
                      <button
                        onClick={() => setIsRoomModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition"
                      >
                        + {t('lobby.overlays.custom_room')}
                      </button>
                    </div>
                    <RoomList />
                  </>
                )}

                {activeOverlay === 'character' && (
                  <div className="flex flex-col items-center">
                    <h2 className="text-3xl text-white font-light mb-6">{t('lobby.overlays.class_trainer')}</h2>
                    <CharacterSelector onSelect={() => setActiveOverlay(null)} />
                  </div>
                )}

                {activeOverlay === 'npc_dialogue' && npcData && (
                  <NPCDialogue
                    npcData={npcData}
                    onClose={() => {
                      setActiveOverlay(null);
                      setNpcData(null);
                    }}
                  />
                )}
                {activeOverlay === 'route' && (
                  <div className="w-full h-full flex flex-col pt-6">
                    <iframe
                      src={routeUrl}
                      className="w-full flex-grow border-0 rounded-lg min-h-[70vh]"
                      title={t('lobby.overlays.route_viewer')}
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
