import Header from '../components/layout/Header';
import { NotificationList } from '../components/notifications/index';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications();

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Notifications"
        subtitle={isLoading ? 'Loading…' : `${unreadCount} unread`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="text-center py-16 text-sm text-[#8b90a8]">Loading notifications…</div>
          ) : (
            <NotificationList
              notifications={notifications}
              onRead={markRead}
              onReadAll={markAllRead}
            />
          )}
        </div>
      </div>
    </div>
  );
}
