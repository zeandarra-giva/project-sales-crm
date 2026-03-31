import { useState } from 'react';
import type { Deal, PipelineStage } from '../../types/index';
import { formatCurrency, cn } from '../../lib/utils';
import { PIPELINE_STAGES } from '../../mockData';
import DealCard from './DealCard';
import { EmptyState, Button, Textarea } from '../ui/index';
import { Package, TrendingUp, BarChart2, Zap } from 'lucide-react';
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

/** Colored dot per stage — per design spec */
const STAGE_DOT_COLORS: Record<string, string> = {
  'Inquiry':       '#94A3B8',  // Gray
  'Prospecting':   '#007AFF',  // Blue
  'Discovery':     '#F59E0B',  // Orange
  'Proposal Sent': '#8B5CF6',  // Purple
  'Negotiation':   '#10B981',  // Green
  'Closed Won':    '#10B981',
  'Closed Lost':   '#F43F5E',
};

export default function PipelineBoard({ deals, showClosed = false }: PipelineBoardProps) {
  const { data: dbStages = [] } = usePipelineStages();
  const updateStageMut = useUpdateDealStage();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

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

  // ── Footer stats ────────────────────────────────────────────────────────────
  const activeDeals = deals.filter(d => !d.is_closed);
  const totalValue = activeDeals.reduce((s, d) => s + d.revenue, 0);
  const avgDealSize = activeDeals.length > 0 ? totalValue / activeDeals.length : 0;
  const avgDaysInStage =
    activeDeals.length > 0
      ? activeDeals.reduce((s, d) => s + (d.days_in_stage || 0), 0) / activeDeals.length
      : 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Kanban board ─────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-5">
        {activeStages.map((stage) => {
          const stageDeals = getDealsByStage(stage.name);
          const stageValue = stageDeals.reduce((sum, d) => sum + d.revenue, 0);
          const stuckCount = stageDeals.filter(d => (d.days_in_stage || 0) > 3).length;
          const dotColor = STAGE_DOT_COLORS[stage.name] ?? '#94A3B8';
          const isDragTarget = dragOverStage === stage.name;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.name)}
              onDragLeave={() => { if (dragOverStage === stage.name) setDragOverStage(null); }}
              onDrop={(e) => handleDrop(e, stage.name)}
              className={cn(
                'flex flex-shrink-0 flex-col gap-3 rounded-[12px] transition-all',
                isDragTarget ? 'ring-2 ring-[#007AFF]/40 ring-offset-1' : '',
                updateStageMut.isPending ? 'pointer-events-none opacity-60' : ''
              )}
              style={{ width: '332px', minWidth: '332px' }}
            >
              {/* ── Column header ─────────────────────────────── */}
              <div
                className="glass flex-shrink-0 rounded-[12px] border border-[rgba(0,0,0,0.04)] px-4 py-3"
                style={{ background: isDragTarget ? 'rgba(240,249,255,0.92)' : 'rgba(248,250,252,0.88)' }}
              >
                {/* Top row: dot + name + count */}
                <div className="flex items-center justify-between mb-[3px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                      style={{ background: dotColor }}
                    />
                    <span className="text-[12px] font-semibold text-[#0F172A] uppercase tracking-[0.12em]">
                      {stage.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {stuckCount > 0 && (
                      <span className="text-[10px] text-[#D97706] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.20)] px-1.5 py-[2px] rounded-full">
                        {stuckCount} stuck
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary line — "INQUIRY 4 • ₱142K" style */}
                <div className="text-[11px] font-medium text-[#64748B]">
                  {stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''}
                  {stageValue > 0 && (
                    <span className="text-[#94A3B8]"> · {formatCurrency(stageValue, true)}</span>
                  )}
                </div>

                {/* Stage progress bar — tonal fill */}
                <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: stageDeals.length > 0 ? '100%' : '0%',
                      background: dotColor,
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>

              {/* ── Deal cards list ───────────────────────────── */}
              <div className="flex max-h-[calc(100vh-312px)] flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {stageDeals.length === 0 ? (
                  <div
                    className={cn(
                      'rounded-[12px] border border-dashed',
                      isDragTarget
                        ? 'border-[#007AFF]/30 bg-[rgba(0,122,255,0.03)]'
                        : 'border-[rgba(0,0,0,0.07)]'
                    )}
                  >
                    <EmptyState title="Drop deals here" icon={<Package size={18} />} />
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

      {/* ── Sticky footer stats bar ──────────────────────────────────────────── */}
      <div
        className="glass flex flex-shrink-0 items-center justify-center gap-10 border-t border-[rgba(0,0,0,0.05)] px-6 py-3"
        style={{
          background: 'rgba(248,250,252,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Total Value */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-[rgba(0,122,255,0.08)] flex items-center justify-center">
            <TrendingUp size={13} className="text-[#007AFF]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider leading-none">Total Value</div>
            <div className="text-[14px] font-semibold text-[#0F172A] leading-tight mt-[1px]">
              {formatCurrency(totalValue, true)}
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-[rgba(0,0,0,0.06)]" />

        {/* Avg Deal Size */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-[rgba(139,92,246,0.08)] flex items-center justify-center">
            <BarChart2 size={13} className="text-[#7C3AED]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider leading-none">Avg Deal Size</div>
            <div className="text-[14px] font-semibold text-[#0F172A] leading-tight mt-[1px]">
              {formatCurrency(avgDealSize, true)}
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-[rgba(0,0,0,0.06)]" />

        {/* Velocity */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-[rgba(16,185,129,0.08)] flex items-center justify-center">
            <Zap size={13} className="text-[#059669]" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider leading-none">Velocity</div>
            <div className="text-[14px] font-semibold text-[#0F172A] leading-tight mt-[1px]">
              {avgDaysInStage.toFixed(1)}d avg
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-[rgba(0,0,0,0.06)]" />

        {/* Deal count */}
        <div>
          <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider leading-none">Active Deals</div>
          <div className="text-[14px] font-semibold text-[#0F172A] leading-tight mt-[1px]">
            {activeDeals.length}
          </div>
        </div>
      </div>

      {/* ── Drag-and-drop confirmation modal ─────────────────────────────────── */}
      {pendingMove && (
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.35)] backdrop-blur-[6px] flex items-center justify-center z-50 p-4">
          <div
            className="glass-modal border border-[rgba(0,0,0,0.06)] rounded-[12px] p-6 max-w-lg w-full animate-scale-in"
            style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.08)' }}
          >
            <h3 className="text-[15px] font-semibold text-[#0F172A] mb-1 tracking-tight headline">
              Move "{pendingMove.dealName}"
            </h3>
            <p className="text-[12px] text-[#64748B] mb-5">
              {pendingMove.fromStage} → {pendingMove.toStage} · Please add context before moving.
            </p>

            <div className="mb-4">
              <label className="block text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1.5">
                Remarks <span className="text-[#F43F5E]">*</span>
              </label>
              <Textarea
                value={moveRemarks}
                onChange={e => setMoveRemarks(e.target.value)}
                rows={3}
                placeholder="Why is this deal moving? Key context, client feedback…"
              />
              {!moveRemarks.trim() && (
                <p className="text-[10px] text-[#E11D48] mt-1">Required — explain the reason for this stage change</p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1.5">
                Action Plan <span className="text-[#F43F5E]">*</span>
              </label>
              <Textarea
                value={moveActionPlan}
                onChange={e => setMoveActionPlan(e.target.value)}
                rows={3}
                placeholder="Next steps: follow-up calls, deliverables, deadlines…"
              />
              {!moveActionPlan.trim() && (
                <p className="text-[10px] text-[#E11D48] mt-1">Required — describe the next steps for this deal</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-[rgba(0,0,0,0.05)]">
              <Button variant="ghost" size="sm" onClick={cancelMove}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmMove}
                disabled={updateStageMut.isPending || !moveRemarks.trim() || !moveActionPlan.trim()}
              >
                {updateStageMut.isPending ? 'Saving…' : `Confirm → ${pendingMove.toStage}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
