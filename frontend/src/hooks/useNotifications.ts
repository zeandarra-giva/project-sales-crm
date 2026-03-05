import { useState, useCallback } from 'react';
import { MOCK_NOTIFICATIONS } from '../mockData';
import type { Notification } from '../types';

export function useNotifications(bdId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const filtered = bdId
    ? notifications.filter(n => n.bd_id === bdId)
    : notifications;

  const unreadCount = filtered.filter(n => !n.is_read).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  return { notifications: filtered, unreadCount, markRead, markAllRead };
}
