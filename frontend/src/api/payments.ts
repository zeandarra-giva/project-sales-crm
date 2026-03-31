import apiClient from './client';

export const paymentsApi = {
  list: (params?: { dealId?: string }) => 
    apiClient.get('/api/payments', { params }),

  create: (data: { dealId: string; amount: number; dateId?: string }) =>
    apiClient.post('/api/payments', data),
};
