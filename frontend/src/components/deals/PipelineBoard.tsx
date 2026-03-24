import { useState } from 'react';
import type { Deal, PipelineStage } from '../../types/index';
import { formatCurrency, cn } from '../../lib/utils';
import { PIPELINE_STAGES } from '../../mockData';
import DealCard from './DealCard';
import { EmptyState, Button, Textarea } from '../ui/index';
import { Package } from 'lucide-react';
import { usePipelineStages, useUpdateDealStage } from '../../hooks/useDeals';

interface PipelineBoardProps {
  deals: Deal[];
  showClosed?: boolean;
}

interface PendingMove {
  dealId: string;
  dealName: string;
  fromStage: string;
  toStage: string;
  toStageId: string;
  currentRemarks: string;
  currentActionPlan: string;
}

export default function PipelineBoard({ deals, showClosed = false }: PipelineBoardProps) {
  const { data: dbStages = [] } = usePipelineStages();
  const updateStageMut = useUpdateDealStage();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Modal state for drag-and-drop confirmation
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveRemarks, setMoveRemarks] = useState('');
  const [moveActionPlan, setMoveActionPlan] = useState('');

  const activeStages = showClosed
    ? PIPELINE_STAGES
    : PIPELINE_STAGES.filter(s => !['Closed Won', 'Closed Lost'].includes(s.name));

  const getDealsByStage = (stage: PipelineStage) =>
    deals.filter(d => d.stage === stage);

  const handleDragOver = (e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    if (dragOverStage !== stageName) setDragOverStage(stageName);
  };

  const handleDrop = (e: React.DragEvent, targetStageName: string) => {
    e.preventDefault();
    setDragOverStage(null);

    const dealId = e.dataTransfer.getData('dealId');
    if (!dealId) return;

    const targetStageId = dbStages.find(s => s.name === targetStageName)?.id;
    if (!targetStageId) return;

    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === targetStageName) return;

    // Open modal instead of moving immediately
    setPendingMove({
      dealId,
      dealName: deal.deal_name,
      fromStage: deal.stage,
      toStage: targetStageName,
      toStageId: targetStageId,
      currentRemarks: deal.remarks || '',
      currentActionPlan: deal.action_plan || '',
    });
    setMoveRemarks(deal.remarks || '');
    setMoveActionPlan(deal.action_plan || '');
  };

  const confirmMove = () => {
    if (!pendingMove || !moveRemarks.trim() || !moveActionPlan.trim()) return;
    updateStageMut.mutate({
      id: pendingMove.dealId,
      data: {
        stageId: pendingMove.toStageId,
        remarks: moveRemarks.trim(),
        actionPlan: moveActionPlan.trim(),
        notes: `Moved from ${pendingMove.fromStage} to ${pendingMove.toStage} via pipeline board`,
      },
    });
    setPendingMove(null);
  };

  const cancelMove = () => {
    setPendingMove(null);
    setMoveRemarks('');
    setMoveActionPlan('');
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-0">
        {activeStages.map((stage) => {
          const stageDeals = getDealsByStage(stage.name);
          const totalValue = stageDeals.reduce((sum, d) => sum + d.revenue, 0);
          const stuckCount = stageDeals.filter(d => (d.days_in_stage || 0) > 3).length;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.name)}
              onDragLeave={(e) => {
                if (dragOverStage === stage.name) setDragOverStage(null);
              }}
              onDrop={(e) => handleDrop(e, stage.name)}
              className={cn(
                "flex flex-col gap-2 min-w-[260px] w-[260px] flex-shrink-0 transition-opacity rounded-xl",
                dragOverStage === stage.name ? "opacity-75 ring-2 ring-indigo-400 ring-offset-2" : "",
                updateStageMut.isPending ? "pointer-events-none" : ""
              )}
            >
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

      {/* Drag-and-drop confirmation modal */}
      {pendingMove && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#f4f6fb] border border-[#d1d5e8] rounded-2xl p-6 max-w-lg w-full">
            <h3 className="font-bold font-display text-[#1a1d2e] mb-1">
              Move "{pendingMove.dealName}" to {pendingMove.toStage}?
            </h3>
            <p className="text-sm text-[#4a5068] mb-4">
              From {pendingMove.fromStage} to {pendingMove.toStage}. Please update remarks and action plan.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#4a5068] mb-1">
                Remarks <span className="text-[#e11d48]">*</span>
              </label>
              <Textarea
                value={moveRemarks}
                onChange={e => setMoveRemarks(e.target.value)}
                rows={3}
                placeholder="Why is this deal moving? Key context, client feedback..."
              />
              {!moveRemarks.trim() && (
                <p className="text-[10px] text-[#e11d48] mt-1">Required — explain the reason for this stage change</p>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#4a5068] mb-1">
                Action Plan <span className="text-[#e11d48]">*</span>
              </label>
              <Textarea
                value={moveActionPlan}
                onChange={e => setMoveActionPlan(e.target.value)}
                rows={3}
                placeholder="Next steps: follow-up calls, deliverables, deadlines..."
              />
              {!moveActionPlan.trim() && (
                <p className="text-[10px] text-[#e11d48] mt-1">Required — describe the next steps for this deal</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[#e2e6f0]">
              <Button variant="secondary" size="sm" onClick={cancelMove}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmMove}
                disabled={updateStageMut.isPending || !moveRemarks.trim() || !moveActionPlan.trim()}
              >
                {updateStageMut.isPending ? 'Saving...' : `Confirm — ${pendingMove.toStage}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
