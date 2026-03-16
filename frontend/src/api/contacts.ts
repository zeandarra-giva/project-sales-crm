import apiClient from './client';
import type { Contact, DecisionRank } from '../types';

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

const RANK_MAP: Record<string, DecisionRank> = {
  TIER_1_ECONOMIC_BUYER: 'Tier 1 Economic Buyer',
  TIER_2_DECISION_MAKER: 'Tier 2 Decision Maker',
  TIER_3_INFLUENCER: 'Tier 3 Influencer',
  TIER_4_END_USER: 'Tier 4 End User',
  TIER_5_GATEKEEPER: 'Tier 5 Gatekeeper',
};

function mapContactToFrontend(c: any): Contact {
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    number: c.number ?? undefined,
    designation: c.designation ?? undefined,
    decision_rank: RANK_MAP[c.decisionRank] ?? c.decisionRank ?? 'Tier 3 Influencer',
    is_primary: c.isPrimary ?? false,
    client_id: c.clientId,
    client: c.client ? {
      id: c.client.id,
      name: c.client.name,
      account_type: c.client.accountType,
      status: c.client.status,
    } : undefined,
  };
}

export const contactsApi = {
  list: async (params?: Record<string, string>) => {
    const res = await apiClient.get<any[]>('/api/contacts', { params });
    return { ...res, data: res.data.map(mapContactToFrontend) };
  },
  create: async (data: CreateContactPayload) => {
    const res = await apiClient.post<any>('/api/contacts', data);
    return { ...res, data: mapContactToFrontend(res.data) };
  },
  update: async (id: string, data: Partial<CreateContactPayload>) => {
    const res = await apiClient.patch<any>(`/api/contacts/${id}`, data);
    return { ...res, data: mapContactToFrontend(res.data) };
  },
};
