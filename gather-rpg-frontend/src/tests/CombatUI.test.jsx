import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CombatUI } from '../components/combat/CombatUI';
import { useCombatStore } from '../store/combatStore';

// Mock stores
vi.mock('../store/combatStore');

describe('CombatUI', () => {
  const mockSendAction = vi.fn();

  beforeEach(() => {
    useCombatStore.mockReturnValue({
      combatState: {
        status: 'active',
        current_turn: 'player',
        player_state: { hp_current: 80, hp_max: 100, mp_current: 40, mp_max: 50 },
        enemy_state: { hp_current: 20, hp_max: 30 }
      },
      inCombat: true,
      sendAction: mockSendAction
    });
  });

  it('renders combat interface when active', () => {
    render(<CombatUI />);
    expect(screen.getByText('Enemy')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
  });

  it('enables buttons only on player turn', () => {
    render(<CombatUI />);
    const attackBtn = screen.getByText('Attack');
    expect(attackBtn).not.toBeDisabled();
  });

  it('disables buttons on enemy turn', () => {
    useCombatStore.mockReturnValue({
      combatState: {
        status: 'active',
        current_turn: 'enemy',
        player_state: { hp_current: 80, hp_max: 100 },
        enemy_state: { hp_current: 20, hp_max: 30 }
      },
      inCombat: true,
      sendAction: mockSendAction
    });

    render(<CombatUI />);
    const attackBtn = screen.getByText('Attack');
    expect(attackBtn).toBeDisabled();
  });
});
