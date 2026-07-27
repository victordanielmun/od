import { create } from 'zustand';
import api from '../services/api';
import i18n from '../i18n';
import { CHARACTER_CONFIG } from '../game/config/CharacterConfig';

// Current UI language as a bare ISO-639-1 code (e.g. "es-ES" -> "es"). This seeds the
// player's learning native_language so helper translations resolve into it.
const currentLang = () => (i18n.language || 'en').split('-')[0].toLowerCase();

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
  user: (() => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    const userFromStorage = userJson ? JSON.parse(userJson) : null;
    
    if (token) {
      const userFromToken = getUserFromToken(token);
      // Merge: priority to Token payload for core identity (role, id, username)
      return userFromToken ? { ...userFromStorage, ...userFromToken } : userFromStorage;
    }
    return userFromStorage;
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  error: null,
  isLoading: false,

  // Membership state (Wompi). isPremium gates premium missions in the UI; the
  // backend enforces it authoritatively on accept.
  isPremium: false,
  subscription: null,

  // Pull the current membership status from the backend. Safe for guests (returns free).
  fetchBillingStatus: async () => {
    try {
      const { data } = await api.get('/billing/status');
      set({ isPremium: !!data.is_premium, subscription: data });
      return data;
    } catch (e) {
      set({ isPremium: false });
      return null;
    }
  },

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
      // Get or generate a device ID to maintain the same guest account across reloads
      let deviceId = localStorage.getItem('guestDeviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        localStorage.setItem('guestDeviceId', deviceId);
      }

      const characterIds = CHARACTER_CONFIG.characters.map(c => c.id);
      // Guests never choose a language explicitly: a browser detected as English
      // would store native_language='en' and silently disable all helper
      // translations (the app teaches English). Default those to Spanish; any
      // other UI language passes through. Changeable later from the Dashboard.
      const uiLang = currentLang();
      const response = await api.post('/auth/guest', {
        character_ids: characterIds,
        native_language: uiLang === 'en' ? 'es' : uiLang,
        device_id: deviceId
      });
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
      const response = await api.post('/auth/register', { username, email, password, native_language: currentLang() });
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

  upgradeGuest: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put('/auth/guest/upgrade', { username, email, password, native_language: currentLang() });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Guest upgrade failed',
        isLoading: false
      });
      return false;
    }
  },

  // Persist the player's native language (drives all helper translations). Safe to call
  // for guests too. No-op on the server for unauthenticated users.
  setNativeLanguage: async (lang) => {
    const code = (lang || 'en').split('-')[0].toLowerCase();
    get().updateUser({ native_language: code });
    if (get().isAuthenticated) {
      try {
        await api.put('/auth/native-language', { native_language: code });
      } catch (e) {
        console.error('Failed to persist native language:', e);
      }
    }
  },

  updateUser: (updatedFields) => {
    const currentUser = get().user;
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(newUser));
      set({ user: newUser });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
