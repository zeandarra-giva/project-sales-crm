import apiClient from './client'
import type { Deal, PipelineStage, LeadSource, Bundle } from '../types'

function mapDecisionRank(rank?: string) {
  switch (rank) {
    case 'TIER_1_ECONOMIC_BUYER': return 'Tier 1 Economic Buyer'
    case 'TIER_2_DECISION_MAKER': return 'Tier 2 Decision Maker'
    case 'TIER_3_INFLUENCER': return 'Tier 3 Influencer'
    case 'TIER_4_END_USER': return 'Tier 4 End User'
    case 'TIER_5_GATEKEEPER': return 'Tier 5 Gatekeeper'
    default: return 'Tier 3 Influencer'
  }
}

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
  const currentAuditLog = d.auditLogs?.[0]
  const mappedBundle: Bundle | undefined = d.bundle
    ? {
        id: d.bundle.id,
        name: d.bundle.name,
        services: (d.bundle.bundleServices ?? []).map((bundleService: any) => ({
          service_id: bundleService.serviceId ?? bundleService.service_id,
          bundle_id: bundleService.bundleId ?? bundleService.bundle_id,
          name: bundleService.name ?? bundleService.service?.name,
          service_value: Number(bundleService.serviceValue ?? bundleService.service_value ?? 0),
          revenue_share_pct: Number(bundleService.revenueSharePct ?? bundleService.revenue_share_pct ?? 0),
          service: bundleService.service
            ? {
                id: bundleService.service.id,
                name: bundleService.service.name,
                description: bundleService.service.description ?? undefined,
                is_active: bundleService.service.isActive ?? bundleService.service.is_active ?? true,
              }
            : undefined,
        })),
      }
    : undefined

  return {
    id: d.id,
    deal_name: d.dealName,
    monthly_subscription: Number(d.monthlySubscription),
    revenue: Number(d.revenue),
    duration: d.duration,
    stage: stageName,
    stage_id: d.stageId,
    is_closed: d.isClosed ?? false,
    remarks: currentAuditLog?.remarks ?? d.remarks ?? '',
    action_plan: currentAuditLog?.actionPlan ?? d.actionPlan ?? '',
    proposal_revision_count: d.proposalRevisionCount ?? 0,
    proposal_link: d.proposalLink ?? undefined,
    contract_link: d.contractLink ?? undefined,
    contract_status: d.contractStatus ?? 'ACTIVE',
    terminated_at: d.terminatedAt ?? undefined,
    termination_reason: d.terminationReason ?? undefined,
    termination_notes: d.terminationNotes ?? undefined,
    lead_source: LEAD_SOURCE_MAP[d.leadSource] ?? d.leadSource,
    final_proposed_value: d.finalProposedValue ? Number(d.finalProposedValue) : undefined,
    sales_cycle_days: d.salesCycleDays ?? undefined,
    start_date: d.startDate,
    due_date: d.dueDate ?? '',
    closed_date: d.closedDate ?? undefined,
    last_stage_update_at: d.lastStageUpdateAt,
    last_follow_up_at: d.lastFollowUpAt ?? undefined,
    initial_meeting_date: d.initialMeetingDate ?? undefined,
    action_plan_due_date: currentAuditLog?.actionPlanDueDate ?? d.actionPlanDueDate ?? undefined,
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
      contacts: (d.client.contacts ?? []).map((contact: any) => ({
        id: contact.id,
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        number: contact.number ?? undefined,
        designation: contact.designation ?? undefined,
        decision_rank: mapDecisionRank(contact.decisionRank),
        is_primary: contact.isPrimary,
        client_id: contact.clientId,
      })),
    } : undefined,
    service: d.service ?? undefined,
    bundle: mappedBundle,
    dealContacts: (d.dealContacts ?? []).map((dealContact: any) => ({
      id: dealContact.id,
      isPrimary: dealContact.isPrimary,
      contact: {
        id: dealContact.contact.id,
        firstName: dealContact.contact.firstName,
        lastName: dealContact.contact.lastName,
        email: dealContact.contact.email,
        number: dealContact.contact.number ?? undefined,
        designation: dealContact.contact.designation ?? undefined,
      },
    })),
    auditLogs: d.auditLogs,
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
  contractStartDate: string
  contractEndDate: string
  primaryContactId?: string
  serviceId?: string
  bundleId?: string
  proposalLink?: string
  contractLink?: string
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
  startDate?: string
  remarks?: string
  actionPlan?: string
  dueDate?: string
  proposalLink?: string
  contractLink?: string
  primaryContactId?: string | null
}

export interface TerminateDealPayload {
  terminatedAt: string
  reason: string
  notes?: string
}

export async function updateDeal(id: string, data: UpdateDealPayload): Promise<Deal> {
  const res = await apiClient.patch<any>(`/api/deals/${id}`, data)
  return mapDealToFrontend(res.data)
}

export async function terminateDeal(id: string, data: TerminateDealPayload): Promise<Deal> {
  const res = await apiClient.post<any>(`/api/deals/${id}/terminate`, data)
  return mapDealToFrontend(res.data)
}

// ── Pipeline Stages ──────────────────────────────────────────────────

export interface PipelineStageData {
  id: string
  name: PipelineStage
  duration: number | null
}

export async function getPipelineStages(): Promise<PipelineStageData[]> {
  const res = await apiClient.get<PipelineStageData[]>('/api/pipeline-stages')
  return res.data
}

// ── Stage Change (dedicated endpoint with audit log + event emit) ────

export interface UpdateDealStagePayload {
  stageId: string
  remarks: string
  actionPlan: string
  notes?: string
}

export async function updateDealStage(id: string, data: UpdateDealStagePayload): Promise<Deal> {
  const res = await apiClient.patch<any>(`/api/deals/${id}/stage`, data)
  return mapDealToFrontend(res.data)
}

// ── Deal History ─────────────────────────────────────────────────────

export interface DealHistoryEntry {
  id: string
  type: 'stage_change' | 'contract_terminated'
  title: string
  stage?: PipelineStage
  stageId?: string
  enteredAt: string
  exitedAt?: string
  daysInStage?: number
  isCurrent: boolean
  notes?: string
  changedById: string
  changedBy?: { id: string; firstName: string; lastName: string }
  effectiveDate?: string
}

export async function getDealHistory(id: string): Promise<DealHistoryEntry[]> {
  const res = await apiClient.get<DealHistoryEntry[]>(`/api/deals/${id}/history`)
  return res.data
}
