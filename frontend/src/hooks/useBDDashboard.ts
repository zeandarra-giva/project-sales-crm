/**
 * useBDDashboard — fetches BD dashboard data from Andre's analytics service.
 * Falls back gracefully while loading or on error.
 */

import { useState, useEffect, useCallback } from 'react';
import { analyticsApi, type AnalyticsBDDashboard } from '../api/analyticsClient';
import { useAuthStore } from '../store/authStore';

// Derive year + quarter from the selected quarter string e.g. "Q1 2026"
function parseQuarter(q: string): { year: number; quarter: number } {
  const match = q.match(/Q(\d)\s+(\d{4})/);
  if (!match) return { year: new Date().getFullYear(), quarter: 1 };
  return { year: parseInt(match[2]), quarter: parseInt(match[1]) };
}

export interface UseBDDashboardResult {
  data: AnalyticsBDDashboard | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBDDashboard(selectedQuarter: string): UseBDDashboardResult {
  const { user } = useAuthStore();
  const [data, setData] = useState<AnalyticsBDDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { year, quarter } = parseQuarter(selectedQuarter);
      const res = await analyticsApi.bdDashboard(user.id, year, quarter);
      setData(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        'Failed to load dashboard data';
      setError(msg);
      console.error('[useBDDashboard]', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedQuarter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}