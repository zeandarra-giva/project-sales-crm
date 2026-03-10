import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isAuthenticated, login, logout } = useAuthStore();

  const isManager = user?.role === 'SALES_MANAGER';
  const isBD = user?.role === 'BD_REP';
  const canViewAll = isManager;

  return { user, isAuthenticated, login, logout, isManager, isBD, canViewAll };
}
