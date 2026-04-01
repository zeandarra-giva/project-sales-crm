import { useQuery } from '@tanstack/react-query'
import { servicesApi } from '../api/services'

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await servicesApi.list()
      return res.data
    },
    staleTime: Infinity,
  })
}
