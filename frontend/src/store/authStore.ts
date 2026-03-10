import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BD } from '../types/index';
import { MOCK_BDS } from '../mockData';
import { login as apiLogin, getMe as apiGetMe } from '../api/auth';

interface AuthState {
  user: BD | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (bdId: string) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const data = await apiLogin(email, password);
          if (data && data.token && data.user) {
            set({ user: data.user, token: data.token, isAuthenticated: true });
            return true;
          }
          return false;
        } catch (error) {
          console.error("Login failed:", error);
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      fetchUser: async () => {
        try {
          const { token } = get();
          if (!token) return;
          const data = await apiGetMe();
          if (data && data.user) {
            set({ user: data.user, isAuthenticated: true });
          }
        } catch (error) {
          console.error("Failed to verify user token:", error);
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      switchUser: (bdId: string) => {
        const user = MOCK_BDS.find((bd) => bd.id === bdId);
        if (user) set({ user, isAuthenticated: true, token: 'mock-jwt-token' });
      },
    }),
    {
      name: 'crm-auth',
    }
  )
);
