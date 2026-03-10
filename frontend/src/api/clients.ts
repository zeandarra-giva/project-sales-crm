import apiClient from './client';
import type { Client } from '../types';

export const clientsApi = {
  list: (params?: Record<string, string>) => apiClient.get<Client[]>('/clients', { params }),
  getById: (id: string) => apiClient.get<Client>(`/clients/${id}`),
  create: (data: Partial<Client>) => apiClient.post<Client>('/clients', data),
  update: (id: string, data: Partial<Client>) => apiClient.patch<Client>(`/clients/${id}`, data)
};
