import apiClient from './client';
import type { Contact } from '../types';

export const contactsApi = {
  list: (params?: Record<string, string>) => apiClient.get('/api/contacts', { params }),
  getById: (id: string) => apiClient.get(`/api/contacts/${id}`),
  create: (data: any) => apiClient.post('/api/contacts', data),
  update: (id: string, data: any) => apiClient.patch(`/api/contacts/${id}`, data),
};
