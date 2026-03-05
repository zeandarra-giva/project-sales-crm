import { Bell, CheckCheck } from 'lucide-react';
import type { Notification } from '../../types';
import { Button } from '../ui/index';
import { cn } from '../../lib/utils';

const TYPE_COLORS: Record<string, string> = {
  StageChange:      '#3d5af1',
  DealStuck:        '#d97706',
  ActionPlanDue:    '#e11d48',
  QuotaAlert:       '#7c3aed',
  FollowUpDue:      '#0891b2',
  NewDealAssigned:  '#059669',
  LostDealFollowUp: '#e11d48',
};

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationList({ notifications, onMarkRead, onMarkAllRead }: NotificationListProps) {
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col gap-2">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
            <CheckCheck size={13} /> Mark all read
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={28} className="text-[#c8cfe8] mx-auto mb-3" />
          <p className="text-sm text-[#8b90a8]">No notifications yet</p>
        </div>
      ) : (
        notifications.map(n => {
          const color = TYPE_COLORS[n.type] ?? '#8b90a8';
          return (
            <button
              key={n.id}
              onClick={() => onMarkRead(n.id)}
              className={cn(
                'w-full text-left p-4 rounded-2xl border transition-all hover:border-[#c7d0fb]',
                n.is_read
                  ? 'bg-white border-[#e2e6f0]'
                  : 'bg-[#fafbff] border-[#eef1fe] shadow-sm'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: n.is_read ? '#e2e6f0' : color }} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs leading-relaxed', n.is_read ? 'text-[#4a5068]' : 'text-[#1a1d2e] font-medium')}>
                    {n.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${color}15`, color }}>
                      {n.type.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-[10px] text-[#8b90a8]">
                      {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
