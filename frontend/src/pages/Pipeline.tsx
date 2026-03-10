import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import PipelineBoard from '../components/deals/PipelineBoard';
import StagePill from '../components/deals/StagePill';
import { Card } from '../components/ui/index';
import { useAuthStore } from '../store/authStore';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types/index';

const LEAD_SOURCES = ['All', 'Inbound', 'Outbound', 'Referral'];

export default function PipelinePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [showClosed, setShowClosed] = useState(false);

  const params: Record<string, string> = {};
  if (!showClosed) params.is_closed = 'false';

  const { deals: allDeals, isLoading } = useDeals(params);

  const visibleDeals = allDeals.filter(deal => {
    if (stageFilter !== 'All' && deal.stage !== stageFilter) return false;
    if (sourceFilter !== 'All' && deal.lead_source !== sourceFilter) return false;
    return true;
  });

  const activeDeals = visibleDeals.filter(d => !d.is_closed);
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.revenue ?? 0), 0);
  const weightedValue = activeDeals.reduce((sum, d) => sum + Number(d.revenue ?? 0) * (d.probability_pct || 0) / 100, 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pipeline"
        subtitle={isLoading ? 'Loading…' : `${activeDeals.length} active deals · ${formatCurrency(totalPipelineValue, true)} total`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-[#e2e6f0] bg-white flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl p-1">
              {(['All', 'Inquiry', 'Prospecting', 'Discovery', 'Proposal Sent', 'Negotiation'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s as any)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs transition-all whitespace-nowrap',
                    stageFilter === s
                      ? 'bg-white text-[#3d5af1] border border-[#c7d0fb] shadow-sm'
                      : 'text-[#8b90a8] hover:text-[#4a5068]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-8 bg-white border border-[#e2e6f0] rounded-lg px-2.5 text-xs text-[#4a5068] cursor-pointer focus:outline-none"
            >
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={() => setShowClosed(!showClosed)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs border transition-all',
                showClosed
                  ? 'bg-[#d1fae5] border-[#34d399] text-[#059669]'
                  : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
              )}
            >
              Show closed
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#8b90a8]">
              <span>Weighted:</span>
              <span className="text-[#4a5068] font-semibold">{formatCurrency(weightedValue, true)}</span>
            </div>
            <div className="flex items-center bg-[#f4f6fb] border border-[#e2e6f0] rounded-lg p-0.5">
              <button onClick={() => setView('board')} className={cn('p-1.5 rounded-md transition-all', view === 'board' ? 'bg-white text-[#3d5af1] shadow-sm' : 'text-[#8b90a8] hover:text-[#4a5068]')}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md transition-all', view === 'list' ? 'bg-white text-[#3d5af1] shadow-sm' : 'text-[#8b90a8] hover:text-[#4a5068]')}>
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#8b90a8]">Loading deals…</div>
        ) : view === 'board' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="h-full min-w-max p-6">
              <PipelineBoard deals={visibleDeals} showClosed={showClosed} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">
                <div className="col-span-4">Deal</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">BD Owner</div>
                <div className="col-span-2">Due Date</div>
              </div>
              {visibleDeals.length === 0 ? (
                <div className="text-center py-16 text-sm text-[#8b90a8]">No deals match the current filters</div>
              ) : (
                visibleDeals.map(deal => (
                  <Card
                    key={deal.id}
                    className="px-4 py-3 hover:border-[#c7d0fb] hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <div className="text-sm font-semibold text-[#1a1d2e] truncate">{deal.deal_name}</div>
                        <div className="text-xs text-[#8b90a8] truncate">{deal.client?.name}</div>
                      </div>
                      <div className="col-span-2">
                        <StagePill stage={deal.stage} daysInStage={deal.days_in_stage ?? (deal as any).days_in_current_stage} size="sm" />
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm font-bold text-[#1a1d2e]">{formatCurrency(Number(deal.revenue ?? 0), true)}</div>
                        <div className="text-xs text-[#8b90a8]">{deal.probability_pct}% prob</div>
                      </div>
                      <div className="col-span-2 text-xs text-[#4a5068]">
                        {deal.bd?.first_name} {deal.bd?.last_name}
                      </div>
                      <div className="col-span-2 text-xs text-[#8b90a8]">
                        {deal.due_date
                          ? new Date(deal.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
