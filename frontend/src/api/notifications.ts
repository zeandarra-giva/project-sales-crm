import apiClient from './client';
import type { Notification } from '../types';

export interface NotificationsListResponse {
  notifications: Notification[]
  unreadCount: number
}

export const notificationsApi = {
  list:        ()           => apiClient.get<NotificationsListResponse>('/notifications'),
  markRead:    (id: string) => apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`),
  markAllRead: ()           => apiClient.post<{ success: boolean; updated: number }>('/notifications/read-all'),
};
