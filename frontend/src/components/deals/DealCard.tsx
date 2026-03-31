import { Link } from 'react-router-dom';
import { Calendar, AlertTriangle } from 'lucide-react';
import type { Deal } from '../../types/index';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import StagePill from './StagePill';

interface DealCardProps {
  deal: Deal;
  compact?: boolean;
}

/** Returns badge config based on deal state */
function getDealBadge(deal: Deal): { label: string; color: string; bg: string; border: string } | null {
  if (deal.is_closed && deal.stage === 'Closed Won')  return { label: 'Won',        color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.20)' };
  if (deal.is_closed && deal.stage === 'Closed Lost') return { label: 'Lost',       color: '#E11D48', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.18)' };
  if ((deal.probability_pct || 0) >= 75)              return { label: 'High Value',  color: '#7C3AED', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.18)' };
  if (deal.stage === 'Inquiry' || deal.stage === 'Prospecting') return { label: 'New Lead', color: '#007AFF', bg: 'rgba(0,122,255,0.08)', border: 'rgba(0,122,255,0.18)' };
  if ((deal.days_in_stage || 0) > 3)                 return { label: 'Needs Action', color: '#D97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)' };
  return null;
}

function DealAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#007AFF', '#059669', '#D97706', '#7C3AED', '#E11D48', '#0891B2'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-semibold"
      style={{ background: `${color}12`, color, border: `1.5px solid ${color}25` }}
    >
      {initials}
    </div>
  );
}

export default function DealCard({ deal, compact = false }: DealCardProps) {
  const isStuck = (deal.days_in_stage || 0) > 3 && !deal.is_closed;
  // action_plan_due_date now lives on current DealAuditLog (Rev 3)
  const auditDueDate = deal.auditLogs?.[0]?.actionPlanDueDate || deal.auditLogs?.[0]?.action_plan_due_date;
  const isOverdue = auditDueDate && new Date(auditDueDate) < new Date() && !deal.is_closed;
  const badge = getDealBadge(deal);

  return (
    <Link to={`/deals/${deal.id}`} className="block select-none" draggable={false}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('dealId', String(deal.id));
        }}
        className={cn(
          'group cursor-grab rounded-[8px] border bg-white transition-all duration-150 active:cursor-grabbing',
          'hover:-translate-y-[2px] hover:shadow-md',
          isStuck
            ? 'border-[rgba(245,158,11,0.30)]'
            : 'border-[rgba(0,0,0,0.06)]',
          compact ? 'p-3' : 'p-3.5'
        )}
        style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
      >
        {/* ── Badge row ──────────────────────────────────── */}
        {badge && (
          <div className="mb-3">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-medium"
              style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
            >
              {badge.label}
            </span>
          </div>
        )}

        {/* ── Title + Client ─────────────────────────────── */}
        <div className="mb-2.5">
          <h3 className="truncate text-[14px] font-semibold leading-tight text-[#0F172A] transition-colors group-hover:text-[#007AFF]">
            {deal.deal_name}
          </h3>
          <p className="mt-[3px] truncate text-[12px] text-[#64748B]">{deal.client?.name}</p>
        </div>

        {/* ── Value ─────────────────────────────────────── */}
        <div className={cn('mb-3', compact && 'mb-2.5')}>
          <div className="text-[14px] font-semibold leading-none text-[#0F172A]">
            {formatCurrency(deal.revenue, true)}
          </div>
          {!compact && (
            <div className="mt-1 text-[12px] text-[#94A3B8]">
              {deal.lead_source} · {deal.duration}mo
            </div>
          )}
        </div>

        {/* ── Stage + Probability bar ────────────────────── */}
        {!compact && (
          <>
            <div className="mb-3">
              <StagePill stage={deal.stage} daysInStage={deal.days_in_stage} size="sm" />
            </div>

            {!deal.is_closed && (
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[10px]">
                  <span className="text-[#94A3B8]">Win probability</span>
                  <span className="font-medium text-[#475569]">{deal.probability_pct}%</span>
                </div>
                <div className="h-[3px] bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${deal.probability_pct}%`,
                      background:
                        deal.probability_pct === 100
                          ? '#10B981'
                          : deal.probability_pct === 0
                          ? '#F43F5E'
                          : '#007AFF',
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Footer: Owner avatar + timestamp ───────────── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {deal.bd && (
              <DealAvatar name={`${deal.bd.firstName} ${deal.bd.lastName}`} />
            )}
            {deal.due_date && !compact && (
              <div className="flex items-center gap-1 text-[12px] text-[#94A3B8]">
                <Calendar size={9} />
                <span>{formatDate(deal.due_date)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isStuck && (
              <AlertTriangle size={11} className="text-[#D97706]" />
            )}
            {isOverdue && (
              <span className="text-[10px] text-[#E11D48] bg-[rgba(244,63,94,0.08)] px-1.5 py-[2px] rounded-full border border-[rgba(244,63,94,0.18)]">
                Overdue
              </span>
            )}
            {!isStuck && !isOverdue && (
              <span className="text-[12px] text-[#CBD5E1]">{deal.last_stage_update_at ? formatDate(deal.last_stage_update_at) : deal.lead_source}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
