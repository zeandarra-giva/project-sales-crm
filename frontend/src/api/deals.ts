import apiClient from './client';
import type { Deal } from '../types';

export const dealsApi = {
  list: (params?: Record<string, string>) => apiClient.get<Deal[]>('/deals', { params }),
  getById: (id: string) => apiClient.get<Deal>(`/deals/${id}`),
  create: (data: Partial<Deal>) => apiClient.post<Deal>('/deals', data),
  update: (id: string, data: Partial<Deal>) => apiClient.patch<Deal>(`/deals/${id}`, data),
  updateStage: (
    id: string,
    stage: string,
    notes?: string,
    remarks?: string,
    contractLink?: string,
    finalProposedValue?: number,
  ) => apiClient.patch<Deal>(`/deals/${id}/stage`, {
    stageName: stage,
    notes,
    remarks,
    contractLink,
    finalProposedValue,
  }),
  delete: (id: string) => apiClient.delete(`/deals/${id}`),
  history: (id: string) => apiClient.get(`/deals/${id}/history`),
};