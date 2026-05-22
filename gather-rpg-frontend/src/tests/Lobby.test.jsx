import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { LobbyLayout } from '../layouts/LobbyLayout';
import { useAuthStore } from '../store/authStore';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';

// Mock stores
vi.mock('../store/authStore');
vi.mock('../store/roomStore');
vi.mock('../store/gameStore');

// Mock Sidebar (LobbyLayout no longer renders a title/username directly)
vi.mock('../components/lobby/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>
}));

// Mock LobbyGameCanvas
vi.mock('../components/lobby/LobbyGameCanvas', () => ({
  LobbyGameCanvas: () => <div data-testid="lobby-canvas">Game Canvas</div>
}));

describe('LobbyLayout', () => {
  const mockLogout = vi.fn();
  const mockFetchRooms = vi.fn();
  const mockCreateRoom = vi.fn();
  const mockUser = { username: 'TestUser', email: 'test@example.com' };

  beforeEach(() => {
    useAuthStore.mockImplementation((selector) => {
      const state = {
        user: mockUser,
        logout: mockLogout
      };
      return selector ? selector(state) : state;
    });

    const roomState = {
      rooms: [],
      isLoading: false,
      error: null,
      fetchRooms: mockFetchRooms,
      createRoom: mockCreateRoom
    };
    useRoomStore.mockImplementation((selector) => {
      return selector ? selector(roomState) : roomState;
    });
    useRoomStore.getState = () => roomState;

    useGameStore.mockImplementation((selector) => {
      const state = {
        activeChallengeId: null,
        challengeParticipants: [],
        challengeMessages: [],
        leaveChallenge: vi.fn(),
        sendChallengeMessage: vi.fn(),
        currentRoomId: null,
        chatRequests: [],
        activeChat: null
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders lobby layout correctly', () => {
    render(
      <BrowserRouter>
        <LobbyLayout />
      </BrowserRouter>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('lobby-canvas')).toBeInTheDocument();
    
    // Mission board should be hidden initially
    expect(screen.queryByText('Mission Board')).not.toBeInTheDocument();
  });

  it('opens mission board on interaction', () => {
    render(
      <BrowserRouter>
        <LobbyLayout />
      </BrowserRouter>
    );

    // Simulate Event
    act(() => {
        const event = new CustomEvent('lobby-interaction', { detail: { role: 'mission' } });
        window.dispatchEvent(event);
    });

    expect(screen.getByText('Mission Board')).toBeInTheDocument();
    // RoomList is now mounted, so fetchRooms should be called
    expect(mockFetchRooms).toHaveBeenCalled();
  });

  it('opens create room modal when button is clicked in mission board', () => {
    render(
      <BrowserRouter>
        <LobbyLayout />
      </BrowserRouter>
    );

    // Open Mission Board first
    act(() => {
        const event = new CustomEvent('lobby-interaction', { detail: { role: 'mission' } });
        window.dispatchEvent(event);
    });

    fireEvent.click(screen.getByText(/Custom Room/i));
    expect(screen.getByText('Create New Room')).toBeInTheDocument();
  });
});
