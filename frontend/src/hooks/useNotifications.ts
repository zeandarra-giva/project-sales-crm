import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import type { Notification } from '../types';

export function useNotifications() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationsApi.list();
      const body = res.data as unknown as { notifications: Notification[]; unread_count: number };
      return body;
    },
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? notifications.filter(n => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    // Optimistically flip is_read in the cache — avoids refetch that collapses expanded cards
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData(['notifications']);
      qc.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
          unread_count: Math.max(0, (old.unread_count ?? 0) - 1),
        };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      // Roll back on failure
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev);
    },
    onSettled: () => {
      // Background sync after a delay so the UI doesn't jump
      setTimeout(() => qc.invalidateQueries({ queryKey: ['notifications'] }), 2000);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}