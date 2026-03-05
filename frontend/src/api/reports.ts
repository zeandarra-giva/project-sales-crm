import apiClient from './client';

export const reportsApi = {
  pipeline:    (params?: Record<string, string>) => apiClient.get('/reports/pipeline', { params }),
  winLoss:     (params?: Record<string, string>) => apiClient.get('/reports/win-loss', { params }),
  salesCycle:  (params?: Record<string, string>) => apiClient.get('/reports/sales-cycle', { params }),
  growth:      (params?: Record<string, string>) => apiClient.get('/reports/growth', { params }),
  quota:       (params?: Record<string, string>) => apiClient.get('/reports/quota', { params }),
  exportCsv:   (type: string)                    => apiClient.get(`/reports/export/${type}`, { responseType: 'blob' }),
};
