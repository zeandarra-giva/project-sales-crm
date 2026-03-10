import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '../api/deals';
import type { Deal, PipelineStage } from '../types';

export function useDeals(params?: Record<string, string>) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['deals', params],
    queryFn: async () => {
      const res = await dealsApi.list(params);
      const body = res.data as unknown as { deals: Deal[] };
      const raw = body.deals ?? (res.data as unknown as Deal[]);
      // Normalize stage: backend returns {id, name, duration}, components expect string
      return raw.map((d: any) => ({
        ...d,
        stage: typeof d.stage === 'object' ? d.stage?.name ?? d.stage : d.stage,
      })) as Deal[];
    },
  });

  const deals = data ?? [];
  const openDeals = deals.filter(d => !d.is_closed);
  const closedDeals = deals.filter(d => d.is_closed);
  const totalPipelineValue = openDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const weightedValue = openDeals.reduce((s, d) => s + Number(d.revenue ?? 0) * (d.probability_pct ?? 0) / 100, 0);

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage, notes, remarks, contractLink, finalProposedValue }: {
      id: string; stage: PipelineStage; notes?: string; remarks?: string;
      contractLink?: string; finalProposedValue?: number;
    }) => dealsApi.updateStage(id, stage, notes, remarks, contractLink, finalProposedValue),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Deal> }) => dealsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  return {
    deals,
    openDeals,
    closedDeals,
    totalPipelineValue,
    weightedValue,
    isLoading,
    error,
    updateStage: updateStageMutation.mutateAsync,
    updateDeal: updateMutation.mutateAsync,
    isUpdating: updateStageMutation.isPending || updateMutation.isPending,
  };
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const res = await dealsApi.getById(id);
      const d = res.data as any;
      const deal = d.deal ?? d;
      return {
        ...deal,
        stage: typeof deal.stage === 'object' ? deal.stage?.name ?? deal.stage : deal.stage,
      } as Deal;
    },
    enabled: !!id,
  });
}

export function useDealHistory(id: string) {
  return useQuery({
    queryKey: ['deal-history', id],
    queryFn: async () => {
      const res = await dealsApi.history(id);
      return (res.data as unknown as { history: unknown[] }).history ?? [];
    },
    enabled: !!id,
  });
}