import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import type { AnalyticsBDData } from '../pages/BDDashboard';
import type { ExecData } from '../pages/ExecutiveDashboard';

export function useBDDashboard(quarter: number, year: number, bdId?: string) {
  return useQuery({
    queryKey: ['bd-dashboard', quarter, year, bdId],
    queryFn: async () => {
      const res = await reportsApi.bdDashboard({ quarter, year, bd_id: bdId || '' });
      return res.data as AnalyticsBDData;
    },
    staleTime: 30_000, // cache for 30s
  });
}

export function useExecutiveDashboard(quarter: number, year: number) {
  return useQuery({
    queryKey: ['executive-dashboard', quarter, year],
    queryFn: async () => {
      const res = await reportsApi.executiveDashboard({ quarter, year });
      return res.data as ExecData;
    },
    staleTime: 30_000,
  });
} 
