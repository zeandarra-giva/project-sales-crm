import { Link } from 'react-router-dom';
import { Calendar, TrendingUp, User, AlertTriangle, ExternalLink } from 'lucide-react';
import type { Deal } from '../../types/index';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import StagePill from './StagePill';
import { Avatar } from '../ui/index';

interface DealCardProps {
  deal: Deal;
  compact?: boolean;
}

export default function DealCard({ deal, compact = false }: DealCardProps) {
  const isStuck = (deal.days_in_stage || 0) > 3 && !deal.is_closed;
  const isOverdue = deal.action_plan_due_date && new Date(deal.action_plan_due_date) < new Date() && !deal.is_closed;

  return (
    <Link to={`/deals/${deal.id}`}>
      <div className={cn(
        'group bg-white border rounded-xl transition-all duration-150 hover:border-[#a5b4fc] hover:bg-[#eef1fd] cursor-pointer',
        isStuck ? 'border-[#fde68a]' : 'border-[#e2e6f0]',
        compact ? 'p-3' : 'p-4'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[#1a1d2e] font-display truncate group-hover:text-[#3d5af1] transition-colors">
              {deal.deal_name}
            </h3>
            <p className="text-xs text-[#4a5068] truncate mt-0.5">{deal.client?.name}</p>
          </div>
          <ExternalLink size={12} className="text-[#4a5068] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </div>

        {/* Revenue */}
        <div className="mb-3">
          <div className="text-base font-bold font-display text-[#1a1d2e]">{formatCurrency(deal.revenue, true)}</div>
          <div className="text-xs text-[#4a5068]">₱{(deal.monthly_subscription / 1000).toFixed(0)}K/mo · {deal.duration}mo</div>
        </div>

        {!compact && (
          <>
            {/* Stage */}
            <div className="mb-3">
              <StagePill stage={deal.stage} daysInStage={deal.days_in_stage} size="sm" />
            </div>

            {/* Probability bar */}
            {!deal.is_closed && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#4a5068]">Win probability</span>
                  <span className="text-[#4a5068]">{deal.probability_pct}%</span>
                </div>
                <div className="h-1 bg-[#e2e6f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${deal.probability_pct}%`,
                      background: deal.probability_pct === 100 ? '#10b981' : deal.probability_pct === 0 ? '#f43f5e' : '#4f6ef7'
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {deal.bd && (
              <div className="flex items-center gap-1.5">
                <Avatar name={`${deal.bd.firstName} ${deal.bd.lastName}`} size="sm" />
                {!compact && <span className="text-xs text-[#4a5068]">{deal.bd.firstName}</span>}
              </div>
            )}
            {deal.due_date && !compact && (
              <div className="flex items-center gap-1 text-xs text-[#4a5068]">
                <Calendar size={10} />
                <span>{formatDate(deal.due_date)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isStuck && <AlertTriangle size={12} className="text-[#d97706]" />}
            {isOverdue && <span className="text-[10px] text-[#e11d48] bg-[#fff1f2] px-1.5 py-0.5 rounded-md border border-[#fecdd3]">Plan due</span>}
            <span className="text-xs text-[#4a5068]">{deal.lead_source}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
