import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BD } from '../types/index';
import { MOCK_BDS } from '../mockData';

interface AuthState {
  user: BD | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (bdId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, _password: string) => {
        // Mock login — match by email
        const user = MOCK_BDS.find((bd) => bd.email === email);
        if (user) {
          set({ user, token: 'mock-jwt-token', isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
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
