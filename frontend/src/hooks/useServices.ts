import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../api/services'

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.list()
      return res.data
    },
    staleTime: Infinity,
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      servicesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; isActive?: boolean } }) =>
      servicesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}
