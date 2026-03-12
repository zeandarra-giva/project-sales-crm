import apiClient from './client';
import type { Notification } from '../types';

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/notifications'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};
