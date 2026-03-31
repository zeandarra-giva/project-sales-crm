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
  const isOverdue = deal.action_plan_due_date && new Date(deal.action_plan_due_date) < new Date() && !deal.is_closed;
  const badge = getDealBadge(deal);

  return (
    <Link to={`/deals/${deal.id}`} className="block select-none" draggable={false}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('dealId', String(deal.id));
        }}
        className={cn(
          'group bg-white border rounded-[8px] transition-all duration-150 cursor-grab active:cursor-grabbing',
          'hover:shadow-[0_4px_16px_rgba(15,23,42,0.10)] hover:-translate-y-[2px]',
          isStuck
            ? 'border-[rgba(245,158,11,0.30)]'
            : 'border-[rgba(0,0,0,0.06)]',
          compact ? 'p-3' : 'p-3.5'
        )}
        style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
      >
        {/* ── Badge row ──────────────────────────────────── */}
        {badge && (
          <div className="mb-2.5">
            <span
              className="inline-flex items-center gap-1 rounded-full text-[10px] font-medium px-2 py-[2px] border"
              style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
            >
              {badge.label}
            </span>
          </div>
        )}

        {/* ── Title + Client ─────────────────────────────── */}
        <div className="mb-2">
          <h3 className="text-[13px] font-semibold text-[#0F172A] truncate leading-tight group-hover:text-[#007AFF] transition-colors">
            {deal.deal_name}
          </h3>
          <p className="text-[11px] text-[#64748B] truncate mt-[2px]">{deal.client?.name}</p>
        </div>

        {/* ── Value ─────────────────────────────────────── */}
        <div className={cn('mb-2.5', compact && 'mb-2')}>
          <div className="text-[14px] font-semibold text-[#0F172A] leading-none">
            {formatCurrency(deal.revenue, true)}
          </div>
          {!compact && (
            <div className="text-[11px] text-[#94A3B8] mt-1">
              ₱{(deal.monthly_subscription / 1000).toFixed(0)}K/mo · {deal.duration}mo
            </div>
          )}
        </div>

        {/* ── Stage + Probability bar ────────────────────── */}
        {!compact && (
          <>
            <div className="mb-2.5">
              <StagePill stage={deal.stage} daysInStage={deal.days_in_stage} size="sm" />
            </div>

            {!deal.is_closed && (
              <div className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#94A3B8]">Win probability</span>
                  <span className="text-[#475569] font-medium">{deal.probability_pct}%</span>
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
              <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
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
              <span className="text-[10px] text-[#CBD5E1]">{deal.lead_source}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
