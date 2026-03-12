import apiClient from './client';

export const paymentsApi = {
  list: (params?: Record<string, string>) => apiClient.get('/payments', { params }),
  update: (id: string, data: { amount: number }) =>
    apiClient.patch(`/payments/${id}`, data),
  delete: (id: string) =>
    apiClient.delete(`/payments/${id}`),
};