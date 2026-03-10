import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { Deal } from '../../types';
import StagePill from '../deals/StagePill';
import { formatCurrency } from '../../lib/utils';

interface StuckDealsListProps {
  deals: Deal[];
  limit?: number;
}

export default function StuckDealsList({ deals, limit = 5 }: StuckDealsListProps) {
  const shown = deals.slice(0, limit);

  if (shown.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-[#8b90a8]">No stuck deals — pipeline is healthy!</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {shown.map(deal => (
        <Link
          key={deal.id}
          to={`/deals/${deal.id}`}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f4f6fb] transition-all group border border-transparent hover:border-[#fde68a]"
        >
          <div className="w-7 h-7 rounded-lg bg-[#fffbeb] border border-[#fde68a] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={13} className="text-[#d97706]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[#1a1d2e] truncate group-hover:text-[#3d5af1] transition-colors">
              {deal.deal_name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StagePill stage={deal.stage} size="sm" />
              <span className="text-[10px] text-[#d97706]">{deal.days_in_stage}d in stage</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs font-bold text-[#1a1d2e]">{formatCurrency(deal.revenue, true)}</div>
            <div className="text-[10px] text-[#8b90a8]">{deal.bd?.firstName}</div>
          </div>
          <ArrowRight size={13} className="text-[#c8cfe8] group-hover:text-[#3d5af1] transition-colors flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
