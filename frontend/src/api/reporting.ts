import apiClient from './client'

export interface ReportingPeriodsResponse {
  currentYear: number
  years: number[]
  quarters: number[]
}

export interface GrowthEntry {
  id: string
  label: string
  year: number
  quarter?: number | null
  revenue: number
  notes?: string | null
  owner: {
    id: string
    firstName: string
    lastName: string
  }
  createdAt: string
  updatedAt: string
}

export interface GrowthComparison {
  label: string
  leftRevenue: number
  rightRevenue: number
  delta: number
  growthPct: number | null
}

export interface GrowthEntriesResponse {
  entries: GrowthEntry[]
  comparison: GrowthComparison[]
}

export interface GrowthEntryPayload {
  label: string
  year: number
  quarter?: number | null
  revenue: number
  notes?: string
}

export const reportingApi = {
  periods: async () => {
    const res = await apiClient.get<ReportingPeriodsResponse>('/api/reporting/periods')
    return res.data
  },
  growthEntries: async (params: {
    year: number
    quarter?: number | null
    compareYear?: number
    compareQuarter?: number | null
  }) => {
    const res = await apiClient.get<GrowthEntriesResponse>('/api/growth-entries', {
      params: {
        year: params.year,
        ...(params.quarter ? { quarter: params.quarter } : {}),
        ...(params.compareYear ? { compareYear: params.compareYear } : {}),
        ...(params.compareQuarter ? { compareQuarter: params.compareQuarter } : {}),
      },
    })
    return res.data
  },
  createGrowthEntry: async (payload: GrowthEntryPayload) => {
    const res = await apiClient.post<GrowthEntry>('/api/growth-entries', payload)
    return res.data
  },
  updateGrowthEntry: async (id: string, payload: Partial<GrowthEntryPayload>) => {
    const res = await apiClient.patch<GrowthEntry>(`/api/growth-entries/${id}`, payload)
    return res.data
  },
}
