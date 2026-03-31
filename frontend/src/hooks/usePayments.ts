import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../api/payments';

export function usePayments(dealId?: string) {
  return useQuery({
    queryKey: ['payments', dealId],
    queryFn: async () => {
      const res = await paymentsApi.list(dealId ? { dealId } : undefined);
      return res.data;
    },
    staleTime: 10_000,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealId: string; amount: number; dateId?: string }) => {
      const res = await paymentsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // The analytical dashboards might need refresh too since they aggregate payments
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'report' || String(query.queryKey[0]).includes('-dashboard') });
    },
  });
}
