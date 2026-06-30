import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
// import * as Phaser from 'phaser'; 
const Phaser = window.Phaser;

import { LobbyScene } from '../../game/scenes/LobbyScene';
import BeatEmUpScene from '../../game/scenes/BeatEmUpScene';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';

// Module-level singleton guard: prevents React StrictMode from creating two
// Phaser instances (StrictMode mounts/unmounts effects twice in development).
let _phaserLobbyInstance = null;

export const LobbyGameCanvas = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const internalGameRef = useRef(null);
  const pendingTransitionRef = useRef(null);

  // Expose the Phaser game instance to the parent
  useImperativeHandle(ref, () => ({
    get scene() {
      // Return the Phaser scene manager or specific scene
      return internalGameRef.current?.scene;
    },
    get game() {
      return internalGameRef.current;
    }
  }));

  const connect = useGameStore(state => state.connect);
  const disconnect = useGameStore(state => state.disconnect);
  const joinRoom = useGameStore(state => state.joinRoom);
  const isConnected = useGameStore(state => state.isConnected);

  const currentRoomId = useGameStore(state => state.currentRoomId);
  const isMapLoading = useGameStore(state => state.isMapLoading);
  const fetchRooms = useRoomStore(state => state.fetchRooms);
  const createRoom = useRoomStore(state => state.createRoom);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const connect = useGameStore.getState().connect;
    connect();

    return () => {
      useGameStore.getState().disconnect();
      if (internalGameRef.current) {
        internalGameRef.current.destroy(true);
        internalGameRef.current = null;
      }
    };
  }, []);

  // Listen for map teleport events dispatched by LobbyScene
  const [isLoading, setIsLoading] = useState(true);

  // Background asset streaming (NPC sprites, music) — non-blocking indicator.
  // null = hidden; 0..1 = fraction loaded. Only shown on a cold cache, since
  // loadDeferredLobbyAssets only emits these events when there's something to fetch.
  const [assetProgress, setAssetProgress] = useState(null);

  useEffect(() => {
    const onProgress = (e) => setAssetProgress(e.detail?.progress ?? 0);
    const onComplete = () => setAssetProgress(null);
    window.addEventListener('lobby-assets-progress', onProgress);
    window.addEventListener('lobby-assets-complete', onComplete);
    return () => {
      window.removeEventListener('lobby-assets-progress', onProgress);
      window.removeEventListener('lobby-assets-complete', onComplete);
    };
  }, []);

  useEffect(() => {
    const handleGameReady = () => setIsLoading(false);
    window.addEventListener('game-ready', handleGameReady);

    // Safety timeout in case game-ready event is missed or delayed
    const timer = setTimeout(() => setIsLoading(false), 2000);

    const handleChangeMap = (e) => {
      const { targetMap, targetX, targetY, pin = '' } = e.detail || {};
      if (!targetMap) return;

      console.log(`[LobbyGameCanvas] Requesting join for map: ${targetMap}`, targetX, targetY, pin ? `PIN: ${pin}` : '(no PIN)');
      setIsLoading(true);

      // Store pending transition so handleMapJoinApproved can use spawn coords
      pendingTransitionRef.current = { map: targetMap, x: targetX, y: targetY, pin };

      // Bug 2 fix: always send 'public' as hint — backend overrides based on DB is_public field.
      // The PIN is passed separately so the server can find the right private room.
      useGameStore.getState().requestMapJoin(targetMap, 'public', pin);
    };

    const handleMapJoinApproved = (e) => {
      const { room_id, scene_key, type, invite_code, x, y } = e.detail;
      const transition = pendingTransitionRef.current || {};
      const spawnX = x !== undefined ? x : transition.x;
      const spawnY = y !== undefined ? y : transition.y;

      if (transition.map && transition.map !== scene_key) {
        console.warn('[LobbyGameCanvas] Approval for unexpected map:', scene_key, 'expected:', transition.map);
      }

      console.log(`[LobbyGameCanvas] Approved — Room: ${room_id} | Map: ${scene_key} | Type: ${type} | PIN: ${invite_code || 'none'}`);

      // Bug 3 fix: if the server generated a PIN for a new private room, notify the UI
      if (invite_code && type !== 'public') {
        window.dispatchEvent(new CustomEvent('map-pin-received', {
          detail: { pin: invite_code, mapName: scene_key, roomId: room_id },
        }));
      }

      // 1. Join websocket room (with spawn coordinates)
      joinRoom(room_id, spawnX, spawnY);

      // 2. Transition Phaser Scenes
      const game = internalGameRef.current;
      if (game) {
        if (scene_key.startsWith('beatemup')) {
          const activeMission = useGameStore.getState().activeMission;
          const inventory = useGameStore.getState().inventory || [];

          // Count scrolls and potions from inventory
          let fire_rain = 0;
          let wave = 0;
          let nova = 0;
          let potions = 0;
          let manaPotions = 0;
          let throwingDaggers = 0;

          inventory.forEach(inv => {
            const itemName = inv.item?.name;
            if (itemName === 'Scroll of Fire Rain') fire_rain += inv.quantity;
            else if (itemName === 'Scroll of Wave') wave += inv.quantity;
            else if (itemName === 'Scroll of Nova') nova += inv.quantity;
            else if (itemName === 'Health Potion') potions += inv.quantity;
            else if (itemName === 'Mana Potion') manaPotions += inv.quantity;
            else if (itemName === 'Throwing Dagger') throwingDaggers += inv.quantity;
          });

          game.scene.stop('LobbyScene');
          game.scene.start('BeatEmUpScene', {
            levelId: scene_key,
            missionId: activeMission?.id,
            spells: { fire_rain, wave, nova },
            potions,
            manaPotions,
            throwingDaggers
          });
        } else {
          if (game.scene.isActive('BeatEmUpScene')) {
            game.scene.stop('BeatEmUpScene');
          }
          const lobbyScene = game.scene.getScene('LobbyScene');
          if (lobbyScene) {
            if (lobbyScene.scene.isActive()) {
              lobbyScene.scene.restart({
                map: scene_key,
                roomId: room_id,
                spawnX: spawnX,
                spawnY: spawnY,
              });
            } else {
              game.scene.start('LobbyScene', {
                map: scene_key,
                roomId: room_id,
                spawnX: spawnX,
                spawnY: spawnY,
              });
            }
          }
        }
      }

      // Restore focus to canvas so keyboard works.
      // 500ms delay gives LobbyScene enough time to complete restart()
      // and re-register all keyboard listeners before receiving focus.
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.tabIndex = 0;
            canvas.focus({ preventScroll: true });
        }
      }, 500);

      // 3. Update URL silently
      const url = new URL(window.location);
      url.searchParams.set('map', scene_key);
      if (spawnX != null) url.searchParams.set('spawnX', spawnX);
      else url.searchParams.delete('spawnX');
      if (spawnY != null) url.searchParams.set('spawnY', spawnY);
      else url.searchParams.delete('spawnY');
      url.searchParams.delete('edit_map');
      window.history.pushState({}, '', url);

      pendingTransitionRef.current = null;
    };

    // Ref for pending transition is external (line 11)

    window.addEventListener('lobby-change-map', handleChangeMap);
    window.addEventListener('map-join-approved', handleMapJoinApproved);

    return () => {
      window.removeEventListener('lobby-change-map', handleChangeMap);
      window.removeEventListener('map-join-approved', handleMapJoinApproved);
      window.removeEventListener('game-ready', handleGameReady);
      clearTimeout(timer);
    };
  }, []);

  // Handle Room Joining
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // If we are already in a room, stop trying
    if (currentRoomId) {
      return;
    }

    const ensureRoom = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const mapKey = params.get('map') || params.get('edit_map');
        const spX = params.get('spawnX');
        const spY = params.get('spawnY');

        if (mapKey && mapKey !== 'lobby') {
          console.log(`[LobbyGameCanvas] URL Map detected: ${mapKey}. Requesting map join...`);
          useGameStore.getState().requestMapJoin(mapKey, 'public');
          return;
        }

        await fetchRooms();
        const rooms = useRoomStore.getState().rooms;
        let lobby = rooms.find(r => r.name === 'Main Lobby');

        if (!lobby) {
          console.log("Creating Main Lobby...");
          lobby = await createRoom({
            name: 'Main Lobby',
            max_users: 50,
            is_public: true,
            map_data: {},
            scene_key: 'lobby',
            type: 'public'
          });
        }

        if (!lobby) {
          await fetchRooms();
          const freshRooms = useRoomStore.getState().rooms;
          lobby = freshRooms.find(r => r.name === 'Main Lobby');
        }

        if (lobby) {
          console.log("Joining Lobby:", lobby.id);
          joinRoom(lobby.id, spX, spY);
        } else {
          throw new Error("Main Lobby could not be found or created.");
        }
      } catch (error) {
        console.error("Failed to join room:", error);
        const timer = setTimeout(() => {
          setRetryCount(c => c + 1);
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    ensureRoom();
  }, [isConnected, fetchRooms, createRoom, joinRoom, currentRoomId, retryCount]);

  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (_phaserLobbyInstance) {
      internalGameRef.current = _phaserLobbyInstance;
      return;
    }
    if (internalGameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: 'phaser-lobby',
      backgroundColor: '#1a1a1a',
      powerPreference: 'high-performance',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        roundPixels: true,
        // DISABLED desynchronized to prevent "pestañeo" (flickering) on some systems
        desynchronized: false,
        preserveDrawingBuffer: true
      },
      scene: [LobbyScene, BeatEmUpScene]
    };

    _phaserLobbyInstance = new Phaser.Game(config);
    internalGameRef.current = _phaserLobbyInstance;

    return () => {
      // Only destroy on true unmount (not StrictMode's fake unmount)
      // We clear the singleton so a real remount can recreate it.
      if (_phaserLobbyInstance) {
        _phaserLobbyInstance.destroy(true);
        _phaserLobbyInstance = null;
      }
      internalGameRef.current = null;
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-black">
      {(isLoading || isMapLoading) && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold text-white tracking-widest animate-pulse">{t('lobby.loading_world')}</h2>
        </div>
      )}
      {/* Non-blocking background-loading pill (NPCs/music). Only on cold cache. */}
      {!isLoading && !isMapLoading && assetProgress !== null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
          <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md border border-yellow-500/30 rounded-full pl-3 pr-4 py-2 shadow-xl">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-yellow-500 rounded-full animate-spin shrink-0"></div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gray-200 tracking-wide">
                {t('lobby.loading_assets')} {Math.round(assetProgress * 100)}%
              </span>
              <div className="mt-1 h-1 w-36 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-200"
                  style={{ width: `${Math.round(assetProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="phaser-lobby" className="w-full h-full" />
    </div>
  );
});
