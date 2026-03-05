import { useMemo } from 'react';
import { MOCK_DEALS, MOCK_BDS } from '../mockData';
import type { BD } from '../types';

const QUARTERLY_QUOTA = 7_000_000;

export function useDashboard(bd?: BD | null) {
  return useMemo(() => {
    const myDeals = bd ? MOCK_DEALS.filter(d => d.bd_id === bd.id) : MOCK_DEALS;
    const closedWon = myDeals.filter(d => d.stage === 'Closed Won');
    const open = myDeals.filter(d => !d.is_closed);
    const stuck = myDeals.filter(d => !d.is_closed && (d.days_in_stage ?? 0) > 3);

    const actual = closedWon.reduce((s, d) => s + d.revenue, 0);
    const forecast = open.reduce((s, d) => s + d.revenue * (d.probability_pct ?? 0) / 100, 0);
    const quota = QUARTERLY_QUOTA;
    const attainmentPct = quota > 0 ? Math.round((actual / quota) * 100) : 0;
    const variance = actual - quota;

    const bdPerformance = MOCK_BDS.filter(b => b.role !== 'Manager').map(b => {
      const bDeals = MOCK_DEALS.filter(d => d.bd_id === b.id);
      const bClosed = bDeals.filter(d => d.stage === 'Closed Won');
      const bOpen = bDeals.filter(d => !d.is_closed);
      const bActual = bClosed.reduce((s, d) => s + d.revenue, 0);
      const bForecast = bOpen.reduce((s, d) => s + d.revenue * (d.probability_pct ?? 0) / 100, 0);
      return {
        bd: b,
        quota: QUARTERLY_QUOTA,
        actual: bActual,
        forecast: bForecast,
        variance: bActual - QUARTERLY_QUOTA,
        attainment_pct: Math.round((bActual / QUARTERLY_QUOTA) * 100),
        win_rate: bDeals.length > 0 ? Math.round((bClosed.length / bDeals.length) * 100) : 0,
        open_deals: bOpen.length,
        closed_deals: bClosed.length,
      };
    });

    return { myDeals, closedWon, open, stuck, actual, forecast, quota, attainmentPct, variance, bdPerformance };
  }, [bd]);
}
