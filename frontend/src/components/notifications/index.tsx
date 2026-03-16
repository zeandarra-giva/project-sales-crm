import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, TrendingUp, Calendar, UserPlus, CheckCircle, RefreshCw, ChevronDown, Building2, User, ArrowRight } from 'lucide-react';
import type { Notification, NotificationType } from '../../types/index';
import { formatRelativeDate, formatDate, getStageColor, cn } from '../../lib/utils';
import type { PipelineStage } from '../../types';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; label: string }> = {
  STAGE_CHANGE: { icon: <TrendingUp size={14} />, color: '#4f6ef7', label: 'Stage Update' },
  DEAL_STUCK: { icon: <AlertTriangle size={14} />, color: '#f59e0b', label: 'Deal Stuck' },
  ACTION_PLAN_DUE: { icon: <Calendar size={14} />, color: '#f43f5e', label: 'Action Plan Due' },
  QUOTA_ALERT: { icon: <TrendingUp size={14} />, color: '#f43f5e', label: 'Quota Alert' },
  FOLLOW_UP_DUE: { icon: <RefreshCw size={14} />, color: '#8b5cf6', label: 'Follow-Up Due' },
  NEW_DEAL_ASSIGNED: { icon: <UserPlus size={14} />, color: '#10b981', label: 'New Deal' },
  LOST_DEAL_FOLLOW_UP: { icon: <RefreshCw size={14} />, color: '#06b6d4', label: 'Re-engage' },
};

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const config = TYPE_CONFIG[notification.type] ?? { icon: <Bell size={14} />, color: '#4a5068', label: notification.type };

  const d = (notification as any).deal as any;
  const client = d?.client;
  const bd = d?.bd;
  const auditLogs: any[] = d?.audit_logs ?? d?.auditLogs ?? [];
  const hasDetail = !!(client || bd || auditLogs.length);
  const dealId = d?.id ?? notification.deal_id;

  function handleClick() {
    if (!notification.is_read) onRead?.(notification.id);
    if (hasDetail) {
      setExpanded(o => !o);
    }
  }

  function handleViewDeal(e: React.MouseEvent) {
    e.stopPropagation();
    if (dealId) navigate(`/deals/${dealId}`);
  }

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-150',
      notification.is_read ? 'bg-transparent border-transparent opacity-70 hover:opacity-100' : 'bg-white border-[#e2e6f0] hover:border-[#c8cfe8]'
    )}>
      {/* Header row */}
      <div className="flex gap-3 p-3 cursor-pointer" onClick={handleClick}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${config.color}18`, color: config.color }}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: config.color }}>
              {config.label}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!notification.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#3d5af1]" />}
              <span className="text-[10px] text-[#4a5068] whitespace-nowrap">
                {formatRelativeDate(notification.created_at)}
              </span>
              {hasDetail && (
                <ChevronDown size={12} className={cn('text-[#8b90a8] transition-transform', expanded && 'rotate-180')} />
              )}
            </div>
          </div>
          <p className="text-xs text-[#4a5068] mt-1 leading-relaxed">{notification.content}</p>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-3 pb-3 border-t border-[#f0f2f8] pt-2.5 flex flex-col gap-2.5">

          {/* Client + BD */}
          {(client || bd) && (
            <div className="flex items-center gap-3 flex-wrap">
              {client && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-[#eef1fe] flex items-center justify-center flex-shrink-0">
                    <Building2 size={10} className="text-[#3d5af1]" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#1a1d2e]">{client.name}</div>
                    <div className="text-[9px] text-[#8b90a8] uppercase tracking-wider">{client.account_type ?? client.accountType}</div>
                  </div>
                </div>
              )}
              {client && bd && <div className="w-px h-6 bg-[#e2e6f0]" />}
              {bd && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-[#f0fdf4] flex items-center justify-center flex-shrink-0">
                    <User size={10} className="text-[#059669]" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#1a1d2e]">
                      {bd.first_name ?? bd.firstName} {bd.last_name ?? bd.lastName}
                    </div>
                    <div className="text-[9px] text-[#8b90a8] uppercase tracking-wider">{bd.role}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage history — compact */}
          {auditLogs.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold text-[#8b90a8] uppercase tracking-wider mb-1.5">Stage History</div>
              <div className="flex flex-col gap-1">
                {auditLogs.map((log: any, i: number) => {
                  const stageName = log.stage?.name ?? log.stage_name ?? '—';
                  const isCurrent = !log.exited_at;
                  const color = getStageColor(stageName as PipelineStage);
                  const isLast = i === auditLogs.length - 1;
                  return (
                    <div key={log.id ?? i} className="flex gap-2">
                      <div className="flex flex-col items-center flex-shrink-0 w-3 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: isCurrent ? color : '#c8cfe8' }} />
                        {!isLast && <div className="w-px flex-1 bg-[#e2e6f0] my-0.5 min-h-[8px]" />}
                      </div>
                      <div className={cn('flex-1 min-w-0', isLast ? '' : 'pb-1')}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-[#1a1d2e]">{stageName}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#eef1fe] text-[#3d5af1]">NOW</span>
                            )}
                          </div>
                          <span className="text-[9px] text-[#8b90a8] flex-shrink-0 whitespace-nowrap">
                            {log.entered_at ? formatDate(log.entered_at) : ''}
                            {log.exited_at && (
                              <><ArrowRight size={8} className="inline mx-0.5" />{formatDate(log.exited_at)}</>
                            )}
                          </span>
                        </div>
                        {/* Remarks — single line truncated */}
                        {log.remarks && (
                          <p className="text-[10px] text-[#4a5068] truncate mt-0.5" title={log.remarks}>
                            {log.remarks}
                          </p>
                        )}
                        {/* Action plan due */}
                        {log.action_plan_due_date && isCurrent && (
                          <p className={cn(
                            'text-[9px] mt-0.5',
                            new Date(log.action_plan_due_date) < new Date() ? 'text-[#e11d48]' : 'text-[#8b90a8]'
                          )}>
                            Plan due: {formatDate(log.action_plan_due_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* View deal link */}
          {dealId && (
            <button onClick={handleViewDeal}
              className="self-start text-[10px] font-medium text-[#3d5af1] hover:underline mt-0.5">
              View full deal →
            </button>
          )}
        </div>
      )}
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