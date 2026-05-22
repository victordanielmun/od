import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/lobby/Sidebar';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useRoomStore } from '../store/roomStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock Stores
vi.mock('../store/gameStore', () => ({
    useGameStore: vi.fn()
}));
vi.mock('../store/authStore', () => ({
    useAuthStore: vi.fn()
}));
vi.mock('../store/roomStore', () => ({
    useRoomStore: vi.fn()
}));

// Mock Navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Sidebar', () => {
  const mockSendPrivateMessage = vi.fn();
  const mockAcceptChatRequest = vi.fn();
  const mockRejectChatRequest = vi.fn();
  const mockCloseChat = vi.fn();
  const mockLogout = vi.fn();
  const mockToggle = vi.fn();

  // Helper to set GameStore state handling both selectors and direct access
  const setGameStore = (state) => {
      const fullState = {
          players: new Map(),
          currentRoomId: 'room1',
          chatRequests: [],
          activeChat: null,
          activeChallengeId: null,
          challengeParticipants: [],
          challengeMessages: [],
          joinChallenge: vi.fn(),
          leaveChallenge: vi.fn(),
          sendChallengeMessage: vi.fn(),
          movePlayer: vi.fn(),
          sendPrivateMessage: mockSendPrivateMessage,
          acceptChatRequest: mockAcceptChatRequest,
          rejectChatRequest: mockRejectChatRequest,
          closeChat: mockCloseChat,
          sendChatRequest: vi.fn(),
          ...state
      };

      useGameStore.mockImplementation((selector) => {
          if (selector && typeof selector === 'function') {
              return selector(fullState);
          }
          return fullState;
      });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    
    // Auth Store Mock (No selector used in component)
    useAuthStore.mockReturnValue({
        user: { username: 'TestUser', characterClass: 'Warrior' },
        logout: mockLogout
    });

    // Room Store Mock (Selector used)
    useRoomStore.mockImplementation((selector) => {
        const state = { rooms: [{ id: 'room1', name: 'Test Room' }] };
        return selector ? selector(state) : state;
    });
  });

  it('renders closed state (button only)', () => {
    setGameStore({});

    render(
        <BrowserRouter>
            <Sidebar isOpen={false} toggle={mockToggle} />
        </BrowserRouter>
    );
    
    const button = screen.getByTestId('sidebar-toggle');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockToggle).toHaveBeenCalled();
  });

  it('renders open state with user info', () => {
    setGameStore({});

    render(
        <BrowserRouter>
            <Sidebar isOpen={true} toggle={mockToggle} />
        </BrowserRouter>
    );

    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('Warrior')).toBeInTheDocument();
  });

  it('renders chat requests', () => {
    setGameStore({
        chatRequests: [{ requester_id: '1', requester_name: 'Alice' }]
    });

    render(
        <BrowserRouter>
            <Sidebar isOpen={true} toggle={mockToggle} />
        </BrowserRouter>
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/wants to chat/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Accept'));
    expect(mockAcceptChatRequest).toHaveBeenCalledWith('1');
  });

  it('renders active chat', () => {
    setGameStore({
        activeChat: {
            partner_name: 'Bob',
            messages: [{ sender: 'Bob', text: 'Hi' }, { sender: 'Me', text: 'Hello' }]
        }
    });

    render(
        <BrowserRouter>
            <Sidebar isOpen={true} toggle={mockToggle} />
        </BrowserRouter>
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('sends message', () => {
    setGameStore({
        activeChat: {
            partner_name: 'Bob',
            messages: []
        }
    });

    render(
        <BrowserRouter>
            <Sidebar isOpen={true} toggle={mockToggle} />
        </BrowserRouter>
    );

    const input = screen.getByPlaceholderText('Message...');
    fireEvent.change(input, { target: { value: 'Test Message' } });
    
    fireEvent.submit(input.closest('form'));

    expect(mockSendPrivateMessage).toHaveBeenCalledWith('Test Message');
  });
});
