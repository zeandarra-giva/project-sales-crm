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

export interface GrowthComparisonSelection {
  years: number[]
  quarters: number[]
}

export interface GrowthSnapshotItem {
  name: string
  value: number
  deals: number
}

export interface GrowthLeadSourceItem {
  source: string
  value: number
  deals: number
  wins: number
  losses: number
  winRate: number
}

export interface GrowthStageCycleItem {
  stage: string
  avgDays: number
}

export interface GrowthComparisonSnapshot {
  label: string
  periods: Array<{ year: number; quarter: number }>
  quota: number
  actual: number
  attainmentPct: number
  pipelineValue: number
  openDeals: number
  wins: number
  losses: number
  winRate: number
  avgSalesCycleDays: number | null
  longestCycleDays: number | null
  sampleSize: number
  lostDeals: number
  lostValue: number
  serviceRevenue: GrowthSnapshotItem[]
  accountRevenue: GrowthSnapshotItem[]
  leadSourcePerformance: GrowthLeadSourceItem[]
  stageCycle: GrowthStageCycleItem[]
}

export interface GrowthComparisonResponse {
  left: GrowthComparisonSnapshot
  right: GrowthComparisonSnapshot
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
  growthComparison: async (params: {
    left: GrowthComparisonSelection
    right: GrowthComparisonSelection
    bdId?: string
  }) => {
    const res = await apiClient.get<GrowthComparisonResponse>('/api/reporting/growth-comparison', {
      params: {
        leftYears: params.left.years.join(','),
        leftQuarters: params.left.quarters.join(','),
        rightYears: params.right.years.join(','),
        rightQuarters: params.right.quarters.join(','),
        ...(params.bdId ? { bdId: params.bdId } : {}),
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
