import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useAuthStore } from '../store/authStore';

// Mock store
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
}));

// Add mock for useAuthStore.getState()
useAuthStore.getState = vi.fn(() => ({
  isAdmin: vi.fn().mockReturnValue(false)
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('LoginForm', () => {
  beforeEach(() => {
    useAuthStore.mockImplementation((selector) => selector({
      login: vi.fn(),
      loginGuest: vi.fn(),
      error: null
    }));
    useAuthStore.getState.mockReturnValue({
      isAdmin: vi.fn().mockReturnValue(false)
    });
    mockNavigate.mockClear();
  });

  test('renders login form', () => {
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play as guest/i })).toBeInTheDocument();
  });

  test('handles login submission', async () => {
    const mockLogin = vi.fn().mockResolvedValue(true);
    useAuthStore.mockImplementation((selector) => selector({
      login: mockLogin,
      loginGuest: vi.fn(),
      error: null
    }));

    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles guest login', async () => {
    const mockLoginGuest = vi.fn().mockResolvedValue(true);
    useAuthStore.mockImplementation((selector) => selector({
      login: vi.fn(),
      loginGuest: mockLoginGuest,
      error: null
    }));

    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /play as guest/i }));

    await waitFor(() => {
      expect(mockLoginGuest).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('displays error message on failure', () => {
    useAuthStore.mockImplementation((selector) => selector({
      login: vi.fn(),
      loginGuest: vi.fn(),
      error: 'Login failed'
    }));

    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );

    expect(screen.getByText('Login failed')).toBeInTheDocument();
  });
});
