import apiClient from './client'
import type { Service } from '../types'

function mapServiceToFrontend(service: any): Service {
  return {
    id: service.id,
    name: service.name,
    description: service.description ?? undefined,
    is_active: service.isActive ?? service.is_active ?? false,
  }
}

export const servicesApi = {
  list: async (): Promise<{ data: Service[] }> => {
    const res = await apiClient.get<any[]>('/api/services')
    return { ...res, data: res.data.map(mapServiceToFrontend) }
  },

  create: (data: { name: string; description?: string }) =>
    apiClient.post<any>('/api/services', data),

  update: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    apiClient.patch<any>(`/api/services/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean; id: string }>(`/api/services/${id}`),
}
