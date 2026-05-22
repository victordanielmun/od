import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterForm } from '../components/auth/RegisterForm';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useAuthStore } from '../store/authStore';

// Mock store
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
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

describe('RegisterForm', () => {
  beforeEach(() => {
    useAuthStore.mockImplementation((selector) => selector({
      register: vi.fn(),
      error: null
    }));
    mockNavigate.mockClear();
  });

  test('renders register form', () => {
    render(
      <BrowserRouter>
        <RegisterForm />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('handles registration submission', async () => {
    const mockRegister = vi.fn().mockResolvedValue(true);
    useAuthStore.mockImplementation((selector) => selector({
      register: mockRegister,
      error: null
    }));

    render(
      <BrowserRouter>
        <RegisterForm />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('displays error message on failure', () => {
    useAuthStore.mockImplementation((selector) => selector({
      register: vi.fn(),
      error: 'Registration failed'
    }));

    render(
      <BrowserRouter>
        <RegisterForm />
      </BrowserRouter>
    );

    expect(screen.getByText('Registration failed')).toBeInTheDocument();
  });
});
