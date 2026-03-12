import apiClient from './client';
import type { BDDashboard, ExecutiveDashboard } from '../types';

export const dashboardApi = {
  bd: (year?: number, quarter?: number, bdId?: string) =>
    apiClient.get<BDDashboard>('/dashboard/bd', {
      params: { ...(year ? { year } : {}), ...(quarter ? { quarter } : {}), ...(bdId ? { bd_id: bdId } : {}) },
    }),
  executive: (year?: number, quarter?: number) =>
    apiClient.get<ExecutiveDashboard>('/dashboard/executive', {
      params: { ...(year ? { year } : {}), ...(quarter ? { quarter } : {}) },
    }),
};