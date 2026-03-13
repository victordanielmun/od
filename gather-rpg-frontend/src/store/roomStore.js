import { create } from 'zustand';
import api from '../services/api';

export const useRoomStore = create((set) => ({
  rooms: [],
  currentRoom: null,
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/rooms');
      set({ rooms: response.data, isLoading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch rooms', 
        isLoading: false 
      });
    }
  },

  createRoom: async (roomData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/rooms', roomData);
      set(state => ({ 
        rooms: [...state.rooms, response.data],
        isLoading: false 
      }));
      return response.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Failed to create room', 
        isLoading: false 
      });
      return null;
    }
  },

  joinRoom: async (roomId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/rooms/${roomId}`);
      set({ currentRoom: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Failed to join room', 
        isLoading: false 
      });
      return null;
    }
  },

  leaveRoom: () => {
    set({ currentRoom: null });
  }
}));
