import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import type { Notification } from '../types';

/**
 * Hook for notification state — backed by real API.
 * Backend returns { notifications: [], unreadCount: number }.
 * The optional bdId param is kept for call-site compatibility but filtering
 * happens server-side (the backend already scopes to the authed user's JWT).
 */
export function useNotifications(_bdId?: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationsApi.list();
      return res.data; // { notifications: Notification[], unreadCount: number }
    },
    refetchInterval: 30_000, // poll every 30s for new notifications
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount: number           = data?.unreadCount ?? 0;

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead:    (id: string) => markReadMutation.mutate(id),
    markAllRead: ()           => markAllReadMutation.mutate(),
  };
}
