import apiClient from './client';
import type { Client, AccountType, ClientStatus } from '../types';

function mapClientToFrontend(client: any): Client {
  return {
    ...client,
    account_type: client.accountType ? (client.accountType.charAt(0).toUpperCase() + client.accountType.slice(1).toLowerCase()) as AccountType : undefined,
    status: client.status ? (client.status.charAt(0).toUpperCase() + client.status.slice(1).toLowerCase()) as ClientStatus : undefined,
    industry_id: client.industryId,
    contact_id: client.contactId,
    referral_id: client.referralId,
  };
}

function mapClientToBackend(data: Partial<Client>): any {
  const payload: any = { ...data };
  if (data.account_type) payload.accountType = data.account_type.toUpperCase();
  if (data.status) payload.status = data.status.toUpperCase();
  if (data.industry_id !== undefined) payload.industryId = data.industry_id;
  if (data.contact_id !== undefined) payload.contactId = data.contact_id;
  if (data.referral_id !== undefined) payload.referralId = data.referral_id;
  return payload;
}

export const clientsApi = {
  list: async (params?: Record<string, string>): Promise<{ data: Client[] }> => {
    const res = await apiClient.get<any[]>('/api/clients', { params })
    return { ...res, data: res.data.map(mapClientToFrontend) }
  },
  getById: async (id: string): Promise<{ data: Client }> => {
    const res = await apiClient.get<any>(`/api/clients/${id}`)
    return { ...res, data: mapClientToFrontend(res.data) }
  },
  create: async (data: Partial<Client>): Promise<{ data: Client }> => {
    const res = await apiClient.post<any>('/api/clients', mapClientToBackend(data))
    return { ...res, data: mapClientToFrontend(res.data) }
  },
  update: async (id: string, data: Partial<Client>): Promise<{ data: Client }> => {
    const res = await apiClient.patch<any>(`/api/clients/${id}`, mapClientToBackend(data))
    return { ...res, data: mapClientToFrontend(res.data) }
  }
};
