import apiClient from './client';

export interface PaymentsFilterParams {
  dealId?: string;
  bdId?: string;
  year?: number;
  quarter?: number;
}

export interface PaymentLog {
  id: string;
  dealId: string;
  dealName: string;
  clientName: string | null;
  bdId: string;
  bdName: string;
  amount: number;
  billingYear: number | null;
  billingMonth: number | null;
  billingQuarter: number | null;
  billingLabel: string;
  status: 'Received' | 'Unassigned';
}

export interface CollectionsDealSummary {
  dealId: string;
  dealName: string;
  clientName: string | null;
  accountType: string | null;
  bdId: string;
  bdName: string;
  startDate: string | null;
  terminatedAt: string | null;
  duration: number;
  monthlySubscription: number;
  bookedRevenue: number;
  expectedToDate: number;
  collectedRevenue: number;
  outstandingRevenue: number;
  overdueRevenue: number;
  paidMonths: number;
  unpaidMonths: number;
  overdueMonths: number;
  collectionPct: number;
  nextDueLabel: string | null;
  lastPaidLabel: string | null;
  followUpStatus: 'Current' | 'Due This Month' | 'Overdue';
}

export interface CollectionsOverview {
  summary: {
    bookedRevenue: number;
    expectedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    overdueRevenue: number;
    coveragePct: number;
    trackedDeals: number;
    receivedEntries: number;
    unassignedEntries: number;
  };
  monthlyTrend: Array<{
    monthKey: string;
    label: string;
    expected: number;
    collected: number;
    booked: number;
  }>;
  deals: CollectionsDealSummary[];
  followUps: CollectionsDealSummary[];
  logs: PaymentLog[];
  filterYears: number[];
}

export const paymentsApi = {
  list: (params?: PaymentsFilterParams) =>
    apiClient.get<PaymentLog[]>('/api/payments', { params }),

  overview: (params?: { bdId?: string; year?: number; quarter?: number }) =>
    apiClient.get<CollectionsOverview>('/api/payments/overview', { params }),

  create: (data: { dealId: string; amount: number; dateId?: string; billingYear?: number; billingMonth?: number }) =>
    apiClient.post('/api/payments', data),

  update: (id: string, data: { amount?: number; billingYear?: number; billingMonth?: number }) =>
    apiClient.patch(`/api/payments/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/api/payments/${id}`),
};
