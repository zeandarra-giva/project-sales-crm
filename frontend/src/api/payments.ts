import apiClient from './client';

export const paymentsApi = {
  list: () => apiClient.get('/payments'),
  create: (data: { dealId: string; amount: number; year: number; month: number }) =>
    apiClient.post('/payments', {
      dealId: data.dealId,
      amount: data.amount,
      year: Number(data.year),
      month: Number(data.month),
    }),
};