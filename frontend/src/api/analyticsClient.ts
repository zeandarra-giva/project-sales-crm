/**
 * Analytics API client — calls Andre's FastAPI analytics service (port 8001).
 * Vite proxies /api/analytics → http://localhost:8001 in dev.
 * Uses the same JWT token issued by Zeandy's login endpoint.
 */

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const analyticsClient = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the same JWT token before every request
analyticsClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shared 401 handler — same as main client
analyticsClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Response shape types (matching Andre's API) ────────────────────────────

export interface AnalyticsBDDashboard {
  total_revenue: number;
  open_pipeline: number;
  quota: number;
  attainment_pct: number;
  sales_forecast: number;
  variance: number;
  excess_deficit: 'Excess' | 'Deficit';
  revenue_by_month: { month: number; month_name: string; revenue: number }[];
  pipeline_by_stage: { stage_name: string; deal_count: number; total_value: number }[];
  open_deals: { deal_id: string; deal_name: string; stage_name: string; revenue: number; days_in_stage: number }[];
  service_revenue: { service_name: string; revenue: number; deal_count: number }[];
  account_type_pipeline: { account_type: string; deal_count: number; total_value: number }[];
  lead_source: { lead_source: string; total_deals: number; won_deals: number; won_revenue: number }[];
  follow_up: { total_open: number; overdue_action_plans: number; overdue_follow_ups: number; upcoming_action_plans: number };
}

export interface AnalyticsExecDashboard {
  team: {
    total_revenue: number;
    total_quota: number;
    sales_forecast: number;
    attainment_pct: number;
  };
  leaderboard: {
    bd_id: string;
    first_name: string;
    last_name: string;
    role: string;
    revenue: number;
    quota: number;
    attainment_pct: number;
    win_rate: number;
    rank: number;
  }[];
  stuck_deals: {
    deal_id: string;
    deal_name: string;
    stage_name: string;
    days_in_stage: number;
    stage_duration_threshold: number;
    first_name: string;
    last_name: string;
  }[];
  pipeline_by_stage: { stage_name: string; deal_count: number; total_value: number }[];
  by_account_type: { account_type: string; deal_count: number; revenue: number }[];
  by_service: { service_name: string; deal_count: number; revenue: number }[];
}

// ── API calls ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  /**
   * GET /api/analytics/dashboard/bd
   * BD_REP: only own bd_id. SALES_MANAGER: any bd_id.
   */
  bdDashboard: (bdId: string, year: number, quarter: number) =>
    analyticsClient.get<AnalyticsBDDashboard>('/api/analytics/dashboard/bd', {
      params: { bd_id: bdId, year, quarter },
    }),

  /**
   * GET /api/analytics/dashboard/executive
   * SALES_MANAGER only.
   */
  executiveDashboard: (year: number, quarter: number) =>
    analyticsClient.get<AnalyticsExecDashboard>('/api/analytics/dashboard/executive', {
      params: { year, quarter },
    }),
};

export default analyticsClient;
// ── Reports API ────────────────────────────────────────────────────────────

export interface PipelineReport {
  report: string;
  period: string;
  bd_id: string | null;
  stages: { stage_name: string; deal_count: number; total_value: number; pct_of_total: number }[];
  total_deals: number;
  total_pipeline_value: number;
  stage_totals: { stage_name: string; deal_count: number; total_value: number }[];
  by_bd: { stage_name: string; bd_name: string; bd_id: string; deal_count: number; total_value: number }[];
  by_service: { stage_name: string; service_name: string; deal_count: number; total_value: number }[];
  by_account_type: { stage_name: string; account_type: string; deal_count: number; total_value: number }[];
  lead_source: { lead_source: string; deal_count: number; total_value: number }[];
}

export interface GrowthSeries {
  year: number;
  granularity: string;
  bd_id: string | null;
  series: { period_label: string; period_order: number; revenue: number }[];
}

export interface BDOption {
  id: string;
  full_name: string;
  role: string;
}

export const reportsAnalyticsApi = {
  bds: () =>
    analyticsClient.get<BDOption[]>('/api/analytics/reports/bds'),

  pipeline: (params: { year: number; quarter: number; bd_id?: string }) =>
    analyticsClient.get<PipelineReport>('/api/analytics/reports/pipeline', { params }),

  quota: (params: { year: number; quarter: number }) =>
    analyticsClient.get('/api/analytics/reports/quota', { params }),

  growth: (params: { year: number; granularity: 'month' | 'quarter' | 'year'; bd_id?: string }) =>
    analyticsClient.get<GrowthSeries>('/api/analytics/reports/growth', { params }),

  salesCycle: (params: { year: number; quarter: number }) =>
    analyticsClient.get('/api/analytics/reports/sales-cycle', { params }),

  winRate: (params: { year: number; quarter: number }) =>
    analyticsClient.get('/api/analytics/reports/win-rate', { params }),
};