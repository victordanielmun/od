import { useCombatStore } from '../../store/combatStore';

export const CombatUI = () => {
  const { combatState, inCombat, sendAction } = useCombatStore();

  if (!inCombat || !combatState) return null;

  const isPlayerTurn = combatState.current_turn === 'player';
  const player = combatState.player || combatState.player_state; // Handle both initial and update formats
  const enemy = combatState.enemy || combatState.enemy_state;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar: Enemy HP */}
      <div className="flex justify-center pointer-events-auto">
        <div className="bg-gray-800 p-4 rounded-lg border border-red-500 w-64">
          <h3 className="text-red-500 font-bold mb-1">Enemy</h3>
          <div className="w-full bg-gray-700 h-4 rounded overflow-hidden">
            <div 
              className="bg-red-600 h-full transition-all duration-500"
              style={{ width: `${(enemy.hp_current / enemy.hp_max) * 100}%` }}
            />
          </div>
          <p className="text-right text-white text-xs mt-1">{enemy.hp_current}/{enemy.hp_max}</p>
        </div>
      </div>

      {/* Center: Status / Victory / Defeat */}
      <div className="flex justify-center items-center">
        {combatState.status === 'victory' && (
            <div className="bg-green-600 text-white text-4xl font-bold p-8 rounded shadow-lg animate-bounce">
                VICTORY!
            </div>
        )}
        {combatState.status === 'defeat' && (
            <div className="bg-red-600 text-white text-4xl font-bold p-8 rounded shadow-lg">
                DEFEAT
            </div>
        )}
      </div>

      {/* Bottom Bar: Player Stats & Actions */}
      <div className="flex justify-between items-end pointer-events-auto">
        {/* Player Stats */}
        <div className="bg-gray-800 p-4 rounded-lg border border-blue-500 w-64">
          <h3 className="text-blue-400 font-bold mb-1">Player</h3>
          <div className="mb-2">
            <div className="text-xs text-gray-400 mb-1">HP</div>
            <div className="w-full bg-gray-700 h-4 rounded overflow-hidden">
              <div 
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${(player.hp_current / player.hp_max) * 100}%` }}
              />
            </div>
            <p className="text-right text-white text-xs">{player.hp_current}/{player.hp_max}</p>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">MP</div>
            <div className="w-full bg-gray-700 h-4 rounded overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${(player.mp_current / player.mp_max) * 100}%` }}
              />
            </div>
            <p className="text-right text-white text-xs">{player.mp_current}/{player.mp_max}</p>
          </div>
        </div>

        {/* Action Menu */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-600 flex space-x-2">
           <button 
             disabled={!isPlayerTurn}
             onClick={() => sendAction('attack')}
             className={`px-6 py-3 rounded font-bold text-white transition ${isPlayerTurn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 cursor-not-allowed'}`}
           >
             Attack
           </button>
           <button 
             disabled={!isPlayerTurn}
             className={`px-6 py-3 rounded font-bold text-white transition ${isPlayerTurn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 cursor-not-allowed'}`}
           >
             Skill
           </button>
           <button 
             disabled={!isPlayerTurn}
             className={`px-6 py-3 rounded font-bold text-white transition ${isPlayerTurn ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}
           >
             Item
           </button>
           <button 
             disabled={!isPlayerTurn}
             onClick={() => sendAction('flee')}
             className={`px-6 py-3 rounded font-bold text-white transition ${isPlayerTurn ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-600 cursor-not-allowed'}`}
           >
             Flee
           </button>
        </div>
      </div>
    </div>
  );
};
