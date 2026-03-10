import type { Deal, PipelineStage } from '../../types/index';
import { formatCurrency } from '../../lib/utils';
import DealCard from './DealCard';
import { EmptyState } from '../ui/index';
import { Package } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: '1', name: 'Inquiry' as PipelineStage,       probability: 10, color: '#64748b', duration: 3 },
  { id: '2', name: 'Prospecting' as PipelineStage,   probability: 20, color: '#3b82f6', duration: 3 },
  { id: '3', name: 'Discovery' as PipelineStage,     probability: 40, color: '#8b5cf6', duration: 3 },
  { id: '4', name: 'Proposal Sent' as PipelineStage, probability: 60, color: '#f59e0b', duration: 3 },
  { id: '5', name: 'Negotiation' as PipelineStage,   probability: 75, color: '#f97316', duration: 3 },
  { id: '6', name: 'Closed Won' as PipelineStage,    probability: 100, color: '#10b981', duration: 0 },
  { id: '7', name: 'Closed Lost' as PipelineStage,   probability: 0,  color: '#e11d48', duration: 0 },
];

interface PipelineBoardProps {
  deals: Deal[];
  showClosed?: boolean;
}

export default function PipelineBoard({ deals, showClosed = false }: PipelineBoardProps) {
  const activeStages = showClosed
    ? PIPELINE_STAGES
    : PIPELINE_STAGES.filter(s => !['Closed Won', 'Closed Lost'].includes(s.name));

  const getDealsByStage = (stage: PipelineStage) =>
    deals.filter(d => d.stage === stage);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-0">
      {activeStages.map((stage) => {
        const stageDeals = getDealsByStage(stage.name);
        const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.revenue ?? 0), 0);
        const stuckCount = stageDeals.filter(d => ((d.days_in_stage ?? (d as any).days_in_current_stage) || 0) > 3).length;

        return (
          <div key={stage.id} className="flex flex-col gap-2 min-w-[260px] w-[260px] flex-shrink-0">
            {/* Column header */}
            <div className="bg-white border border-[#e2e6f0] rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-semibold font-display text-[#1a1d2e]">{stage.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {stuckCount > 0 && (
                    <span className="text-[10px] text-[#d97706] bg-[#fffbeb] border border-[#fde68a] px-1.5 py-0.5 rounded-md">
                      {stuckCount} stuck
                    </span>
                  )}
                  <span className="text-[10px] text-[#4a5068] bg-[#f4f6fb] px-1.5 py-0.5 rounded-md border border-[#e2e6f0]">
                    {stageDeals.length}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4a5068]">{stage.probability}% avg probability</span>
                <span className="text-xs font-semibold text-[#4a5068]">{formatCurrency(totalValue, true)}</span>
              </div>
              {/* Stage progress line */}
              <div className="h-0.5 rounded-full mt-2" style={{ background: `${stage.color}30` }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: stageDeals.length > 0 ? '100%' : '0%',
                    background: stage.color,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Deal cards */}
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {stageDeals.length === 0 ? (
                <div className="border border-dashed border-[#e2e6f0] rounded-xl p-4">
                  <EmptyState title="No deals" icon={<Package size={20} />} />
                </div>
              ) : (
                stageDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
