import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import PipelineBoard from '../components/deals/PipelineBoard';
import StagePill from '../components/deals/StagePill';
import { Card } from '../components/ui/index';
import { useQuery } from '@tanstack/react-query';
import { getDeals } from '../api/deals';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types/index';
import { AlertTriangle } from 'lucide-react';

const LEAD_SOURCES = ['All', 'Inbound', 'Outbound', 'Referral'];
const CONTRACT_STATUS_FILTERS = ['All', 'Active', 'Terminated'] as const;

export default function PipelinePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [showClosed, setShowClosed] = useState(false);
  const [contractStatusFilter, setContractStatusFilter] = useState<(typeof CONTRACT_STATUS_FILTERS)[number]>('Active');

  const { data: allDeals = [], isLoading, error } = useQuery({
    queryKey: ['deals'],
    queryFn: getDeals,
    retry: 1,
  });

  const filteredDeals = allDeals.filter(deal => {
    if (!showClosed && deal.is_closed) return false;
    if (stageFilter !== 'All' && deal.stage !== stageFilter) return false;
    if (sourceFilter !== 'All' && deal.lead_source !== sourceFilter) return false;
    if (contractStatusFilter === 'Active' && deal.contract_status === 'TERMINATED') return false;
    if (contractStatusFilter === 'Terminated' && deal.contract_status !== 'TERMINATED') return false;
    return true;
  });

  const activeDeals = filteredDeals.filter(d => !d.is_closed);
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + d.revenue, 0);
  const weightedValue = activeDeals.reduce((sum, d) => sum + d.revenue * (d.probability_pct || 0) / 100, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Pipeline" action={{ label: 'New Deal', to: '/deals/new' }} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8b90a8]">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const message =
      (error as any)?.response?.data?.error ||
      (error as Error)?.message ||
      'Failed to load pipeline';

    return (
      <div className="flex flex-col h-full">
        <Header title="Pipeline" action={{ label: 'New Deal', to: '/deals/new' }} />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="p-8 text-center max-w-md">
            <AlertTriangle size={24} className="text-[#d97706] mx-auto mb-3" />
            <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Failed to load pipeline</div>
            <div className="text-xs text-[#8b90a8]">{message}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-xs font-medium bg-[#3d5af1] text-white rounded-lg hover:bg-[#2d4ad1] transition-colors"
            >
              Retry
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pipeline"
        subtitle={`${activeDeals.length} active deals · ${formatCurrency(totalPipelineValue, true)} total`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="glass flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e6f0] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage filter pills */}
            <div className="flex items-center gap-1 rounded-[8px] border border-[#e2e6f0] bg-[rgba(248,250,252,0.92)] p-1 shadow-sm">
              {(['All', 'Inquiry', 'Prospecting', 'Discovery', 'Proposal Sent', 'Negotiation'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s as any)}
                  className={cn(
                    'whitespace-nowrap rounded-[8px] px-2.5 py-1 text-xs transition-all',
                    stageFilter === s
                      ? 'border border-[rgba(0,122,255,0.12)] bg-white text-[#007AFF] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-9 cursor-pointer rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] shadow-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)]"
            >
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={contractStatusFilter}
              onChange={e => setContractStatusFilter(e.target.value as (typeof CONTRACT_STATUS_FILTERS)[number])}
              className="h-9 cursor-pointer rounded-[8px] border border-[#E2E8F0] bg-white px-3 text-xs text-[#475569] shadow-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.12)]"
            >
              {CONTRACT_STATUS_FILTERS.map(status => <option key={status} value={status}>{status} contracts</option>)}
            </select>

            <button
              onClick={() => setShowClosed(!showClosed)}
              className={cn(
                'rounded-[8px] border px-3 py-2 text-xs transition-all',
                showClosed
                  ? 'bg-[#d1fae5] border-[#34d399] text-[#059669]'
                  : 'bg-white border-[#E2E8F0] text-[#64748B] shadow-sm hover:text-[#0F172A]'
              )}
            >
              Show closed
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span>Weighted:</span>
              <span className="font-semibold text-[#0F172A]">{formatCurrency(weightedValue, true)}</span>
            </div>
            {/* View toggle */}
            <div className="flex items-center rounded-[8px] border border-[#E2E8F0] bg-[rgba(248,250,252,0.92)] p-0.5 shadow-sm">
              <button
                onClick={() => setView('board')}
                className={cn('rounded-[8px] p-1.5 transition-all', view === 'board' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]')}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn('rounded-[8px] p-1.5 transition-all', view === 'list' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]')}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {view === 'board' ? (
          /* Board: horizontal scroll */
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="h-full min-w-max p-6">
              <PipelineBoard deals={filteredDeals} showClosed={showClosed} />
            </div>
          </div>
        ) : (
          /* List: vertical scroll, clickable rows */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">
                <div className="col-span-4">Deal</div>
                <div className="col-span-2">Stage</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">BD Owner</div>
                <div className="col-span-2">Due Date</div>
              </div>
              {filteredDeals.length === 0 ? (
                <div className="text-center py-16 text-sm text-[#8b90a8]">No deals match the current filters</div>
              ) : (
                filteredDeals.map(deal => (
                  <Card
                    key={deal.id}
                    className="px-4 py-3 hover:border-[#c7d0fb] hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/deals/${deal.id}`)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <div className="text-sm font-semibold text-[#1a1d2e] truncate">{deal.deal_name}</div>
                        <div className="text-xs text-[#8b90a8] truncate">
                          {deal.client?.name}
                          {deal.contract_status === 'TERMINATED' && ' · Terminated'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <StagePill stage={deal.stage} daysInStage={deal.days_in_stage} size="sm" />
                      </div>
                      <div className="col-span-2">
                        <div className="text-sm font-bold text-[#1a1d2e]">{formatCurrency(deal.revenue, true)}</div>
                        <div className="text-xs text-[#8b90a8]">{deal.probability_pct}% prob</div>
                      </div>
                      <div className="col-span-2 text-xs text-[#4a5068]">
                        {deal.bd?.firstName} {deal.bd?.lastName}
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
