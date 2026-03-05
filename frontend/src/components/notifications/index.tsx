import { Bell, AlertTriangle, TrendingUp, Calendar, UserPlus, CheckCircle, RefreshCw } from 'lucide-react';
import type { Notification, NotificationType } from '../../types/index';
import { formatRelativeDate, cn } from '../../lib/utils';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; label: string }> = {
  StageChange: { icon: <TrendingUp size={14} />, color: '#4f6ef7', label: 'Stage Update' },
  DealStuck: { icon: <AlertTriangle size={14} />, color: '#f59e0b', label: 'Deal Stuck' },
  ActionPlanDue: { icon: <Calendar size={14} />, color: '#f43f5e', label: 'Action Plan Due' },
  QuotaAlert: { icon: <TrendingUp size={14} />, color: '#f43f5e', label: 'Quota Alert' },
  FollowUpDue: { icon: <RefreshCw size={14} />, color: '#8b5cf6', label: 'Follow-Up Due' },
  NewDealAssigned: { icon: <UserPlus size={14} />, color: '#10b981', label: 'New Deal' },
  LostDealFollowUp: { icon: <RefreshCw size={14} />, color: '#06b6d4', label: 'Re-engage' },
};

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type];

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer',
        notification.is_read
          ? 'bg-transparent border-transparent opacity-60 hover:opacity-100'
          : 'bg-white border-[#e2e6f0] hover:border-[#c8cfe8]'
      )}
      onClick={() => onRead?.(notification.id)}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${config.color}18`, color: config.color }}
      >
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!notification.is_read && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d5af1]" />
            )}
            <span className="text-[10px] text-[#4a5068] whitespace-nowrap">
              {formatRelativeDate(notification.created_at)}
            </span>
          </div>
        </div>
        <p className="text-xs text-[#4a5068] mt-1 leading-relaxed">{notification.content}</p>
      </div>
    </div>
  );
}

interface NotificationListProps {
  notifications: Notification[];
  onRead?: (id: string) => void;
  onReadAll?: () => void;
  compact?: boolean;
}

export function NotificationList({ notifications, onRead, onReadAll, compact }: NotificationListProps) {
  const unread = notifications.filter(n => !n.is_read);
  const read = notifications.filter(n => n.is_read);

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <CheckCircle size={32} className="text-[#4a5068]" />
        <p className="text-sm text-[#4a5068]">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {unread.length > 0 && (
        <>
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-semibold text-[#4a5068] uppercase tracking-wider">Unread ({unread.length})</span>
            {onReadAll && (
              <button onClick={onReadAll} className="text-xs text-[#3d5af1] hover:text-[#3d5af1] transition-colors">
                Mark all read
              </button>
            )}
          </div>
          {unread.map(n => <NotificationItem key={n.id} notification={n} onRead={onRead} />)}
        </>
      )}
      {!compact && read.length > 0 && (
        <>
          <div className="px-1 mb-1 mt-3">
            <span className="text-xs font-semibold text-[#4a5068] uppercase tracking-wider">Earlier</span>
          </div>
          {read.map(n => <NotificationItem key={n.id} notification={n} onRead={onRead} />)}
        </>
      )}
    </div>
  );
}
