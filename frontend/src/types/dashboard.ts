import type { BD } from './user';
import type { Deal, PipelineStage } from './deal';
import type { Client, AccountType } from './client';

export type PeriodType = 'Monthly' | 'Quarterly' | 'Annual';

export interface Target {
  id: string;
  quota: number;
  period_type: PeriodType;
  date_id: string;
  bd_id: string;
  bd?: BD;
}

export interface BDDashboard {
  bd: BD;
  quarter: string;
  quarter_range: string;
  deals_closed: number;
  open_deals: number;
  total_target_status_pct: number;
  sales_forecast: number;
  sales_variance: number;
  monthly_excess_deficit: number;
  quarterly_excess_deficit: number;
  quota_quarterly: number;
  actual_closed_quarterly: number;
  top_deals: Deal[];
  pipeline_deals: Deal[];
  stuck_deals: Deal[];
}

export interface ExecutiveDashboard {
  team_quota: number;
  team_actual: number;
  team_forecast: number;
  bd_members: BDPerformance[];
  pipeline_by_stage: PipelineStageMetric[];
  stuck_deals: Deal[];
  closed_by_account_type: AccountTypeMetric[];
  closed_by_service: ServiceMetric[];
  top_clients: ClientRevenue[];
  leaderboard: LeaderboardEntry[];
}

export interface BDPerformance {
  bd: BD;
  quota: number;
  actual: number;
  forecast: number;
  variance: number;
  attainment_pct: number;
  win_rate: number;
  open_deals: number;
  closed_deals: number;
}

export interface PipelineStageMetric {
  stage: PipelineStage;
  deal_count: number;
  total_value: number;
  weighted_value: number;
}

export interface AccountTypeMetric {
  account_type: AccountType;
  deal_count: number;
  total_revenue: number;
}

export interface ServiceMetric {
  service_name: string;
  deal_count: number;
  total_revenue: number;
  win_rate: number;
}

export interface ClientRevenue {
  client: Client;
  total_revenue: number;
  deal_count: number;
}

export interface LeaderboardEntry {
  rank: number;
  bd: BD;
  closed_revenue: number;
  quota: number;
  attainment_pct: number;
  deals_won: number;
  win_rate: number;
}
