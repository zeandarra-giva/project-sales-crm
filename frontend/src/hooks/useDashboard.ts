import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import type { AnalyticsBDData } from '../pages/BDDashboard';
import type { ExecData } from '../pages/ExecutiveDashboard';

type QuarterSelection = number | 'ALL'

function combineByKey<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
  numericKeys: (keyof T)[]
) {
  const map = new Map<string, T>()

  for (const row of rows) {
    const id = String(row[key])
    const existing = map.get(id)
    if (!existing) {
      map.set(id, { ...row })
      continue
    }

    for (const numericKey of numericKeys) {
      ;(existing as Record<string, any>)[String(numericKey)] =
        Number(existing[numericKey] || 0) + Number(row[numericKey] || 0)
    }
  }

  return Array.from(map.values())
}

function aggregateBDYear(quarters: AnalyticsBDData[]): AnalyticsBDData {
  const snapshot = quarters[0]
  const totalRevenue = quarters.reduce((sum, quarter) => sum + Number(quarter.total_revenue || 0), 0)
  const totalQuota = quarters.reduce((sum, quarter) => sum + Number(quarter.quota || 0), 0)
  const negotiationSnapshot = Number(snapshot.sales_forecast || 0) - Number(snapshot.total_revenue || 0)
  const annualVariance = totalRevenue - totalQuota

  return {
    ...snapshot,
    total_revenue: totalRevenue,
    quota: totalQuota,
    monthly_quota: quarters.reduce((sum, quarter) => sum + Number(quarter.monthly_quota || 0), 0),
    sales_forecast: totalRevenue + negotiationSnapshot,
    variance: annualVariance,
    monthly_variance: annualVariance,
    attainment_pct: totalQuota > 0 ? Number(((totalRevenue / totalQuota) * 100).toFixed(1)) : 0,
    excess_deficit: annualVariance >= 0 ? 'Excess' : 'Deficit',
    monthly_excess_deficit: annualVariance >= 0 ? 'Excess' : 'Deficit',
    revenue_by_month: quarters.flatMap((quarter) => quarter.revenue_by_month || []).sort((a, b) => a.month - b.month),
    service_revenue: combineByKey(
      quarters.flatMap((quarter) => quarter.service_revenue || []),
      'service_name',
      ['revenue', 'deal_count']
    ).sort((a, b) => b.revenue - a.revenue),
    lead_source: combineByKey(
      quarters.flatMap((quarter) => quarter.lead_source || []),
      'lead_source',
      ['total_deals', 'won_deals', 'won_revenue']
    ).sort((a, b) => b.won_revenue - a.won_revenue),
  }
}

function aggregateExecutiveYear(quarters: ExecData[]): ExecData {
  const snapshot = quarters[0]
  const totalRevenue = quarters.reduce((sum, quarter) => sum + Number(quarter.team?.total_revenue || 0), 0)
  const totalQuota = quarters.reduce((sum, quarter) => sum + Number(quarter.team?.total_quota || 0), 0)
  const negotiationSnapshot = Number(snapshot.team?.sales_forecast || 0) - Number(snapshot.team?.total_revenue || 0)
  const leaderboard = combineByKey(
    quarters.flatMap((quarter) => quarter.leaderboard || []),
    'bd_id',
    ['revenue', 'quota']
  )
    .map((entry) => ({
      ...entry,
      attainment_pct: Number(entry.quota) > 0 ? Number(((Number(entry.revenue) / Number(entry.quota)) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  return {
    ...snapshot,
    team: {
      total_revenue: totalRevenue,
      total_quota: totalQuota,
      sales_forecast: totalRevenue + negotiationSnapshot,
      attainment_pct: totalQuota > 0 ? Number(((totalRevenue / totalQuota) * 100).toFixed(1)) : 0,
    },
    leaderboard,
    by_account_type: combineByKey(
      quarters.flatMap((quarter) => quarter.by_account_type || []),
      'account_type',
      ['deal_count', 'revenue']
    ).sort((a, b) => b.revenue - a.revenue),
    by_service: combineByKey(
      quarters.flatMap((quarter) => quarter.by_service || []),
      'service_name',
      ['deal_count', 'revenue']
    ).sort((a, b) => b.revenue - a.revenue),
  }
}

export function useBDDashboard(quarter: QuarterSelection, year: number, bdId?: string) {
  return useQuery({
    queryKey: ['bd-dashboard', quarter, year, bdId],
    queryFn: async () => {
      if (quarter === 'ALL') {
        const responses = await Promise.all(
          [1, 2, 3, 4].map((q) => reportsApi.bdDashboard({ quarter: q, year, bd_id: bdId || '' }))
        )
        return aggregateBDYear(responses.map((response) => response.data as AnalyticsBDData))
      }

      const res = await reportsApi.bdDashboard({ quarter, year, bd_id: bdId || '' });
      return res.data as AnalyticsBDData;
    },
    staleTime: 30_000, // cache for 30s
  });
}

export function useExecutiveDashboard(quarter: QuarterSelection, year: number) {
  return useQuery({
    queryKey: ['executive-dashboard', quarter, year],
    queryFn: async () => {
      if (quarter === 'ALL') {
        const responses = await Promise.all(
          [1, 2, 3, 4].map((q) => reportsApi.executiveDashboard({ quarter: q, year }))
        )
        return aggregateExecutiveYear(responses.map((response) => response.data as ExecData))
      }

      const res = await reportsApi.executiveDashboard({ quarter, year });
      return res.data as ExecData;
    },
    staleTime: 30_000,
  });
} 
