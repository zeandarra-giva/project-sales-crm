import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDeals, getDeal, createDeal, updateDeal, CreateDealPayload, UpdateDealPayload } from '../api/deals'

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
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
    },
  })
}
