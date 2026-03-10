import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import type { BDDashboard, ExecutiveDashboard } from '../types';

export function useBDDashboard(year?: number, quarter?: number) {
  const params: Record<string, string> = {};
  if (year) params.year = String(year);
  if (quarter) params.quarter = String(quarter);

  return useQuery({
    queryKey: ['dashboard-bd', year, quarter],
    queryFn: async () => {
      const res = await dashboardApi.bd(year && quarter ? `Q${quarter} ${year}` : undefined);
      return res.data as unknown as {
        period: { year: number; quarter: number; start: string; end: string };
        metrics: {
          deals_closed_won: number;
          open_deals: number;
          actual_revenue: number;
          quota: number;
          quota_attainment_pct: number;
          sales_forecast: number;
          sales_variance: number;
          monthly_quota: number;
          monthly_actual: number;
          monthly_excess_deficit: number;
          quarterly_excess_deficit: number;
        };
        pipeline_by_stage: Array<{ stage_id: string; stage_name?: string; _count: { id: number }; _sum: { revenue: number } }>;
        stuck_deals: BDDashboard['stuck_deals'];
        revenue_trend: Array<{ revenue: number; closed_date: string }>;
        monthly_forecast: Array<{ month: string; actual: number; negotiation: number }>;
      };
    },
  });
}

export function useExecutiveDashboard(year?: number, quarter?: number) {
  return useQuery({
    queryKey: ['dashboard-executive', year, quarter],
    queryFn: async () => {
      const res = await dashboardApi.executive(year && quarter ? `Q${quarter} ${year}` : undefined);
      return res.data as unknown as {
        period: { year: number; quarter: number };
        team: {
          total_revenue: number;
          total_quota: number;
          attainment_pct: number;
          sales_forecast: number;
          weighted_forecast: number;
        };
        leaderboard: Array<{
          bd: { id: string; first_name: string; last_name: string; role: string };
          revenue: number;
          quota: number;
          attainment_pct: number;
          deals_won: number;
          win_rate: number;
        }>;
        pipeline_by_stage: Array<{ stage_id: string; stage_name: string; _count: { id: number }; _sum: { revenue: number } }>;
        stuck_deals: Array<{
          id: string;
          deal_name: string;
          days_in_stage: number;
          stage: { name: string };
          bd: { first_name: string; last_name: string };
          client: { name: string };
        }>;
        by_account_type: Array<{ account_type: string; count: number; revenue: number }>;
        by_service: Array<{ service: string; count: number; revenue: number }>;
      };
    },
  });
}