import { useState, useCallback } from 'react';
import { MOCK_DEALS } from '../mockData';
import type { Deal, PipelineStage } from '../types';

export function useDeals(bdId?: string) {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);

  const filtered = bdId
    ? deals.filter(d => d.bd_id === bdId)
    : deals;

  const getById = useCallback((id: string) => deals.find(d => d.id === id), [deals]);

  const updateDeal = useCallback((id: string, patch: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  const updateStage = useCallback((id: string, stage: PipelineStage, probability: number) => {
    setDeals(prev => prev.map(d =>
      d.id === id
        ? { ...d, stage, probability_pct: probability, last_stage_update_at: new Date().toISOString() }
        : d
    ));
  }, []);

  const openDeals = filtered.filter(d => !d.is_closed);
  const closedDeals = filtered.filter(d => d.is_closed);
  const totalPipelineValue = openDeals.reduce((s, d) => s + d.revenue, 0);
  const weightedValue = openDeals.reduce((s, d) => s + d.revenue * (d.probability_pct ?? 0) / 100, 0);

  return { deals, filtered, openDeals, closedDeals, totalPipelineValue, weightedValue, getById, updateDeal, updateStage };
}
