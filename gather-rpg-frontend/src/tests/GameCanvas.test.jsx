import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GameCanvas } from '../components/game/GameCanvas';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';
import { BrowserRouter } from 'react-router-dom';

// Mock Phaser
vi.mock('phaser', () => {
  const mockPhaser = {
    Game: class {
      constructor(config) {
        this.config = config;
      }
      destroy() {}
    },
    AUTO: 0,
    Scene: class {
      constructor() {}
    },
    Scale: {
      FIT: 0,
      CENTER_BOTH: 0
    },
    GameObjects: {
      Container: class {
        constructor() { this.add = () => {}; }
        add() {}
      }
    }
  };
  return {
    ...mockPhaser,
    default: mockPhaser
  };
});

// Mock MainScene
vi.mock('../game/scenes/MainScene', () => {
  return {
    MainScene: class {}
  };
});

// Mock GameStore
vi.mock('../store/gameStore');
vi.mock('../store/roomStore');

describe('GameCanvas', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    const state = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      currentRoomId: null,
      activeChallengeId: null,
      challengeParticipants: [],
      challengeMessages: [],
      leaveChallenge: vi.fn(),
      sendChallengeMessage: vi.fn()
    };

    useGameStore.mockImplementation((selector) => (selector ? selector(state) : state));

    useRoomStore.mockImplementation((selector) => {
      const roomState = { rooms: [] };
      return selector ? selector(roomState) : roomState;
    });
  });

  it('renders game container', () => {
    render(
      <BrowserRouter>
        <GameCanvas />
      </BrowserRouter>
    );
    const gameContainer = document.getElementById('phaser-game');
    expect(gameContainer).toBeInTheDocument();
  });

  it('connects to websocket on mount', () => {
    render(
      <BrowserRouter>
        <GameCanvas />
      </BrowserRouter>
    );
    expect(mockConnect).toHaveBeenCalled();
  });

  it('disconnects from websocket on unmount', () => {
    const { unmount } = render(
      <BrowserRouter>
        <GameCanvas />
      </BrowserRouter>
    );
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
