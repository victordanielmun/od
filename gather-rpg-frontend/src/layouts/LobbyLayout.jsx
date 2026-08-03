import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Minus, Plus, X, Brain, LogOut, User, Coins, Heart, Sparkles, Award, Mic, MicOff, Music, ScrollText, HelpCircle } from 'lucide-react';
import { InfoMarkdown } from '../components/common/InfoMarkdown';
import { RoomList } from '../components/lobby/RoomList';
import { CreateRoomModal } from '../components/lobby/CreateRoomModal';
import { CharacterSelector } from '../components/lobby/CharacterSelector';
import { LobbyGameCanvas } from '../components/lobby/LobbyGameCanvas';
import { BottomHUD } from '../components/lobby/BottomHUD';
import { Sidebar } from '../components/lobby/Sidebar';
import { MapEditorUI } from '../components/lobby/MapEditorUI';
import { DeathOverlay } from '../components/lobby/DeathOverlay';
import { MissionCompleteOverlay } from '../components/lobby/MissionCompleteOverlay';
import { PrivateMapPINToast } from '../components/lobby/PrivateMapPINToast';
import { NotificationContainer } from '../components/common/NotificationContainer';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import { useMediaStore } from '../store/mediaStore';
import { useAudioStore } from '../store/audioStore';
import { NPCDialogue } from '../components/game/NPCDialogue';
import MissionTracker from '../components/game/MissionTracker';
import { HelpOverlay } from '../components/game/HelpOverlay';
import { NinjaCardHUD } from '../components/combat/NinjaCardHUD';
import { useNavigate } from 'react-router-dom';
import { ChessMinigameHUD } from '../components/lobby/ChessMinigameHUD';
import api from '../services/api';
import { VirtualArcadeControls } from '../components/lobby/VirtualArcadeControls';
import { useDeviceType } from '../hooks/useDeviceType';

// Debe igualar combatGracePeriod en gather-rpg-backend/internal/websocket/hub_combat.go:
// es el fallback cuando el banner de misión se muestra sin (todavía) tener el
// combat_grace real del WS, para que el peor caso también coincida con la tregua real.
const COMBAT_GRACE_FALLBACK_MS = 5000;

