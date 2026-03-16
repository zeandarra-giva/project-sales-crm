import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '../api/deals';
import type { Deal, PipelineStage } from '../types';

/** Prisma returns camelCase; our Deal type uses snake_case. Normalize both. */
function normalizeDeal(d: any): Deal {
  return {
    ...d,
    // dates
    start_date: d.startDate ?? d.start_date ?? null,
    due_date: d.dueDate ?? d.due_date ?? null,
    closed_date: d.closedDate ?? d.closed_date ?? null,
    action_plan_due_date: d.actionPlanDueDate ?? d.action_plan_due_date ?? null,
    // other mapped fields
    deal_name: d.dealName ?? d.deal_name,
    monthly_subscription: d.monthlySubscription ?? d.monthly_subscription,
    lead_source: d.leadSource ?? d.lead_source,
    action_plan: d.actionPlan ?? d.action_plan,
    proposal_link: d.proposalLink ?? d.proposal_link,
    contract_link: d.contractLink ?? d.contract_link,
    is_closed: d.isClosed ?? d.is_closed,
    days_in_stage: d.daysInCurrentStage ?? d.days_in_stage ?? 0,
    probability_pct: d.probabilityPct ?? d.probability_pct,
    // stage: backend returns {id, name, duration} — components expect string
    stage: typeof d.stage === 'object' ? d.stage?.name ?? d.stage : d.stage,
  } as Deal;
}

export function useDeals(params?: Record<string, string>) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['deals', params],
    queryFn: async () => {
      const res = await dealsApi.list(params);
      const body = res.data as unknown as { deals: Deal[] };
      const raw = body.deals ?? (res.data as unknown as Deal[]);
      return raw.map(normalizeDeal);
    },
  });

  const deals = data ?? [];
  const openDeals = deals.filter(d => !d.is_closed);
  const closedDeals = deals.filter(d => d.is_closed);
  const totalPipelineValue = openDeals.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const weightedValue = openDeals.reduce((s, d) => s + Number(d.revenue ?? 0) * (d.probability_pct ?? 0) / 100, 0);

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage, remarks, actionPlan, actionPlanDueDate, notes, contractLink, finalProposedValue, deal }: {
      id: string; stage: PipelineStage;
      remarks: string; actionPlan: string; actionPlanDueDate: string;
      notes?: string; contractLink?: string; finalProposedValue?: number; deal?: any;
    }) => {
      const ORDERED = ['Inquiry', 'Prospecting', 'Discovery', 'Proposal Sent', 'Negotiation', 'Closed Won'];
      const GATED = ['Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];

      // Guard 1: no stage skipping
      if (deal && stage !== 'Closed Lost') {
        const currentStageName = typeof deal.stage === 'string' ? deal.stage : (deal as any).stage?.name ?? deal.stage;
        const currentIdx = ORDERED.indexOf(currentStageName);
        const targetIdx = ORDERED.indexOf(stage);
        if (targetIdx > currentIdx + 1) {
          throw new Error(`You can only advance one stage at a time. Move to ${ORDERED[currentIdx + 1]} first.`);
        }
      }

      // Guard 2: contract dates required from Proposal Sent onward
      if (GATED.includes(stage)) {
        const missing: string[] = [];
        const hasStart = deal?.start_date != null || deal?.startDate != null;
        const hasDue = deal?.due_date != null || deal?.dueDate != null;
        if (!hasStart) missing.push('Contract Start Date');
        if (!hasDue) missing.push('Expected Close Date');
        if (missing.length > 0) {
          throw new Error(`Please add ${missing.join(' and ')} before moving to "${stage}". Use ✏ Edit Deal.`);
        }
      }

      return dealsApi.updateStage(id, stage, remarks, actionPlan, actionPlanDueDate, notes, contractLink, finalProposedValue);
    },
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
      return normalizeDeal(deal);
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