import { useState } from 'react';
import { Bell, CheckCheck, ChevronDown, User, Building2, Clock } from 'lucide-react';
import type { Notification } from '../../types';
import { Button } from '../ui/index';
import { cn, formatDate, getStageColor } from '../../lib/utils';
import type { PipelineStage } from '../../types';

const TYPE_COLORS: Record<string, string> = {
  STAGE_CHANGE: '#3d5af1',
  DEAL_STUCK: '#d97706',
  ACTION_PLAN_DUE: '#e11d48',
  QUOTA_ALERT: '#7c3aed',
  FOLLOW_UP_DUE: '#0891b2',
  NEW_DEAL_ASSIGNED: '#059669',
  LOST_DEAL_FOLLOW_UP: '#e11d48',
};

const TYPE_LABELS: Record<string, string> = {
  STAGE_CHANGE: 'Stage Change',
  DEAL_STUCK: 'Deal Stuck',
  ACTION_PLAN_DUE: 'Action Plan Due',
  QUOTA_ALERT: 'Quota Alert',
  FOLLOW_UP_DUE: 'Follow-up Due',
  NEW_DEAL_ASSIGNED: 'New Deal',
  LOST_DEAL_FOLLOW_UP: 'Lost Deal',
};

interface NotificationListProps {
  notifications: Notification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
}

function StageTimeline({ auditLogs }: { auditLogs: any[] }) {
  if (!auditLogs?.length) return null;
  return (
    <div className="flex flex-col">
      {auditLogs.map((log: any, i: number) => {
        const stageName = log.stage?.name ?? log.stage_name ?? '—';
        const isCurrent = !log.exited_at;
        const color = getStageColor(stageName as PipelineStage);
        const isLast = i === auditLogs.length - 1;
        const daysVal = log.days_in_stage != null ? `${log.days_in_stage}d` : isCurrent ? 'ongoing' : '—';

        return (
          <div key={log.id ?? i} className="flex gap-2.5">
            <div className="flex flex-col items-center flex-shrink-0 w-4">
              <div className="w-2 h-2 rounded-full border-2 border-white shadow-sm mt-1 flex-shrink-0"
                style={{ background: isCurrent ? color : '#c8cfe8' }} />
              {!isLast && <div className="w-px flex-1 bg-[#e2e6f0] my-1" />}
            </div>
            <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-3')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#1a1d2e]">{stageName}</span>
                    {isCurrent && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-[#eef1fe] text-[#3d5af1]">CURRENT</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#8b90a8] mt-0.5">
                    {log.entered_at ? formatDate(log.entered_at) : ''}
                    {log.exited_at ? ` → ${formatDate(log.exited_at)}` : log.entered_at ? ' → present' : ''}
                    {(log.changed_by?.first_name || log.changed_by?.firstName) && (
                      <span className="ml-1">
                        · {log.changed_by.first_name ?? log.changed_by.firstName} {log.changed_by.last_name ?? log.changed_by.lastName}
                      </span>
                    )}
                  </div>
                  {log.remarks && (
                    <div className="mt-1.5 text-[11px] text-[#4a5068] bg-white rounded-lg px-2.5 py-1.5 border border-[#e2e6f0]">
                      <span className="text-[9px] font-semibold text-[#8b90a8] uppercase tracking-wider block mb-0.5">Remarks</span>
                      {log.remarks}
                    </div>
                  )}
                  {log.action_plan && (
                    <div className="mt-1 text-[11px] text-[#4a5068] bg-[#f4faf7] rounded-lg px-2.5 py-1.5 border border-[#d1fae5]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-semibold text-[#059669] uppercase tracking-wider">Action Plan</span>
                        {log.action_plan_due_date && (
                          <span className={cn(
                            'text-[9px] font-medium flex items-center gap-0.5',
                            new Date(log.action_plan_due_date) < new Date() && isCurrent ? 'text-[#e11d48]' : 'text-[#8b90a8]'
                          )}>
                            <Clock size={9} /> {formatDate(log.action_plan_due_date)}
                          </span>
                        )}
                      </div>
                      {log.action_plan}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#8b90a8] flex-shrink-0 font-medium">{daysVal}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NotificationList({ notifications, onRead, onReadAll }: NotificationListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const unreadCount = notifications.filter(n => !n.is_read).length;

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleClick(n: Notification) {
    if (!n.is_read) onRead(n.id);
    toggle(n.id);
  }

  return (
    <div className="flex flex-col gap-2">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReadAll}>
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
          const label = TYPE_LABELS[n.type] ?? n.type;
          const d = (n as any).deal as any;
          const isOpen = expanded.has(n.id);
          const auditLogs: any[] = d?.audit_logs ?? d?.auditLogs ?? [];
          const client = d?.client;
          const bd = d?.bd;
          const hasDetail = !!(client || bd || auditLogs.length);

          return (
            <div key={n.id} className={cn(
              'rounded-2xl border transition-all',
              n.is_read ? 'bg-white border-[#e2e6f0]' : 'bg-[#fafbff] border-[#eef1fe] shadow-sm'
            )}>
              {/* Header row */}
              <button onClick={() => handleClick(n)} className="w-full text-left p-4 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: n.is_read ? '#e2e6f0' : color }} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs leading-relaxed', n.is_read ? 'text-[#4a5068]' : 'text-[#1a1d2e] font-medium')}>
                    {n.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                      style={{ background: `${color}15`, color }}>
                      {label}
                    </span>
                    {d && (
                      <span className="text-[10px] text-[#8b90a8] font-medium truncate max-w-[140px]">
                        {d.deal_name ?? d.dealName}
                      </span>
                    )}
                    <span className="text-[10px] text-[#8b90a8]">
                      {new Date(n.created_at).toLocaleDateString('en-PH', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                {hasDetail && (
                  <ChevronDown size={14} className={cn(
                    'text-[#8b90a8] flex-shrink-0 mt-0.5 transition-transform', isOpen && 'rotate-180'
                  )} />
                )}
              </button>

              {/* Expanded detail */}
              {isOpen && hasDetail && (
                <div className="px-4 pb-4 border-t border-[#f0f2f8] pt-3">
                  {/* Client + BD */}
                  {(client || bd) && (
                    <div className="flex items-start gap-4 mb-3 flex-wrap">
                      {client && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#eef1fe] flex items-center justify-center flex-shrink-0">
                            <Building2 size={11} className="text-[#3d5af1]" />
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-[#1a1d2e]">{client.name}</div>
                            <div className="text-[9px] text-[#8b90a8] uppercase tracking-wider">
                              {client.account_type ?? client.accountType}
                            </div>
                          </div>
                        </div>
                      )}
                      {bd && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#f0fdf4] flex items-center justify-center flex-shrink-0">
                            <User size={11} className="text-[#059669]" />
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

                  {/* Stage history timeline */}
                  {auditLogs.length > 0 && (
                    <>
                      <div className="text-[9px] font-semibold text-[#8b90a8] uppercase tracking-wider mb-2">
                        Stage History
                      </div>
                      <StageTimeline auditLogs={auditLogs} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}