import apiClient from './client'
import type { Deal, PipelineStage, LeadSource } from '../types'

// ── Backend → Frontend mapper ────────────────────────────────────────
// Prisma returns camelCase + nested includes; our Deal type is snake_case + flat stage string.

const STAGE_PROBABILITY: Record<string, number> = {
  'Inquiry': 10, 'Prospecting': 20, 'Discovery': 40,
  'Proposal Sent': 60, 'Negotiation': 75, 'Closed Won': 100, 'Closed Lost': 0,
}

const LEAD_SOURCE_MAP: Record<string, LeadSource> = {
  INBOUND: 'Inbound', OUTBOUND: 'Outbound', REFERRAL: 'Referral',
}

function daysBetween(from: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86400000))
}

export function mapDealToFrontend(d: any): Deal {
  const stageName = (d.stage?.name ?? 'Inquiry') as PipelineStage
  return {
    id: d.id,
    deal_name: d.dealName,
    monthly_subscription: Number(d.monthlySubscription),
    revenue: Number(d.revenue),
    duration: d.duration,
    stage: stageName,
    stage_id: d.stageId,
    is_closed: d.isClosed ?? false,
    remarks: d.remarks ?? '',
    action_plan: d.actionPlan ?? '',
    proposal_revision_count: d.proposalRevisionCount ?? 0,
    proposal_link: d.proposalLink ?? undefined,
    contract_link: d.contractLink ?? undefined,
    lead_source: LEAD_SOURCE_MAP[d.leadSource] ?? d.leadSource,
    final_proposed_value: d.finalProposedValue ? Number(d.finalProposedValue) : undefined,
    sales_cycle_days: d.salesCycleDays ?? undefined,
    start_date: d.startDate,
    due_date: d.dueDate ?? '',
    closed_date: d.closedDate ?? undefined,
    last_stage_update_at: d.lastStageUpdateAt,
    last_follow_up_at: d.lastFollowUpAt ?? undefined,
    initial_meeting_date: d.initialMeetingDate ?? undefined,
    action_plan_due_date: d.actionPlanDueDate ?? undefined,
    bd_id: d.bdId,
    service_id: d.serviceId ?? undefined,
    bundle_id: d.bundleId ?? undefined,
    client_id: d.clientId,
    bd: d.bd,
    client: d.client ? {
      id: d.client.id,
      name: d.client.name,
      brand: d.client.brand,
      account_type: d.client.accountType,
      status: d.client.status,
      industry_id: d.client.industryId,
      contact_id: d.client.contactId,
    } : undefined,
    service: d.service ?? undefined,
    bundle: d.bundle ?? undefined,
    probability_pct: STAGE_PROBABILITY[stageName] ?? 0,
    days_in_stage: d.lastStageUpdateAt ? daysBetween(d.lastStageUpdateAt) : 0,
  }
}

// ── API functions ────────────────────────────────────────────────────

export async function getDeals(): Promise<Deal[]> {
  const res = await apiClient.get<any[]>('/api/deals')
  return res.data.map(mapDealToFrontend)
}

export async function getDeal(id: string): Promise<Deal> {
  const res = await apiClient.get<any>(`/api/deals/${id}`)
  return mapDealToFrontend(res.data)
}

export interface CreateDealPayload {
  dealName: string
  clientId: string
  monthlySubscription: number
  duration: number
  leadSource: 'INBOUND' | 'OUTBOUND' | 'REFERRAL'
  serviceId?: string
  bundleId?: string
  proposalLink?: string
}

export async function createDeal(data: CreateDealPayload): Promise<Deal> {
  const res = await apiClient.post<any>('/api/deals', data)
  return mapDealToFrontend(res.data)
}

export interface UpdateDealPayload {
  dealName?: string
  monthlySubscription?: number
  duration?: number
  stageId?: string
  remarks?: string
  actionPlan?: string
  dueDate?: string
  proposalLink?: string
  contractLink?: string
}

export async function updateDeal(id: string, data: UpdateDealPayload): Promise<Deal> {
  const res = await apiClient.patch<any>(`/api/deals/${id}`, data)
  return mapDealToFrontend(res.data)
}
