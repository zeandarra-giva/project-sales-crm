import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { targetsApi } from '../api/targets'

export function useQuarterlyTargets(year: number, quarter: number | 'ALL') {
  return useQuery({
    queryKey: ['quarterly-targets', year, quarter],
    enabled: quarter !== 'ALL',
    queryFn: async () => {
      const res = await targetsApi.listQuarterly({ year, quarter: Number(quarter) })
      return res.data
    },
    staleTime: 30_000,
  })
}

export function useSaveQuarterlyTargets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { year: number; quarter: number; targets: Array<{ id?: string; bdId: string; quota: number }> }) => {
      const res = await targetsApi.saveQuarterly(data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['quarterly-targets', variables.year, variables.quarter] })
      qc.invalidateQueries({ queryKey: ['executive-dashboard'] })
      qc.invalidateQueries({ queryKey: ['report'] })
      qc.invalidateQueries({ queryKey: ['growth-comparison'] })
    },
  })
}
