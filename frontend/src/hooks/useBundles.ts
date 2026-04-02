import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bundlesApi } from '../api/bundles'

export function useBundles() {
  return useQuery({
    queryKey: ['bundles'],
    queryFn: () => bundlesApi.list(),
  })
}

export function useCreateBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => bundlesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })
}

export function useUpdateBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      bundlesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })
}

export function useDeleteBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bundlesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })
}

export function useAddServiceToBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bundleId, data }: {
      bundleId: string
      data: { serviceId: string; name: string; serviceValue: number; revenueSharePct: number }
    }) => bundlesApi.addService(bundleId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })
}

export function useRemoveServiceFromBundle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bundleId, serviceId }: { bundleId: string; serviceId: string }) =>
      bundlesApi.removeService(bundleId, serviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bundles'] }),
  })
}
