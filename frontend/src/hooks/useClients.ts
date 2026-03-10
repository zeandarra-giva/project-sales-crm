import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientsApi } from '../api/clients'
import type { Client } from '../types';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await clientsApi.list()
      return res.data
    },
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await clientsApi.getById(id)
      return res.data
    },
    enabled: !!id,                               // don't fetch if no ID yet
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await clientsApi.create(data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await clientsApi.update(id, data)
      return res.data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
  })
}
