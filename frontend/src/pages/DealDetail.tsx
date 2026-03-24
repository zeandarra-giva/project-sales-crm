import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Calendar, Clock, FileText, CheckCircle,
  AlertTriangle, Edit2, Save, X, ChevronRight, History,
} from 'lucide-react';
import { Card, Button, Badge, Textarea, Input, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import DealHistory from '../components/deals/DealHistory';
import { useDeal, useUpdateDeal, useUpdateDealStage, usePipelineStages, useDealHistory } from '../hooks/useDeals';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import type { PipelineStage, DealAuditLog } from '../types/index';

// ── Stage colors (local — DB schema has no color field) ──────────────
const STAGE_COLOR: Record<string, string> = {
  'Inquiry':       '#4a4f6b',
  'Prospecting':   '#4f6ef7',
  'Discovery':     '#10b981',
  'Proposal Sent': '#8b5cf6',
  'Negotiation':   '#f59e0b',
  'Closed Won':    '#10b981',
  'Closed Lost':   '#f43f5e',
}

// Display order — Closed Lost is shown separately as a "danger" button
const STAGE_ORDER: PipelineStage[] = [
  'Inquiry', 'Prospecting', 'Discovery', 'Proposal Sent', 'Negotiation', 'Closed Won',
]

const STAGE_CHANGE_CONFIRM: Record<string, string> = {
  'Closed Won':  'Are you sure you want to mark this deal as Closed Won? This action records the contract as signed.',
  'Closed Lost': 'Moving to Closed Lost is irreversible. Please ensure remarks explain why the deal was lost.',
}

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: deal, isLoading }    = useDeal(id || '');
  const { data: stages = [] }        = usePipelineStages();
  const { data: history = [] }       = useDealHistory(id || '');

  const updateMutation = useUpdateDeal();
  const stageMutation  = useUpdateDealStage();

  const [editing, setEditing]               = useState(false);
  const [stageConfirm, setStageConfirm]     = useState<PipelineStage | null>(null);
  const [editRemarks, setEditRemarks]       = useState('');
  const [editActionPlan, setEditActionPlan] = useState('');
  const [contractLink, setContractLink]     = useState('');
  const [showHistory, setShowHistory]       = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-[#8b90a8]">Loading deal...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <p className="text-[#8b90a8]">Deal not found</p>
        <Button variant="secondary" onClick={() => navigate('/pipeline')}>Back to Pipeline</Button>
      </div>
    );
  }

  const currentStage = deal.stage;
  const stageIndex   = STAGE_ORDER.indexOf(currentStage);
  const isClosed     = ['Closed Won', 'Closed Lost'].includes(currentStage);

  // Look up the real DB UUID for a given stage name
  const getStageId = (name: PipelineStage): string | undefined =>
    stages.find(s => s.name === name)?.id;

  const startEdit = () => {
    setEditRemarks(deal.remarks);
    setEditActionPlan(deal.action_plan);
    setContractLink(deal.contract_link || '');
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({
      id: deal.id,
      data: {
        remarks:      editRemarks || undefined,
        actionPlan:   editActionPlan || undefined,
        contractLink: contractLink || undefined,
      },
    });
    setEditing(false);
  };

  // Stage click on the progress bar (non-closing stages only)
  const handleStageClick = (stage: PipelineStage) => {
    if (stage === currentStage || isClosed || stageMutation.isPending) return;
    if (stage === 'Closed Won') { setStageConfirm('Closed Won'); return; }
    const targetStageId = getStageId(stage);
    if (!targetStageId) return;
    stageMutation.mutate({ id: deal.id, data: { stageId: targetStageId } });
  };

  // Confirm modal callback for Closed Won / Closed Lost
  const confirmStageChange = () => {
    if (!stageConfirm) return;
    if (stageConfirm === 'Closed Lost' && !deal.remarks.trim() && !editRemarks.trim()) {
      alert('Remarks are required before closing as Lost.');
      return;
    }
    const targetStageId = getStageId(stageConfirm);
    if (!targetStageId) return;

    if (stageConfirm === 'Closed Won' && contractLink) {
      updateMutation.mutate({ id: deal.id, data: { contractLink } });
    }
    if (editRemarks) {
      updateMutation.mutate({ id: deal.id, data: { remarks: editRemarks } });
    }

    stageMutation.mutate({
      id: deal.id,
      data: { stageId: targetStageId, notes: `Moved to ${stageConfirm}` },
    });
    setStageConfirm(null);
  };

  // Map backend history entries to the DealAuditLog frontend type
  const auditLogs: DealAuditLog[] = history.map(h => ({
    id:            h.id,
    deal_id:       deal.id,
    stage:         h.stage,
    entered_at:    h.enteredAt,
    exited_at:     h.exitedAt,
    days_in_stage: h.daysInStage,
    changed_by:    h.changedById,
    notes:         h.notes,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-[#f4f6fb] flex-shrink-0">
        <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base font-display text-[#1a1d2e] truncate">{deal.deal_name}</h1>
          <div className="flex items-center gap-2 text-xs text-[#8b90a8]">
            <span>{deal.client?.name}</span>
            <span>·</span>
            <StagePill stage={currentStage} daysInStage={deal.days_in_stage} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={deal.lead_source === 'Inbound' ? 'success' : deal.lead_source === 'Outbound' ? 'info' : 'warning'} size="sm">
            {deal.lead_source}
          </Badge>
          <Button
            size="sm"
            variant={showHistory ? 'secondary' : 'ghost'}
            onClick={() => setShowHistory(h => !h)}
            title="Toggle stage history"
          >
            <History size={14} />
            {auditLogs.length > 0 && <span className="ml-1">{auditLogs.length}</span>}
          </Button>
          {editing ? (
            <>
              <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={14} />
              </Button>
            </>
          ) : (
            !isClosed && (
              <Button size="sm" variant="secondary" onClick={startEdit}>
                <Edit2 size={14} /> Edit
              </Button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content — left 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Pipeline stage tracker */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline Stage</div>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {STAGE_ORDER.map((stageName, i, arr) => {
                  const isCurrent = stageName === currentStage;
                  const isPast    = STAGE_ORDER.indexOf(stageName) < stageIndex;
                  const isLast    = i === arr.length - 1;
                  const color     = STAGE_COLOR[stageName];
                  return (
                    <div key={stageName} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => handleStageClick(stageName)}
                        disabled={isClosed || stageMutation.isPending}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          isCurrent && 'text-white border-transparent',
                          isPast && !isCurrent && 'text-[#8b90a8] border-[#e2e6f0] bg-[#f4f6fb]',
                          !isCurrent && !isPast && 'text-[#8b90a8] border-transparent hover:border-[#c8cfe8] hover:text-[#4a5068]',
                          (isClosed || stageMutation.isPending) && 'cursor-default opacity-60',
                        )}
                        style={isCurrent ? { background: `${color}20`, borderColor: `${color}40`, color } : {}}
                      >
                        {stageName}
                      </button>
                      {!isLast && <ChevronRight size={12} className="text-[#8b90a8] mx-0.5 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
              {!isClosed && (
                <div className="mt-3 pt-3 border-t border-[#e2e6f0] flex items-center justify-between">
                  <button
                    onClick={() => setStageConfirm('Closed Lost')}
                    disabled={stageMutation.isPending}
                    className="text-xs text-[#e11d48] hover:text-[#c81d3e] transition-colors disabled:opacity-50"
                  >
                    Mark as Closed Lost
                  </button>
                  <span className="text-xs text-[#8b90a8]">
                    {deal.days_in_stage}d in current stage
                    {(deal.days_in_stage || 0) > 3 && <AlertTriangle size={10} className="inline ml-1 text-[#d97706]" />}
                  </span>
                </div>
              )}
            </Card>

            {/* Stage history (collapsible via header button) */}
            {showHistory && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <History size={14} className="text-[#3d5af1]" />
                  <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Stage History</span>
                </div>
                <DealHistory logs={auditLogs} />
              </Card>
            )}

            {/* Stage confirm modal */}
            {stageConfirm && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#f4f6fb] border border-[#d1d5e8] rounded-2xl p-6 max-w-md w-full">
                  <h3 className="font-bold font-display text-[#1a1d2e] mb-2">Move to {stageConfirm}?</h3>
                  <p className="text-sm text-[#4a5068] mb-4">
                    {STAGE_CHANGE_CONFIRM[stageConfirm] || `Move "${deal.deal_name}" to ${stageConfirm}?`}
                  </p>
                  {stageConfirm === 'Closed Lost' && (
                    <div className="mb-4 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">
                      Deal remarks must be filled before closing as Lost.
                    </div>
                  )}
                  {stageConfirm === 'Closed Won' && (
                    <div className="mb-4">
                      <Input label="Contract Link (recommended)" value={contractLink} onChange={e => setContractLink(e.target.value)} placeholder="https://..." />
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setStageConfirm(null)}>Cancel</Button>
                    <Button
                      variant={stageConfirm === 'Closed Lost' ? 'danger' : 'success'}
                      size="sm"
                      onClick={confirmStageChange}
                      disabled={stageMutation.isPending}
                    >
                      {stageMutation.isPending ? 'Saving...' : `Confirm — ${stageConfirm}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-[#3d5af1]" />
                <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Remarks</span>
                {!deal.remarks.trim() && !isClosed && <Badge variant="danger" size="sm">Required for Closed Lost</Badge>}
              </div>
              {editing ? (
                <Textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} rows={4} placeholder="Add deal notes, client context, and progress updates..." />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {deal.remarks || <span className="text-[#8b90a8] italic">No remarks yet</span>}
                </p>
              )}
            </Card>

            {/* Action Plan */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[#059669]" />
                  <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Action Plan</span>
                </div>
                {deal.action_plan_due_date && (
                  <Badge variant={new Date(deal.action_plan_due_date) < new Date() ? 'danger' : 'neutral'} size="sm">
                    Due {formatDate(deal.action_plan_due_date)}
                  </Badge>
                )}
              </div>
              {editing ? (
                <Textarea value={editActionPlan} onChange={e => setEditActionPlan(e.target.value)} rows={3} placeholder="Next steps, action items..." />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {deal.action_plan || <span className="text-[#8b90a8] italic">No action plan set</span>}
                </p>
              )}
            </Card>
          </div>

          {/* Sidebar — right 1 col */}
          <div className="flex flex-col gap-4">
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Value</div>
              <div className="text-3xl font-bold font-display text-[#1a1d2e] mb-1">{formatCurrency(deal.revenue, true)}</div>
              <div className="text-xs text-[#8b90a8] mb-4">₱{deal.monthly_subscription.toLocaleString()}/mo × {deal.duration} months</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b90a8]">Win probability</span>
                  <span className="font-semibold text-[#4a5068]">{deal.probability_pct}%</span>
                </div>
                <div className="h-1.5 bg-[#e2e6f0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#4f6ef7]" style={{ width: `${deal.probability_pct}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b90a8]">Weighted value</span>
                  <span className="font-semibold text-[#4a5068]">{formatCurrency(deal.revenue * (deal.probability_pct || 0) / 100, true)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Key Dates</div>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Deal Created',     date: deal.start_date,           icon: <Calendar size={12} /> },
                  deal.due_date && { label: 'Expected Close', date: deal.due_date, icon: <Calendar size={12} />, highlight: true },
                  deal.closed_date && { label: 'Actual Close', date: deal.closed_date, icon: <CheckCircle size={12} /> },
                  deal.action_plan_due_date && {
                    label: 'Action Plan Due', date: deal.action_plan_due_date,
                    icon: <Clock size={12} />,
                    warning: new Date(deal.action_plan_due_date) < new Date(),
                  },
                ].filter(Boolean).map((item: any, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className={cn('flex items-center gap-1.5', item.warning ? 'text-[#e11d48]' : 'text-[#8b90a8]')}>
                      {item.icon}
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <span className={cn('text-xs font-medium', item.highlight ? 'text-[#1a1d2e]' : 'text-[#4a5068]')}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">People</div>
              {deal.bd && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#f0f2f8]">
                  <Avatar name={`${deal.bd.firstName} ${deal.bd.lastName}`} />
                  <div>
                    <div className="text-xs font-semibold text-[#1a1d2e]">{deal.bd.firstName} {deal.bd.lastName}</div>
                    <div className="text-[10px] text-[#8b90a8]">BD Owner</div>
                  </div>
                </div>
              )}
              {deal.client && (
                <Link to={`/clients/${deal.client.id}`}>
                  <div className="text-xs font-semibold text-[#1a1d2e] hover:text-[#3d5af1] transition-colors">{deal.client.name}</div>
                  <div className="text-[10px] text-[#8b90a8] mt-0.5">{deal.client.account_type}</div>
                  <Badge variant="neutral" size="sm" className="mt-2">{deal.client.status}</Badge>
                </Link>
              )}
            </Card>

            {(deal.proposal_link || deal.contract_link) && (
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Documents</div>
                <div className="flex flex-col gap-2">
                  {deal.proposal_link && (
                    <a href={deal.proposal_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#3d5af1] transition-colors">
                      <ExternalLink size={12} /> View Proposal
                    </a>
                  )}
                  {deal.contract_link && (
                    <a href={deal.contract_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-[#059669] hover:text-[#047857] transition-colors">
                      <ExternalLink size={12} /> View Contract
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
