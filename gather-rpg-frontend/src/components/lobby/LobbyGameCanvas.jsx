import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
// import * as Phaser from 'phaser'; 
const Phaser = window.Phaser;

import { LobbyScene } from '../../game/scenes/LobbyScene';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';

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
      const { room_id, scene_key, type, invite_code } = e.detail;
      const transition = pendingTransitionRef.current || {};

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
      joinRoom(room_id, transition.x, transition.y);

      // 2. Restart Phaser Scene with map + spawn
      const game = internalGameRef.current;
      const lobbyScene = game?.scene?.getScene('LobbyScene');
      if (lobbyScene) {
        lobbyScene.scene.restart({
          map: scene_key,
          spawnX: transition.x,
          spawnY: transition.y,
        });
      }

      // 3. Update URL silently
      const url = new URL(window.location);
      url.searchParams.set('map', scene_key);
      if (transition.x != null) url.searchParams.set('spawnX', transition.x);
      else url.searchParams.delete('spawnX');
      if (transition.y != null) url.searchParams.set('spawnY', transition.y);
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

    const ensureLobby = async () => {
      try {
        await fetchRooms();
        const rooms = useRoomStore.getState().rooms;
        let lobby = rooms.find(r => r.name === 'Main Lobby');

        if (!lobby) {
          console.log("Creating Main Lobby...");
          // Attempt create. If it fails (e.g. exists), we catch error
          lobby = await createRoom({
            name: 'Main Lobby',
            max_users: 50,
            is_public: true,
            map_data: {}
          });
        }

        // If create returned null (error caught inside store), try fetching one more time immediately
        // because maybe someone else created it.
        if (!lobby) {
          await fetchRooms();
          const freshRooms = useRoomStore.getState().rooms;
          lobby = freshRooms.find(r => r.name === 'Main Lobby');
        }

        if (lobby) {
          console.log("Joining Lobby:", lobby.id);
          const params = new URLSearchParams(window.location.search);
          const spX = params.get('spawnX');
          const spY = params.get('spawnY');
          joinRoom(lobby.id, spX, spY);
        } else {
          throw new Error("Main Lobby could not be found or created.");
        }
      } catch (error) {
        console.error("Failed to join lobby:", error);
        // Retry after delay
        const timer = setTimeout(() => {
          setRetryCount(c => c + 1);
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    ensureLobby();
  }, [isConnected, fetchRooms, createRoom, joinRoom, currentRoomId, retryCount]);

  useEffect(() => {
    if (internalGameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: 'phaser-lobby',
      backgroundColor: '#1a1a1a',
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
      scene: [LobbyScene]
    };

    internalGameRef.current = new Phaser.Game(config);
  }, []);

  return (
    <div className="w-full h-full relative bg-black">
      {isLoading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-yellow-500 rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold text-white tracking-widest animate-pulse">{t('lobby.loading_world')}</h2>
        </div>
      )}
      <div id="phaser-lobby" className="w-full h-full" />
    </div>
  );
});
