import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportingApi, type GrowthEntryPayload } from '../api/reporting'

export function useReportingPeriods() {
  return useQuery({
    queryKey: ['reporting-periods'],
    queryFn: reportingApi.periods,
    staleTime: 60_000,
  })
}

export function useGrowthEntries(params: {
  year: number
  quarter?: number | null
  compareYear?: number
  compareQuarter?: number | null
}) {
  return useQuery({
    queryKey: ['growth-entries', params.year, params.quarter ?? 'all', params.compareYear ?? 'none', params.compareQuarter ?? 'all'],
    queryFn: () => reportingApi.growthEntries(params),
  })
}

export function useCreateGrowthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GrowthEntryPayload) => reportingApi.createGrowthEntry(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['growth-entries'] })
      qc.invalidateQueries({ queryKey: ['reporting-periods'] })
    },
  })
}

export function useUpdateGrowthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<GrowthEntryPayload> }) =>
      reportingApi.updateGrowthEntry(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['growth-entries'] })
      qc.invalidateQueries({ queryKey: ['reporting-periods'] })
    },
  })
}
