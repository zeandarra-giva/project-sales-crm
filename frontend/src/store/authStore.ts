import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BD } from '../types/index';
import apiClient from '../api/client';

interface AuthState {
  user: BD | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const res = await apiClient.post<{ user: BD; token: string }>('/auth/login', { email, password });
          const { user, token } = res.data;
          // Normalize backend enum roles to display strings
          const roleMap: Record<string, string> = {
            BD_REP: 'BD Rep',
            SENIOR_BD_REP: 'Senior BD Rep',
            SALES_MANAGER: 'Manager',
          };
          if (user.role && roleMap[user.role]) {
            (user as any).role = roleMap[user.role];
          }
          set({ user, token, isAuthenticated: true });
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'crm-auth' }
  )
);
