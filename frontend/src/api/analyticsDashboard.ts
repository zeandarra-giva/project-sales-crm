/**
 * Analytics Service — Dashboard API
 *
 * Calls the FastAPI analytics service (port 8001) for all dashboard metrics.
 * Response shapes are defined by Andre's analytics PRD and matched here as
 * TypeScript interfaces.
 */
import analyticsClient from './analyticsClient';

// ── Response types ────────────────────────────────────────────────────────────

export interface BDKpis {
  total_revenue: number;
  open_pipeline: number;
  quota: number;
  monthly_quota: number;
  attainment_pct: number;
  sales_forecast: number;
  variance: number;
  monthly_variance: number;
  excess_deficit: 'Excess' | 'Deficit';
  monthly_excess_deficit: 'Excess' | 'Deficit';
}

export interface RevenueByMonth {
  month: number;
  month_name: string;
  revenue: number;
  quota: number;
}

export interface PipelineByStage {
  stage_name: string;
  deal_count: number;
  total_value: number;
}

export interface OpenDeal {
  deal_id: string;
  deal_name: string;
  stage_name: string;
  revenue: number;
  days_in_stage: number;
}

export interface ServiceRevenue {
  service_name: string;
  revenue: number;
  deal_count: number;
}

export interface AccountTypePipeline {
  account_type: string;
  deal_count: number;
  total_value: number;
}

export interface LeadSource {
  lead_source: string;
  total_deals: number;
  won_deals: number;
  won_revenue: number;
}

export interface FollowUp {
  total_open: number;
  overdue_action_plans: number;
  overdue_follow_ups: number;
  upcoming_action_plans: number;
}

export interface BDDashboardAnalytics extends BDKpis {
  revenue_by_month: RevenueByMonth[];
  pipeline_by_stage: PipelineByStage[];
  open_deals: OpenDeal[];
  service_revenue: ServiceRevenue[];
  account_type_pipeline: AccountTypePipeline[];
  lead_source: LeadSource[];
  follow_up: FollowUp;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export interface BDDashboardParams {
  year: number;
  quarter: number;
  bd_id: string;
}

export interface ExecDashboardParams {
  year: number;
  quarter: number;
}

export const analyticsDashboardApi = {
  /** Fetch all BD dashboard metrics for a given BD rep and quarter */
  bd: (params: BDDashboardParams) =>
    analyticsClient.get<BDDashboardAnalytics>('/api/analytics/dashboard/bd', { params }),

  /** Fetch team-wide executive dashboard (SALES_MANAGER only) */
  executive: (params: ExecDashboardParams) =>
    analyticsClient.get('/api/analytics/dashboard/executive', { params }),
};
