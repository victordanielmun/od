import { create } from 'zustand';
import wsClient from '../services/websocket';

export const useCombatStore = create((set, get) => ({
  combatState: null,
  inCombat: false,
  
  startCombat: (combatState) => {
    set({ combatState, inCombat: true });
  },

  updateCombatState: (newState) => {
    set((state) => ({
      combatState: {
        ...state.combatState,
        ...newState
      }
    }));
  },

  endCombat: (resultData) => {
    // Keep state for Victory Screen, but mark as ended?
    // Or handle cleanup in component.
    set((state) => ({
      combatState: {
        ...state.combatState,
        status: resultData.result,
        rewards: resultData.rewards
      }
    }));
  },

  closeCombat: () => {
    set({ combatState: null, inCombat: false });
  },

  sendAction: (actionType, skillId = null, itemId = null) => {
    const { combatState } = get();
    if (!combatState) return;

    wsClient.send('combat_action', {
      combat_id: combatState.combat_id,
      action_type: actionType,
      skill_id: skillId,
      item_id: itemId
    });
  }
}));
