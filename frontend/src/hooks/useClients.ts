import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../api/clients';
import type { Client } from '../types';

export function useClients(params?: Record<string, string>) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients', params],
    queryFn: async () => {
      const res = await clientsApi.list(params);
      const body = res.data as unknown as { clients: Client[] };
      return body.clients ?? (res.data as unknown as Client[]);
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  return {
    clients: data ?? [],
    isLoading,
    error,
    addClient: addMutation.mutateAsync,
  };
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await clientsApi.getById(id);
      const body = res.data as any;
      return (body.client ?? body) as Client;
    },
    enabled: !!id,
  });
}