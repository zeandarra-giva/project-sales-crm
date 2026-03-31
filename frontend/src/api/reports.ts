import analyticsClient from './analyticsClient';

export interface ReportParams {
  year: number;
  quarter: number;
  format?: 'json' | 'xlsx';
  bd_id?: string;
}

export const reportsApi = {
  pipeline: (params: ReportParams) =>
    analyticsClient.get('/api/analytics/reports/pipeline', { params }),

  quota: (params: ReportParams) =>
    analyticsClient.get('/api/analytics/reports/quota', { params }),

  lossAnalysis: (params: ReportParams) =>
    analyticsClient.get('/api/analytics/reports/loss-analysis', { params }),

  salesCycle: (params: ReportParams) =>
    analyticsClient.get('/api/analytics/reports/sales-cycle', { params }),

  winRate: (params: ReportParams) =>
    analyticsClient.get('/api/analytics/reports/win-rate', { params }),

  // Analytics dashboard endpoints
  bdDashboard: (params: { year: number; quarter: number; bd_id: string }) =>
    analyticsClient.get('/api/analytics/dashboard/bd', { params }),

  executiveDashboard: (params: { year: number; quarter: number }) =>
    analyticsClient.get('/api/analytics/dashboard/executive', { params }),

  // Team
  listBDs: () =>
    analyticsClient.get('/api/analytics/team/bds'),

  // Excel export — returns a blob
  exportExcel: (report: string, params: ReportParams) =>
    analyticsClient.get(`/api/analytics/reports/${report}`, {
      params: { ...params, format: 'xlsx' },
      responseType: 'blob',
    }),
};
