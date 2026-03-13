import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import { MainScene } from '../../game/scenes/MainScene';
import { CombatScene } from '../../game/scenes/CombatScene';
import { useGameStore } from '../../store/gameStore';
import { VideoOverlay } from './VideoOverlay';
import { MediaControls } from './MediaControls';
import { CombatUI } from '../combat/CombatUI';
import { useRoomStore } from '../../store/roomStore';
import { Minus, Plus } from 'lucide-react';

export const GameCanvas = () => {
  const gameRef = useRef(null);
  const { connect, disconnect } = useGameStore();
  const currentRoomId = useGameStore(state => state.currentRoomId);
  const activeChallengeId = useGameStore(state => state.activeChallengeId);
  const challengeParticipants = useGameStore(state => state.challengeParticipants);
  const challengeMessages = useGameStore(state => state.challengeMessages);
  const leaveChallenge = useGameStore(state => state.leaveChallenge);
  const sendChallengeMessage = useGameStore(state => state.sendChallengeMessage);
  const rooms = useRoomStore(state => state.rooms);
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const roomName = currentRoom ? currentRoom.name : (currentRoomId ? `Sala ${String(currentRoomId).slice(0, 8)}...` : 'Sin sala');
  const [challengeChatInput, setChallengeChatInput] = useState('');
  const challengeMessagesEndRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket when component mounts
    connect();

    if (gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: 'phaser-game',
      backgroundColor: '#1a1a1a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: [MainScene, CombatScene]
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      disconnect();
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [connect, disconnect]);

  useEffect(() => {
    if (!activeChallengeId) return;
    challengeMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChallengeId, challengeMessages]);

  const handleSendChallengeChat = (e) => {
    e.preventDefault();
    if (!challengeChatInput.trim()) return;
    sendChallengeMessage(challengeChatInput.trim());
    setChallengeChatInput('');
  };

  const zoomIn = () => {
    window.dispatchEvent(new CustomEvent('phaser-camera-zoom', { detail: { sceneKey: 'MainScene', direction: 'in' } }));
  };

  const zoomOut = () => {
    window.dispatchEvent(new CustomEvent('phaser-camera-zoom', { detail: { sceneKey: 'MainScene', direction: 'out' } }));
  };

  return (
    <div className="relative w-full h-full bg-gray-900 flex justify-center items-center overflow-hidden">
      <div className="absolute top-4 right-4 z-20 pointer-events-none">
        <div className="flex flex-col items-end gap-2">
          <div className="bg-gray-900/80 border border-gray-700 text-white px-3 py-2 rounded shadow-lg">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Sala actual</div>
            <div className="text-sm font-medium truncate max-w-[240px]">{roomName}</div>
          </div>

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

      <div
        id="phaser-game"
        className={`rounded-lg overflow-hidden shadow-2xl border border-gray-700${activeChallengeId ? ' hidden' : ''}`}
      />
      <VideoOverlay />
      <MediaControls />
      <CombatUI />

      {activeChallengeId && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700 flex flex-col">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Reto</div>
                <div className="text-white text-xl font-light truncate">{activeChallengeId}</div>
              </div>
              <button
                onClick={leaveChallenge}
                className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded shadow transition pointer-events-auto"
              >
                Leave
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 p-6">
              <div className="col-span-1 bg-gray-900/40 border border-gray-700 rounded p-4 min-h-0 flex flex-col">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-3">Participantes</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {challengeParticipants.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">Sin participantes.</div>
                  ) : (
                    challengeParticipants.map((p) => (
                      <div
                        key={String(p.user_id)}
                        className="text-sm text-gray-200 bg-gray-800/60 border border-gray-700 rounded px-3 py-2 truncate"
                      >
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
                    placeholder="Mensaje..."
                    className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded border border-gray-700 focus:border-orange-500 focus:outline-none"
                  />
                  <button type="submit" className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded">
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
