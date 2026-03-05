import apiClient from './client';
import type { BDDashboard, ExecutiveDashboard } from '../types';

export const dashboardApi = {
  bd:        (period?: string) => apiClient.get<BDDashboard>('/dashboard/bd', { params: { period } }),
  executive: (period?: string) => apiClient.get<ExecutiveDashboard>('/dashboard/executive', { params: { period } }),
};
