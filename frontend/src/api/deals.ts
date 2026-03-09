import apiClient from './client'
import type { Deal } from '../types'

export async function getDeals() {
  const response = await apiClient.get<any[]>('/api/deals')
  // Depending on how backend is typed, we can map properties back to Deal
  // We'll trust the Motia response gives us what we matched on the backend.
  return response.data
}

export interface CreateDealPayload {
  dealName: string;
  clientId: string;
  monthlySubscription: number;
  duration: number;
  leadSource: 'INBOUND' | 'OUTBOUND' | 'REFERRAL';
  serviceId?: string;
  bundleId?: string;
  proposalLink?: string;
}

export async function createDeal(data: CreateDealPayload) {
  const response = await apiClient.post('/api/deals', data)
  return response.data
}
