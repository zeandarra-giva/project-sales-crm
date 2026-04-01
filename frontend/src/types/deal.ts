export type PipelineStage =
  | 'Inquiry'
  | 'Prospecting'
  | 'Discovery'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

export type LeadSource = 'Inbound' | 'Outbound' | 'Referral';
export type ContractStatus = 'ACTIVE' | 'TERMINATED';
export type DealActivityType = 'stage_change' | 'contract_terminated';

export interface Deal {
  id: string;
  deal_name: string;
  monthly_subscription: number;
  revenue: number;
  duration: number;
  stage: PipelineStage;
  stage_id: string;
  is_closed: boolean;
  /**
   * @deprecated Moved to DealAuditLog (Rev 1). Access via deal.auditLogs?.[0]?.remarks
   * Kept optional for mock data and backward compatibility during migration.
   */
  remarks?: string;
  /**
   * @deprecated Moved to DealAuditLog (Rev 2). Access via deal.auditLogs?.[0]?.actionPlan
   */
  action_plan?: string;
  /**
   * @deprecated Moved to DealAuditLog (Rev 3). Access via deal.auditLogs?.[0]?.actionPlanDueDate
   */
  action_plan_due_date?: string;
  proposal_revision_count: number;
  proposal_link?: string;
  contract_link?: string; // Required on Closed Won (Rev 8)
  contract_status?: ContractStatus;
  terminated_at?: string;
  termination_reason?: string;
  termination_notes?: string;
  lead_source: LeadSource;
  final_proposed_value?: number;
  sales_cycle_days?: number;
  start_date: string;
  due_date: string;
  closed_date?: string;
  last_stage_update_at: string;
  last_follow_up_at?: string;
  initial_meeting_date?: string;
  bd_id: string;
  service_id?: string;
  bundle_id?: string;
  client_id: string;
  bd?: import('./user').BD;
  client?: import('./client').Client;
  service?: import('./service').Service;
  bundle?: import('./service').Bundle;
  // Current stage audit log entry (exitedAt IS NULL)
  auditLogs?: DealAuditLog[];
  dealContacts?: {
    id: string;
    isPrimary: boolean;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      number?: string;
      designation?: string;
    };
  }[];
  probability_pct?: number;
  days_in_stage?: number;
}

export interface DealAuditLog {
  id: string;
  activity_type?: DealActivityType;
  title?: string;
  deal_id?: string;
  stage?: PipelineStage;
  stage_id?: string;
  entered_at: string;
  exited_at?: string;
  days_in_stage?: number;
  changed_by?: string;
  changedBy?: { id: string; firstName: string; lastName: string };
  notes?: string;
  effective_date?: string;
  // Migrated from Deal (Rev 1–3)
  remarks?: string;
  actionPlan?: string;
  action_plan?: string;
  actionPlanDueDate?: string;
  action_plan_due_date?: string;
}

export interface DealProjection {
  id: string;
  deal_id: string;
  bd_id: string;
  projected_amount: number;
  // probabilityPct and weightedValue removed (Rev 5)
  // Forecast now uses Closed Won + 80% Negotiation formula
}
