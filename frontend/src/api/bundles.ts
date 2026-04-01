import apiClient from './client'
import type { Bundle } from '../types'

function mapBundleToFrontend(b: any): Bundle {
  return {
    id: b.id,
    name: b.name,
    services: (b.bundleServices ?? []).map((bs: any) => ({
      service_id: bs.serviceId ?? bs.service_id,
      bundle_id:  bs.bundleId  ?? bs.bundle_id,
      name:       bs.name,
      service_value:    Number(bs.serviceValue   ?? bs.service_value   ?? 0),
      revenue_share_pct: Number(bs.revenueSharePct ?? bs.revenue_share_pct ?? 0),
      service: bs.service,
    })),
  }
}

export const bundlesApi = {
  list: async (): Promise<Bundle[]> => {
    const res = await apiClient.get<any[]>('/api/bundles')
    return res.data.map(mapBundleToFrontend)
  },

  create: async (data: { name: string }): Promise<Bundle> => {
    const res = await apiClient.post<any>('/api/bundles', data)
    return mapBundleToFrontend(res.data)
  },

  update: async (id: string, data: { name: string }): Promise<Bundle> => {
    const res = await apiClient.patch<any>(`/api/bundles/${id}`, data)
    return mapBundleToFrontend(res.data)
  },

  delete: (id: string) =>
    apiClient.delete<{ success: boolean; id: string }>(`/api/bundles/${id}`),

  addService: (bundleId: string, data: {
    serviceId: string
    name: string
    serviceValue: number
    revenueSharePct: number
  }) => apiClient.post<any>(`/api/bundles/${bundleId}/services`, data),

  removeService: (bundleId: string, serviceId: string) =>
    apiClient.delete<{ success: boolean }>(`/api/bundles/${bundleId}/services/${serviceId}`),
}
