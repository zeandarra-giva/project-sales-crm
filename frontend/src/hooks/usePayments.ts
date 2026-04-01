import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, type PaymentsFilterParams } from '../api/payments';

export function usePayments(filters?: PaymentsFilterParams) {
  return useQuery({
    queryKey: ['payments', filters?.dealId || 'all', filters?.bdId || 'all', filters?.year || 'all', filters?.quarter || 'all'],
    queryFn: async () => {
      const res = await paymentsApi.list(filters);
      return res.data;
    },
    staleTime: 10_000,
  });
}

export function usePaymentsOverview(filters?: { bdId?: string; year?: number; quarter?: number }) {
  return useQuery({
    queryKey: ['payments-overview', filters?.bdId || 'all', filters?.year || 'all', filters?.quarter || 'all'],
    queryFn: async () => {
      const res = await paymentsApi.overview(filters);
      return res.data;
    },
    staleTime: 10_000,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; amount: number; dateId?: string; billingYear?: number; billingMonth?: number }) => {
      const res = await paymentsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-overview'] });
      // The analytical dashboards might need refresh too since they aggregate payments
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'report' || String(query.queryKey[0]).includes('-dashboard') });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount?: number; billingYear?: number; billingMonth?: number } }) => {
      const res = await paymentsApi.update(id, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-overview'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'collections-report' });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await paymentsApi.remove(id);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-overview'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'collections-report' });
    },
  });
}
