import apiClient from './client';
import type { Contact } from '../types';

export const contactsApi = {
  list:    (params?: Record<string, string>) => apiClient.get<Contact[]>('/contacts', { params }),
  getById: (id: string)                      => apiClient.get<Contact>(`/contacts/${id}`),
  create:  (data: Partial<Contact>)          => apiClient.post<Contact>('/contacts', data),
  update:  (id: string, data: Partial<Contact>) => apiClient.patch<Contact>(`/contacts/${id}`, data),
  delete:  (id: string)                      => apiClient.delete(`/contacts/${id}`),
};