export const LobbyLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const { isTouch } = useDeviceType();
  const virtualControlsMode = useGameStore(state => state.virtualControlsMode);
  
  const musicVolume = useAudioStore(state => state.musicVolume);
  const setVolume = useAudioStore(state => state.setVolume);
  const [prevVolume, setPrevVolume] = useState(musicVolume > 0 ? musicVolume : 0.5);

  useEffect(() => {
    if (musicVolume > 0) {
      setPrevVolume(musicVolume);
    }
  }, [musicVolume]);

  const toggleMusicMute = () => {
    if (musicVolume > 0) {
      setVolume('musicVolume', 0);
    } else {
      setVolume('musicVolume', prevVolume);
    }
  };

  const localStream = useMediaStore(state => state.localStream);
  const isAudioEnabled = useMediaStore(state => state.isAudioEnabled);
  const toggleAudio = useMediaStore(state => state.toggleAudio);
  const startMedia = useMediaStore(state => state.startMedia);

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

    // Maná autoritativo del servidor: mantener el Sidebar en sync con el HUD de combate.
    const onPlayerMP = (e) => {
      const d = e.detail || {};
      setRpgStats(prev => prev ? {
        ...prev,
        ...(typeof d.mp === 'number' ? { mp_current: d.mp } : {}),
        ...(typeof d.mp_max === 'number' ? { mp_max: d.mp_max } : {}),
      } : prev);
    };

    window.addEventListener('refresh-player-stats', fetchRPGStats);
    window.addEventListener('player-mp-update', onPlayerMP);
    return () => {
      window.removeEventListener('refresh-player-stats', fetchRPGStats);
      window.removeEventListener('player-mp-update', onPlayerMP);
    };
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
  const [minigameData, setMinigameData] = useState(null);
  const [npcData, setNpcData] = useState(null);
  const [readPopupText, setReadPopupText] = useState('');           // texto original (inglés)
  const [readPopupTranslated, setReadPopupTranslated] = useState(null); // traducción (o null)
  const [readPopupShowOriginal, setReadPopupShowOriginal] = useState(false);
  const [readPopupTranslating, setReadPopupTranslating] = useState(false);
  const readReqRef = useRef('');
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
  const activeMission = useGameStore(state => state.activeMission);
  const combatGraceUntil = useGameStore(state => state.combatGraceUntil);
  const fetchActiveMission = useGameStore(state => state.fetchActiveMission);
  const acceptMission = useGameStore(state => state.acceptMission);
  const currentSceneKey = useGameStore(state => state.currentSceneKey);
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const currentRoomScene = useGameStore(state => state.currentRoomScene);
  const acceptedMissionRef = useRef(null);
  const fetchedMissionSceneRef = useRef(null);
  const currentInviteCode = useGameStore(state => state.currentInviteCode);
  const rooms = useRoomStore.getState().rooms;
  const currentRoom = rooms.find(r => r.id === currentRoomId);

  const roomName = (() => {
    if (currentSceneKey && currentSceneKey.startsWith('beatemup')) {
      if (activeMission && activeMission.title) return activeMission.title;
      const num = currentSceneKey.replace('beatemup', '');
      return `${t('lobby.hud.combat_zone', 'Zona de Combate')} ${num}`;
    }
    if (currentRoom) return currentRoom.name;
    if (currentSceneKey === 'lobby') return t('lobby.hud.main_lobby', 'Lobby Principal');
    if (currentRoomId) return `${t('lobby.hud.room')} ${String(currentRoomId).slice(0, 8)}...`;
    return t('lobby.hud.no_room');
  })();

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
    const handleOpenMinigame = (e) => {
      const { minigameId, minigameType } = e.detail;
      setMinigameData({ minigameId, minigameType });
      setActiveOverlay('minigame');
    };

    window.addEventListener('lobby-open-minigame', handleOpenMinigame);
    return () => window.removeEventListener('lobby-open-minigame', handleOpenMinigame);
  }, []);

  useEffect(() => {
    const handleOpenReadPopup = async (e) => {
      const { text } = e.detail;
      const original = text || '';
      setReadPopupText(original);
      setReadPopupTranslated(null);
      setReadPopupShowOriginal(false);
      setActiveOverlay('read');
      readReqRef.current = original; // token para descartar respuestas obsoletas
      if (!original.trim()) return;

      // Traducir al idioma nativo del jugador (backend cachea por hash; inglés = sin cambio).
      setReadPopupTranslating(true);
      try {
        const res = await api.post('/info-translate', { text: original });
        // Solo aplicar si el letrero abierto sigue siendo el mismo (anti-carrera) y la
        // traducción difiere del original (si es inglés, el backend devuelve lo mismo).
        if (readReqRef.current === original && res.data?.text && res.data.text !== original) {
          setReadPopupTranslated(res.data.text);
        }
      } catch (err) {
        console.warn('[read-popup] traducción falló, se muestra el original:', err?.message || err);
      } finally {
        if (readReqRef.current === original) setReadPopupTranslating(false);
      }
    };

    window.addEventListener('lobby-open-read-popup', handleOpenReadPopup);
    return () => window.removeEventListener('lobby-open-read-popup', handleOpenReadPopup);
  }, []);

  useEffect(() => {
    const handleOpenHelp = () => {
      setActiveOverlay(prev => prev === 'help' ? null : 'help');
    };

    window.addEventListener('lobby-open-help', handleOpenHelp);
    return () => window.removeEventListener('lobby-open-help', handleOpenHelp);
  }, []);

  useEffect(() => {
    if (activeChallengeId) {
      setPendingChallengeId(null);
      if (activeChallengeId.startsWith('minigame_')) {
        const type = activeChallengeId.split('_')[1] || 'chess';
        if (activeOverlay !== 'minigame') {
          setActiveOverlay('minigame');
        }
        if (!minigameData || minigameData.minigameId !== activeChallengeId) {
          setMinigameData({ minigameId: activeChallengeId, minigameType: type });
        }
      } else if (activeOverlay !== 'minigame') {
        setActiveOverlay('challenge');
      }
      return;
    }
    if (activeOverlay === 'challenge' || activeOverlay === 'minigame') {
      setActiveOverlay(null);
      setPendingChallengeId(null);
      setMinigameData(null);
    }
  }, [activeChallengeId, activeOverlay, minigameData]);

  useEffect(() => {
    if (currentRoomId && currentSceneKey) {
      // Dedupe per scene: during a teleport scene_key updates before room_id, and
      // React StrictMode double-invokes effects in dev, so this fired twice and
      // showed the "mission mode" notification twice. The fetch is scene-based, so
      // one fetch per distinct scene is enough.
      if (fetchedMissionSceneRef.current === currentSceneKey) return;
      fetchedMissionSceneRef.current = currentSceneKey;
      console.log(`[LobbyLayout] Fetching mission for scene: ${currentSceneKey}`);
      fetchActiveMission(currentSceneKey);
    }
  }, [currentRoomId, currentSceneKey, fetchActiveMission]);

  // Accept the scene's mission on arrival in its instance (One Map, One Mission).
  // Progress is no longer auto-created, so this binds the mission to THIS room so
  // that kills/tasks count toward it. Skips lobby. Idempotent on the backend.
  useEffect(() => {
    if (!currentRoomId || !activeMission || currentSceneKey === 'lobby') return;
    if (activeMission.scene_key !== currentSceneKey) return;
    // During a teleport the scene_key flips to the new map before the new room's
    // room_joined arrives, so currentRoomId can still point at the previous room
    // (e.g. the castle where the mission master lives). Only bind once the room
    // actually belongs to this scene, so the mission isn't accepted against the
    // wrong room.
    if (currentRoomScene !== currentSceneKey) return;
    const key = `${activeMission.id}:${currentRoomId}`;
    if (acceptedMissionRef.current === key) return;
    acceptedMissionRef.current = key;
    acceptMission(activeMission.id);
  }, [activeMission, currentRoomId, currentRoomScene, currentSceneKey, acceptMission]);

  // Open Help guide automatically the first time entering the Lobby in this session
  useEffect(() => {
    if (currentSceneKey === 'lobby' && currentRoomId) {
      const shown = sessionStorage.getItem('lobby_welcome_shown');
      if (!shown) {
        setActiveOverlay('help');
        sessionStorage.setItem('lobby_welcome_shown', 'true');
      }
    }
  }, [currentSceneKey, currentRoomId]);

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

  // El letrero dura lo mismo que la tregua de entrada, ni más ni menos: durante
  // esa ventana el servidor congela a los enemigos y la escena bloquea al
  // jugador, así que si el cartel se fuera antes (o después) el jugador estaría
  // quieto sin saber por qué. `activeMission` llega por REST y `combatGraceUntil`
  // por WebSocket ('combat_grace'): no hay garantía de orden entre ambos. Este
  // efecto depende de `combatGraceUntil` (no solo se lee una vez al montar) para
  // que, si el WS llega DESPUÉS de que el banner ya esté visible, el timer se
  // recalcule con el valor real en vez de quedarse con el fallback. El fallback
  // (sin tregua, p. ej. mapas sin combate) iguala la tregua real del backend
  // (combatGracePeriod en hub_combat.go) para que el peor caso también coincida.
  useEffect(() => {
    if (!showMissionBanner) return undefined;
    const graceLeft = (combatGraceUntil || 0) - Date.now();
    const timer = setTimeout(() => setShowMissionBanner(false), graceLeft > 0 ? graceLeft : COMBAT_GRACE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [showMissionBanner, combatGraceUntil]);


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
            onClick={toggleMusicMute}
            className={`flex items-center justify-center p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
              musicVolume === 0
                ? 'bg-red-600/30 hover:bg-red-600/50 text-red-200 border-red-500/30'
                : 'bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-400 border-yellow-500/20'
            }`}
            title={musicVolume === 0 ? "Unmute Music" : "Mute Music"}
          >
            {musicVolume === 0 ? (
              <div className="relative flex items-center justify-center w-4 h-4">
                <Music size={16} className="opacity-40" />
                <div className="absolute w-5 h-[2px] bg-red-500 rotate-45"></div>
              </div>
            ) : (
              <Music size={16} />
            )}
          </button>
          {currentSceneKey === 'lobby' && (
            <>
              <button
                onClick={() => navigate('/learn')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 transition-all text-xs font-bold hover:scale-105 cursor-pointer shadow-lg"
                title="Practice English"
              >
                <Brain size={14} />
                <span>Practice</span>
              </button>
              <button
                onClick={() => setActiveOverlay(prev => prev === 'help' ? null : 'help')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/20 transition-all text-xs font-bold hover:scale-105 cursor-pointer shadow-lg"
                title={i18n.language?.startsWith('es') ? "Guía de Ayuda (H)" : "Help Guide (H)"}
              >
                <HelpCircle size={14} />
                <span>{i18n.language?.startsWith('es') ? "Ayuda" : "Help"}</span>
              </button>
            </>
          )}
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
      <MissionCompleteOverlay />
      <NinjaCardHUD />

      {/* Mission Welcome Banner */}
      {showMissionBanner && activeMission && currentSceneKey !== 'lobby' && (
        <div className="absolute top-16 sm:top-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-10 duration-1000 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-xl border-t-4 border-b-4 border-yellow-500/50 p-3 sm:p-8 shadow-[0_0_50px_rgba(234,179,8,0.3)] flex flex-col items-center w-[calc(100vw-2rem)] max-w-md sm:max-w-none sm:min-w-[500px] sm:w-auto rounded-2xl">
            <div className="text-yellow-500 font-extrabold text-[10px] sm:text-xs uppercase tracking-[0.5em] mb-1.5 sm:mb-2 opacity-80 text-center">{t('lobby.mission.started_banner')}</div>
            <h1 className="text-white font-extrabold text-2xl sm:text-5xl uppercase tracking-tighter drop-shadow-2xl mb-3 sm:mb-4 text-center break-words max-w-full">
              {activeMission.title}
            </h1>
            <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
            <div className="mt-3 sm:mt-4 text-yellow-200/70 font-serif italic text-xs sm:text-lg tracking-wide text-center max-w-md px-2 line-clamp-2 sm:line-clamp-none">
              {(!i18n.language.startsWith('en') ? (activeMission.description || activeMission.description_en) : (activeMission.description_en || activeMission.description)) || activeMission.scene_key || t('lobby.mission.mysterious_adventure')}
            </div>
            {['individual', 'cooperative', 'competitive'].includes(activeMission.mode) && (
              <div className={`mt-3 sm:mt-4 text-[10px] sm:text-xs font-semibold px-3 py-1 rounded-full border text-center ${
                activeMission.mode === 'cooperative'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : activeMission.mode === 'competitive'
                    ? 'bg-red-500/15 border-red-400/40 text-red-200'
                    : 'bg-sky-500/15 border-sky-400/40 text-sky-200'
              }`}>
                {t(`lobby.mission.mode_${activeMission.mode}`)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUD & Tracker. El tracker se monta cuando el banner "Aventura Iniciada"
          desaparece: ambos repiten título y descripción, y en móvil comparten la
          franja superior, así que mostrarlos a la vez satura la pantalla. */}
      {!isEditorMode && (
        <>
          <BottomHUD />
          {!showMissionBanner && <MissionTracker mission={activeMission} />}
        </>
      )}




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
          {/* Ocultado temporalmente */}
          {/* <div className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2.5 rounded-2xl shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="text-[9px] text-yellow-400 font-extrabold uppercase tracking-widest mb-0.5">{t('lobby.hud.current_room')}</div>
            <div className="text-sm font-semibold truncate max-w-[240px] text-gray-100">{roomName}</div>
          </div> */}

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

          {userRole === 'admin' && (
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
          )}
        </div>
      </div>

      {/* Overlays (Z-Index 40) */}
      {activeOverlay && (
      <div className="absolute inset-0 bg-black/70 z-[60] flex items-center justify-center p-8 backdrop-blur-sm">
        {activeOverlay === 'minigame' && minigameData && minigameData.minigameType === 'chess' ? (
          <ChessMinigameHUD
            minigameId={minigameData.minigameId}
            onClose={() => {
              leaveChallenge();
              setActiveOverlay(null);
              setMinigameData(null);
            }}
          />
        ) : activeOverlay === 'read' ? (
          <div className="bg-gray-950/95 border border-yellow-500/30 rounded-2xl w-full max-w-lg overflow-hidden relative shadow-[0_0_50px_rgba(234,179,8,0.15)] animate-fade-in flex flex-col p-8 items-center text-center pointer-events-auto backdrop-blur-sm">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => {
                  setActiveOverlay(null);
                  setReadPopupText('');
                  setReadPopupTranslating(false);
                  readReqRef.current = '';
                }}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-white/5 border-0 bg-transparent outline-none"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-4 text-yellow-500 shadow-inner">
              <ScrollText size={24} />
            </div>

            <h3 className="text-lg font-bold text-white mb-4 tracking-wide uppercase flex items-center gap-2">
              {t('lobby.read_popup.title') || "Mensaje del Letrero"}
              {readPopupTranslating && (
                <span className="text-[10px] font-semibold text-yellow-400/80 normal-case tracking-normal animate-pulse">
                  {t('lobby.read_popup.translating') || 'traduciendo…'}
                </span>
              )}
            </h3>

            <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-6 w-full mb-2 max-h-[60vh] overflow-y-auto custom-scrollbar text-left text-sm text-gray-300 font-sans">
              <InfoMarkdown content={(readPopupShowOriginal || !readPopupTranslated) ? readPopupText : readPopupTranslated} />
            </div>

            {readPopupTranslated && (
              <button
                type="button"
                onClick={() => setReadPopupShowOriginal(v => !v)}
                className="self-end text-[11px] text-yellow-400/70 hover:text-yellow-300 underline mb-4 outline-none cursor-pointer bg-transparent border-0"
              >
                {readPopupShowOriginal
                  ? (t('lobby.read_popup.show_translation') || 'Ver traducción')
                  : (t('lobby.read_popup.show_original') || 'Ver original')}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveOverlay(null);
                setReadPopupText('');
                setReadPopupTranslating(false);
                readReqRef.current = '';
              }}
              className="bg-yellow-500/10 hover:bg-yellow-500/25 border border-yellow-500/30 hover:border-yellow-500/50 text-yellow-400 w-full py-2.5 rounded-xl transition text-xs font-bold active:scale-95 cursor-pointer uppercase tracking-wider outline-none"
            >
              {t('lobby.read_popup.close') || "Entendido"}
            </button>
          </div>
        ) : activeOverlay === 'minigame' && minigameData && minigameData.minigameType === 'park' ? (
          <div className="bg-gray-800 rounded-xl w-full max-w-md overflow-hidden relative shadow-2xl border border-gray-700 animate-fade-in flex flex-col p-8 items-center text-center pointer-events-auto">
            <h2 className="text-2xl font-bold text-white mb-2">🌳 Zona Social del Parque</h2>
            <p className="text-xs text-gray-400 mb-6 font-semibold">Comparte audio con los demás en esta sala.</p>
            
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full mb-6">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 text-left">Participantes en voz ({challengeParticipants.length}/5)</div>
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {challengeParticipants.map(p => (
                  <div key={String(p.user_id)} className="text-sm text-gray-200 bg-gray-800 border border-gray-700 px-3 py-2 rounded truncate text-left">
                    🎙️ {p.username}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={async () => {
                if (!localStream) {
                  await startMedia();
                } else {
                  toggleAudio();
                }
              }}
              title={isAudioEnabled ? 'Silenciarme' : 'Activar micrófono'}
              className={`mb-4 w-full p-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border active:scale-95 cursor-pointer ${
                isAudioEnabled
                  ? 'bg-green-950/30 hover:bg-green-950/50 border-green-700/50 text-green-400 font-bold text-xs'
                  : 'bg-red-950/30 hover:bg-red-950/50 border-red-800/50 text-red-400 font-bold text-xs'
              }`}
            >
              {isAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              <span>{isAudioEnabled ? 'Micrófono Activo' : 'Micrófono Silenciado'}</span>
            </button>

            <button
              onClick={() => {
                leaveChallenge();
                setActiveOverlay(null);
                setMinigameData(null);
              }}
              className="bg-red-700 hover:bg-red-600 text-white w-full py-2.5 rounded-xl transition text-xs font-bold active:scale-95 cursor-pointer"
            >
              Salir de la Sala
            </button>
          </div>
        ) : activeOverlay === 'challenge' ? (
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
          ) : activeOverlay === 'help' ? (
            <HelpOverlay onClose={() => setActiveOverlay(null)} />
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
