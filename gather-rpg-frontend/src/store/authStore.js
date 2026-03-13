import { create } from 'zustand';
import api from '../services/api';

const getUserFromToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    return { id: payload.user_id, username: payload.username, role: payload.role || 'user' };
  } catch (e) {
    console.error("Failed to decode token for user recovery:", e);
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || (localStorage.getItem('token') ? getUserFromToken(localStorage.getItem('token')) : null),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  error: null,
  isLoading: false,

  isGuest: () => {
    const user = get().user;
    return user?.is_guest ?? (user?.username?.startsWith('Guest_') || false);
  },

  isAdmin: () => {
    const user = get().user;
    return user?.role === 'admin';
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Login failed',
        isLoading: false
      });
      return false;
    }
  },

  loginGuest: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/guest');
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Guest login failed',
        isLoading: false
      });
      return false;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', { username, email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Registration failed',
        isLoading: false
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
