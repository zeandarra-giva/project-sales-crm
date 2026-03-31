import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';

export function useBDList() {
  return useQuery({
    queryKey: ['bd-list'],
    queryFn: async () => {
      const res = await reportsApi.listBDs();
      return res.data.bds || [];
    },
    staleTime: 60_000,
  });
}

export function useReportData(tab: string, year: number, quarter: number, bdId: string) {
  return useQuery({
    queryKey: ['report', tab, year, quarter, bdId],
    enabled: tab !== 'Growth Table',
    queryFn: async () => {
      const params: any = { year, quarter };
      if (bdId) params.bd_id = bdId;

      switch (tab) {
        case 'Pipeline': return (await reportsApi.pipeline(params)).data;
        case 'Quota Performance': return (await reportsApi.quota(params)).data;
        case 'Win/Loss': return (await reportsApi.winRate(params)).data;
        case 'Sales Cycle': return (await reportsApi.salesCycle(params)).data;
        case 'Loss Analysis': return (await reportsApi.lossAnalysis(params)).data;
        case 'Executive': return (await reportsApi.executiveDashboard({ year, quarter })).data;
        default: return null;
      }
    },
    staleTime: 30_000,
  });
}
