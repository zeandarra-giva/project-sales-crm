import apiClient from './client'

export interface QuarterlyTargetRow {
  id: string | null
  bdId: string
  bdName: string
  role: string
  quota: number
}

export interface QuarterlyTargetsResponse {
  year: number
  quarter: number
  targets: QuarterlyTargetRow[]
}

export const targetsApi = {
  listQuarterly: (params: { year: number; quarter: number }) =>
    apiClient.get<QuarterlyTargetsResponse>('/api/targets/quarterly', { params }),

  saveQuarterly: (data: { year: number; quarter: number; targets: Array<{ id?: string; bdId: string; quota: number }> }) =>
    apiClient.put<QuarterlyTargetsResponse>('/api/targets/quarterly', data),
}
