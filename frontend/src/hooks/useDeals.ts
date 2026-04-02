import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Deal } from '../types'
import {
  getDeals, getDeal, createDeal, updateDeal, terminateDeal,
  getPipelineStages, updateDealStage, getDealHistory,
  CreateDealPayload, UpdateDealPayload, UpdateDealStagePayload, TerminateDealPayload,
} from '../api/deals'

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: getDeals,
  })
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(id),
    enabled: !!id,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDealPayload) => createDeal(data),
    onSuccess: (createdDeal) => {
      qc.setQueryData<Deal[]>(['deals'], (existing) => {
        const deals = Array.isArray(existing) ? existing : []
        const withoutDuplicate = deals.filter((deal) => deal.id !== createdDeal.id)
        return [createdDeal, ...withoutDuplicate]
      })
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealPayload }) => updateDeal(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['deal', id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useTerminateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TerminateDealPayload }) => terminateDeal(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['deal', id] })
      qc.invalidateQueries({ queryKey: ['deal-history', id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ── Pipeline Stages (for stage picker — cached indefinitely) ─────────

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
    staleTime: Infinity, // stages never change at runtime
  })
}

// ── Stage Change (hits /api/deals/:id/stage → creates audit log + emits event) ──

export function useUpdateDealStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealStagePayload }) =>
      updateDealStage(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['deal', id] })
      qc.invalidateQueries({ queryKey: ['deal-history', id] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ── Deal Audit Log / Stage History ───────────────────────────────────

export function useDealHistory(dealId: string) {
  return useQuery({
    queryKey: ['deal-history', dealId],
    queryFn: () => getDealHistory(dealId),
    enabled: !!dealId,
  })
}
