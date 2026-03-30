import analyticsClient from './analyticsClient';

export interface PipelineReportParams {
  year: number;
  quarter: number;
  format?: 'json' | 'xlsx';
}

export const reportsApi = {
  pipeline: (params: PipelineReportParams) =>
    analyticsClient.get('/api/analytics/reports/pipeline', { params }),

  quota: (params: PipelineReportParams) =>
    analyticsClient.get('/api/analytics/reports/quota', { params }),

  lossAnalysis: (params: PipelineReportParams) =>
    analyticsClient.get('/api/analytics/reports/loss-analysis', { params }),

  salesCycle: (params: PipelineReportParams) =>
    analyticsClient.get('/api/analytics/reports/sales-cycle', { params }),

  winRate: (params: PipelineReportParams) =>
    analyticsClient.get('/api/analytics/reports/win-rate', { params }),

  // Analytics dashboard endpoints
  bdDashboard: (params: { year: number; quarter: number; bd_id: string }) =>
    analyticsClient.get('/api/analytics/dashboard/bd', { params }),

  executiveDashboard: (params: { year: number; quarter: number }) =>
    analyticsClient.get('/api/analytics/dashboard/executive', { params }),

  // Excel export — returns a blob
  exportExcel: (report: string, params: PipelineReportParams) =>
    analyticsClient.get(`/api/analytics/reports/${report}`, {
      params: { ...params, format: 'xlsx' },
      responseType: 'blob',
    }),
};
