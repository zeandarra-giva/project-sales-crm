import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi, CreateContactPayload } from '../api/contacts'

export function useContacts() {
    return useQuery({
        queryKey: ['contacts'],
        queryFn: async () => (await contactsApi.list()).data,
    })
}

export function useCreateContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateContactPayload) => (await contactsApi.create(data)).data,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['contacts'] })
            qc.invalidateQueries({ queryKey: ['clients'] })  // client's contact list changed
        },
    })
}

export function useUpdateContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateContactPayload> }) =>
            (await contactsApi.update(id, data)).data,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['contacts'] })
            qc.invalidateQueries({ queryKey: ['clients'] })
        },
    })
}