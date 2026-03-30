import apiClient from './client';

export const dashboardApi = {
  bd: (params: { year: number; quarter: number; bdId?: string }) =>
    apiClient.get('/api/dashboard/bd', { params }),

  executive: (params: { year: number; quarter: number }) =>
    apiClient.get('/api/dashboard/executive', { params }),
};
