import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

// Mock API
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() }
    }
  }
}));

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, error: null, isLoading: false });
    vi.clearAllMocks();
  });

  it('should login successfully', async () => {
    const mockUser = { id: 1, username: 'test' };
    const mockToken = 'abc-123';
    
    api.post.mockResolvedValue({
      data: { user: mockUser, token: mockToken }
    });

    const success = await useAuthStore.getState().login('test@test.com', 'password');

    expect(success).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe(mockToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should handle login failure', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } }
    });

    const success = await useAuthStore.getState().login('test@test.com', 'wrong');

    expect(success).toBe(false);
    expect(useAuthStore.getState().error).toBe('Invalid credentials');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
