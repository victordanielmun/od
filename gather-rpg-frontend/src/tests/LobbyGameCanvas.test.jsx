import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LobbyGameCanvas } from '../components/lobby/LobbyGameCanvas';
import { useGameStore } from '../store/gameStore';
import { useRoomStore } from '../store/roomStore';

// Mock Stores
vi.mock('../store/gameStore');
vi.mock('../store/roomStore');

// Mock Phaser
vi.mock('phaser', () => {
  const mockPhaser = {
    Game: class {
      constructor() {}
      destroy() {}
    },
    AUTO: 0,
    Scene: class { constructor() {} },
    Scale: { RESIZE: 0, CENTER_BOTH: 0 },
    Input: { Keyboard: { KeyCodes: {} } },
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

describe('LobbyGameCanvas', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockJoinRoom = vi.fn();
  const mockFetchRooms = vi.fn();
  const mockCreateRoom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const gameStoreState = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      joinRoom: mockJoinRoom,
      isConnected: true, // Simulate connected
      players: new Map()
    };
    useGameStore.mockImplementation((selector) => {
      return selector ? selector(gameStoreState) : gameStoreState;
    });
    useGameStore.getState = () => gameStoreState;

    useRoomStore.mockImplementation((selector) => {
      const state = {
        fetchRooms: mockFetchRooms,
        createRoom: mockCreateRoom,
        rooms: [] // Initially empty
      };
      // For getState access
      useRoomStore.getState = () => state;
      
      return selector ? selector(state) : state;
    });
  });

  it('connects to websocket on mount', () => {
    render(<LobbyGameCanvas />);
    expect(mockConnect).toHaveBeenCalled();
  });

  it('creates and joins lobby if not exists', async () => {
    mockCreateRoom.mockResolvedValue({ id: 'new-lobby-id', name: 'Main Lobby' });

    render(<LobbyGameCanvas />);

    await waitFor(() => {
        expect(mockFetchRooms).toHaveBeenCalled();
        expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ name: 'Main Lobby' }));
        expect(mockJoinRoom).toHaveBeenCalledWith('new-lobby-id', null, null);
    });
  });

  it('joins existing lobby if exists', async () => {
    const existingLobby = { id: 'existing-id', name: 'Main Lobby' };
    
    useRoomStore.mockImplementation((selector) => {
      const state = {
        fetchRooms: mockFetchRooms,
        createRoom: mockCreateRoom,
        rooms: [existingLobby]
      };
      useRoomStore.getState = () => state;
      return selector ? selector(state) : state;
    });

    render(<LobbyGameCanvas />);

    await waitFor(() => {
        expect(mockFetchRooms).toHaveBeenCalled();
        expect(mockCreateRoom).not.toHaveBeenCalled();
        expect(mockJoinRoom).toHaveBeenCalledWith('existing-id', null, null);
    });
  });
});
