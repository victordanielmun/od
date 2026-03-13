import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MediaControls } from '../components/game/MediaControls';
import { useAuthStore } from '../store/authStore';
import { useMediaStore } from '../store/mediaStore';
import { BrowserRouter } from 'react-router-dom';

// Mock stores
vi.mock('../store/authStore');
vi.mock('../store/mediaStore');

describe('MediaControls', () => {
  const mockToggleVideo = vi.fn();
  const mockToggleAudio = vi.fn();

  beforeEach(() => {
    useAuthStore.mockReturnValue({
      isGuest: () => false
    });

    useMediaStore.mockReturnValue({
      isVideoEnabled: false,
      isAudioEnabled: false,
      toggleVideo: mockToggleVideo,
      toggleAudio: mockToggleAudio,
      startMedia: vi.fn(),
      localStream: null
    });
  });

  it('renders media controls', () => {
    render(
      <BrowserRouter>
        <MediaControls />
      </BrowserRouter>
    );
    
    expect(screen.getByTitle('Toggle Microphone')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle Camera')).toBeInTheDocument();
  });

  it('shows disabled state when media is off', () => {
    render(
      <BrowserRouter>
        <MediaControls />
      </BrowserRouter>
    );
    
    // Icons might not be easily testable without aria-labels, but we can check classes or titles
    // In this case, we check if the button has red background (class bg-red-600)
    const micButton = screen.getByTitle('Toggle Microphone');
    expect(micButton.className).toContain('bg-red-600');
  });
});
