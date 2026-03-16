import apiClient from './client';
import type { Contact } from '../types';

export interface CreateContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  decisionMakerTier?: number;
  clientId: string;
  isPrimary?: boolean;
}

export const contactsApi = {
  list: (params?: Record<string, string>) => apiClient.get('/api/contacts', { params }),
  create: (data: CreateContactPayload) => apiClient.post('/api/contacts', data),
  update: (id: string, data: Partial<CreateContactPayload>) => apiClient.patch(`/api/contacts/${id}`, data),
};
