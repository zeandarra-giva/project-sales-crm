export type PipelineStage =
  | 'Inquiry'
  | 'Prospecting'
  | 'Discovery'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

export type LeadSource = 'INBOUND' | 'OUTBOUND' | 'REFERRAL';

export interface Deal {
  id: string;
  deal_name: string;
  monthly_subscription: number;
  revenue: number;
  duration: number;
  stage: PipelineStage;
  stage_id: string;
  is_closed: boolean;
  remarks: string;
  action_plan: string;
  proposal_revision_count: number;
  proposal_link?: string;
  contract_link?: string;
  lead_source: LeadSource;
  final_proposed_value?: number;
  sales_cycle_days?: number;
  start_date: string;
  due_date: string;
  closed_date?: string;
  last_stage_update_at: string;
  last_follow_up_at?: string;
  initial_meeting_date?: string;
  action_plan_due_date?: string;
  bd_id: string;
  service_id?: string;
  bundle_id?: string;
  client_id: string;
  bd?: import('./user').BD;
  client?: import('./client').Client;
  service?: import('./service').Service;
  bundle?: import('./service').Bundle;
  probability_pct?: number;
  days_in_stage?: number;
}

export interface DealAuditLog {
  id: string;
  deal_id: string;
  stage: PipelineStage;
  entered_at: string;
  exited_at?: string;
  days_in_stage?: number;
  changed_by: string;
  notes?: string;
}

export interface DealProjection {
  id: string;
  deal_id: string;
  bd_id: string;
  projected_amount: number;
  probability_pct: number;
  weighted_value: number;
}