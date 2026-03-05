import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isAuthenticated, login, logout } = useAuthStore();

  const isManager = user?.role === 'Manager';
  const isSeniorBD = user?.role === 'Senior BD Rep';
  const isBD = user?.role === 'BD Rep';
  const canViewAll = isManager;

  return { user, isAuthenticated, login, logout, isManager, isSeniorBD, isBD, canViewAll };
}
