import { useState } from 'react';
import Header from '../components/layout/Header';
import { NotificationList } from '../components/notifications/index';
import { MOCK_NOTIFICATIONS } from '../mockData';
import type { Notification } from '../types/index';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const handleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleReadAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Notifications"
        subtitle={`${notifications.filter(n => !n.is_read).length} unread`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <NotificationList
            notifications={notifications}
            onRead={handleRead}
            onReadAll={handleReadAll}
          />
        </div>
      </div>
    </div>
  );
}
