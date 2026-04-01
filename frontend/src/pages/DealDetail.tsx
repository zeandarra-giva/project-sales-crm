import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Calendar, Clock, FileText, CheckCircle,
  AlertTriangle, Edit2, Save, X, ChevronRight, History, User, Mail, Phone, ShieldAlert,
} from 'lucide-react';
import { Card, Button, Badge, Textarea, Input, Avatar, Select } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import DealHistory from '../components/deals/DealHistory';
import { useDeal, useUpdateDeal, useUpdateDealStage, usePipelineStages, useDealHistory, useTerminateDeal } from '../hooks/useDeals';
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
  const terminateMutation = useTerminateDeal();

  const [editing, setEditing]               = useState(false);
  const [stageConfirm, setStageConfirm]     = useState<PipelineStage | null>(null);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [editRemarks, setEditRemarks]       = useState('');
  const [editActionPlan, setEditActionPlan] = useState('');
  const [contractLink, setContractLink]     = useState('');
  const [primaryContactId, setPrimaryContactId] = useState('__NONE__');
  const [terminationDate, setTerminationDate] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [terminationNotes, setTerminationNotes] = useState('');
  // Stage change modal fields (mandatory)
  const [stageRemarks, setStageRemarks]     = useState('');
  const [stageActionPlan, setStageActionPlan] = useState('');
  const currentPrimaryDealContactId =
    deal?.dealContacts?.find((dealContact: any) => dealContact.isPrimary)?.contact?.id ?? '__NONE__';

  useEffect(() => {
    if (!deal) return;
    setPrimaryContactId(currentPrimaryDealContactId);
  }, [deal?.id, currentPrimaryDealContactId]);

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
  const isTerminated = deal.contract_status === 'TERMINATED';
  const currentPrimaryDealContact = deal.dealContacts?.find((dealContact: any) => dealContact.isPrimary);
  const clientContactOptions = [
    { value: '__NONE__', label: 'No primary contact yet' },
    ...((deal.client?.contacts ?? []).map((contact: any) => ({
      value: contact.id,
      label: `${contact.first_name ?? ''} ${contact.last_name ?? ''}${contact.is_primary ? ' (Client Primary)' : ''}`.trim(),
    }))),
  ];

  // Look up the real DB UUID for a given stage name
  const getStageId = (name: PipelineStage): string | undefined =>
    stages.find(s => s.name === name)?.id;

  // Current stage audit log entry carries remarks/actionPlan (Rev 1–3)
  const currentAuditLog = deal.auditLogs?.[0];
  const currentRemarks   = currentAuditLog?.remarks || '';
  const currentActionPlan = currentAuditLog?.actionPlan || currentAuditLog?.action_plan || '';
  const currentActionPlanDueDate = currentAuditLog?.actionPlanDueDate || currentAuditLog?.action_plan_due_date;

  const startEdit = () => {
    setEditRemarks(currentRemarks);
    setEditActionPlan(currentActionPlan);
    setContractLink(deal.contract_link || '');
    setEditing(true);
  };

  const openTerminateModal = () => {
    setTerminationDate(deal.terminated_at ? deal.terminated_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setTerminationReason(deal.termination_reason || '');
    setTerminationNotes(deal.termination_notes || '');
    setShowTerminateModal(true);
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

  // Every stage click shows a confirmation modal with mandatory fields
  const handleStageClick = (stage: PipelineStage) => {
    if (stage === currentStage || isClosed || stageMutation.isPending) return;
    setStageRemarks(currentRemarks);
    setStageActionPlan(currentActionPlan);
    setContractLink(deal.contract_link || '');
    setStageConfirm(stage);
  };

  // Confirm modal callback — remarks + action plan are mandatory
  const confirmStageChange = () => {
    if (!stageConfirm) return;
    if (!stageRemarks.trim()) {
      alert('Remarks are required when moving a deal to a new stage.');
      return;
    }
    if (!stageActionPlan.trim()) {
      alert('Action plan is required when moving a deal to a new stage.');
      return;
    }
    const targetStageId = getStageId(stageConfirm);
    if (!targetStageId) {
      alert('Pipeline stages are still loading. Please try again.');
      return;
    }

    // For Closed Won: save contract link first (backend requires it on Deal before stage move)
    // The updateMutation resolves quickly; backend reads contractLink from DB on stage change
    if (stageConfirm === 'Closed Won' && contractLink) {
      updateMutation.mutate({ id: deal.id, data: { contractLink } });
    }

    stageMutation.mutate({
      id: deal.id,
      data: {
        stageId: targetStageId,
        remarks: stageRemarks.trim(),
        actionPlan: stageActionPlan.trim(),
        notes: `Moved from ${currentStage} to ${stageConfirm}`,
      },
    });
    setStageConfirm(null);
  };

  const confirmTermination = () => {
    if (!terminationDate || !terminationReason.trim()) return;

    terminateMutation.mutate({
      id: deal.id,
      data: {
        terminatedAt: new Date(`${terminationDate}T00:00:00.000Z`).toISOString(),
        reason: terminationReason.trim(),
        notes: terminationNotes.trim() || undefined,
      },
    }, {
      onSuccess: () => setShowTerminateModal(false),
    });
  };

  // Map backend history entries to the DealAuditLog frontend type
  const auditLogs: DealAuditLog[] = history.map(h => ({
    id:            h.id,
    activity_type: h.type,
    title:         h.title,
    deal_id:       deal.id,
    stage:         h.stage,
    entered_at:    h.enteredAt,
    exited_at:     h.exitedAt,
    days_in_stage: h.daysInStage,
    changed_by:    h.changedById,
    changedBy:     h.changedBy,
    notes:         h.notes,
    effective_date: h.effectiveDate,
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
          {isTerminated && (
            <Badge variant="danger" size="sm">Terminated</Badge>
          )}
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
          {!isTerminated && currentStage === 'Closed Won' && (
            <Button
              size="sm"
              variant="danger"
              onClick={openTerminateModal}
            >
              <ShieldAlert size={14} /> Terminate Contract
            </Button>
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
                    onClick={() => handleStageClick('Closed Lost')}
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

            {/* Stage history — always visible */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <History size={14} className="text-[#3d5af1]" />
                <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Activity Log</span>
                {auditLogs.length > 0 && (
                  <Badge variant="neutral" size="sm">{auditLogs.length} entries</Badge>
                )}
              </div>
              <DealHistory logs={auditLogs} />
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <User size={14} className="text-[#3d5af1]" />
                <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Client Contacts</span>
                <Badge variant="neutral" size="sm">{deal.client?.contacts?.length || 0}</Badge>
              </div>
              {(deal.client?.contacts?.length || 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deal.client?.contacts?.map((contact) => (
                    <div key={contact.id} className="p-4 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-[#1a1d2e]">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-xs text-[#8b90a8]">{contact.designation || contact.decision_rank}</div>
                        </div>
                        {contact.is_primary && <Badge variant="info" size="sm">Primary</Badge>}
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs text-[#4a5068]">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-[#8b90a8]" />
                          <span>{contact.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-[#8b90a8]" />
                          <span>{contact.number || 'No phone number'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#8b90a8]">No client contacts linked yet.</div>
              )}
            </Card>

            {/* Stage confirm modal — with mandatory remarks + action plan */}
            {stageConfirm && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#f4f6fb] border border-[#d1d5e8] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                  <h3 className="font-bold font-display text-[#1a1d2e] mb-1">Move to {stageConfirm}?</h3>
                  <p className="text-sm text-[#4a5068] mb-4">
                    {STAGE_CHANGE_CONFIRM[stageConfirm] || `Move "${deal.deal_name}" from ${currentStage} to ${stageConfirm}.`}
                  </p>

                  {stageConfirm === 'Closed Lost' && (
                    <div className="mb-3 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">
                      Remarks must explain why this deal was lost.
                    </div>
                  )}

                  {/* Remarks — mandatory */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-[#4a5068] mb-1">
                      Remarks <span className="text-[#e11d48]">*</span>
                    </label>
                    <Textarea
                      value={stageRemarks}
                      onChange={e => setStageRemarks(e.target.value)}
                      rows={3}
                      placeholder="Why is this deal moving? Key context, client feedback, blockers..."
                    />
                    {!stageRemarks.trim() && (
                      <p className="text-[10px] text-[#e11d48] mt-1">Required — explain the reason for this stage change</p>
                    )}
                  </div>

                  {/* Action Plan — mandatory */}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-[#4a5068] mb-1">
                      Action Plan <span className="text-[#e11d48]">*</span>
                    </label>
                    <Textarea
                      value={stageActionPlan}
                      onChange={e => setStageActionPlan(e.target.value)}
                      rows={3}
                      placeholder="Next steps: follow-up calls, deliverables, deadlines..."
                    />
                    {!stageActionPlan.trim() && (
                      <p className="text-[10px] text-[#e11d48] mt-1">Required — describe the next steps for this deal</p>
                    )}
                  </div>

                  {/* Contract link — required for Closed Won (Rev 8) */}
                  {stageConfirm === 'Closed Won' && (
                    <div className="mb-3">
                      <Input
                        label="Contract Link *"
                        value={contractLink}
                        onChange={e => setContractLink(e.target.value)}
                        placeholder="https://..."
                      />
                      {!contractLink.trim() && (
                        <p className="text-[10px] text-[#E11D48] mt-1">Required — attach the signed contract before marking as Closed Won</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2 border-t border-[#e2e6f0]">
                    <Button variant="secondary" size="sm" onClick={() => setStageConfirm(null)}>Cancel</Button>
                    <Button
                      variant={stageConfirm === 'Closed Lost' ? 'danger' : stageConfirm === 'Closed Won' ? 'success' : 'primary'}
                      size="sm"
                      onClick={confirmStageChange}
                      disabled={
                        stageMutation.isPending ||
                        !stageRemarks.trim() ||
                        !stageActionPlan.trim() ||
                        (stageConfirm === 'Closed Won' && !contractLink.trim())
                      }
                    >
                      {stageMutation.isPending ? 'Saving...' : `Confirm — ${stageConfirm}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {showTerminateModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white border border-[#e2e6f0] rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

                  {/* Modal header */}
                  <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-[#f0f2f8]">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.14)] flex items-center justify-center flex-shrink-0">
                      <ShieldAlert size={18} className="text-[#E11D48]" />
                    </div>
                    <div>
                      <h3 className="font-bold font-display text-[#1a1d2e] text-[15px] leading-snug">Terminate Contract</h3>
                      <p className="text-[13px] text-[#8b90a8] mt-0.5">
                        This is a permanent action and cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTerminateModal(false)}
                      className="ml-auto p-1.5 rounded-lg text-[#8b90a8] hover:text-[#1a1d2e] hover:bg-[#f4f6fb] transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="px-6 py-4 flex flex-col gap-4">
                    {/* Impact callout */}
                    <div className="rounded-xl border border-[rgba(244,63,94,0.16)] bg-[rgba(244,63,94,0.04)] px-4 py-3">
                      <p className="text-[12px] text-[#be123c] leading-relaxed">
                        Terminating this contract will stop revenue recognition after the effective date, and log a contract-termination event in the activity log for churn and loss analysis.
                      </p>
                    </div>

                    <Input
                      label="Termination Effective Date *"
                      type="date"
                      value={terminationDate}
                      onChange={e => setTerminationDate(e.target.value)}
                      required
                    />

                    <Input
                      label="Termination Reason *"
                      value={terminationReason}
                      onChange={e => setTerminationReason(e.target.value)}
                      placeholder="e.g. Client requested early cancellation"
                      required
                    />

                    <Textarea
                      label="Notes (optional)"
                      value={terminationNotes}
                      onChange={e => setTerminationNotes(e.target.value)}
                      rows={3}
                      placeholder="Additional details for churn and loss analysis..."
                    />

                    {terminateMutation.isError && (
                      <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-[12px] text-[#e11d48]">
                        Failed to terminate this contract. Please check the date and try again.
                      </div>
                    )}
                  </div>

                  {/* Modal footer */}
                  <div className="flex gap-2 px-6 pb-6 pt-2 border-t border-[#f0f2f8]">
                    <Button variant="secondary" size="md" onClick={() => setShowTerminateModal(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      onClick={confirmTermination}
                      loading={terminateMutation.isPending}
                      disabled={terminateMutation.isPending || !terminationDate || !terminationReason.trim()}
                      className="flex-1 bg-[#E11D48] border-[#E11D48] text-white hover:bg-[#BE123C] hover:border-[#BE123C]"
                    >
                      {terminateMutation.isPending ? 'Terminating...' : 'Confirm Termination'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks — sourced from current DealAuditLog (Rev 1) */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-[#3d5af1]" />
                <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Remarks</span>
                {!currentRemarks.trim() && !isClosed && <Badge variant="danger" size="sm">Required for Closed Lost</Badge>}
              </div>
              {editing ? (
                <Textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} rows={4} placeholder="Add deal notes, client context, and progress updates..." />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {currentRemarks || <span className="text-[#8b90a8] italic">No remarks yet</span>}
                </p>
              )}
            </Card>

            {/* Action Plan — sourced from current DealAuditLog (Rev 2) */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[#059669]" />
                  <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Action Plan</span>
                </div>
                {currentActionPlanDueDate && (
                  <Badge variant={new Date(currentActionPlanDueDate) < new Date() ? 'danger' : 'neutral'} size="sm">
                    Due {formatDate(currentActionPlanDueDate)}
                  </Badge>
                )}
              </div>
              {editing ? (
                <Textarea value={editActionPlan} onChange={e => setEditActionPlan(e.target.value)} rows={3} placeholder="Next steps, action items..." />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {currentActionPlan || <span className="text-[#8b90a8] italic">No action plan set</span>}
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
                  { label: 'Contract Start',   date: deal.start_date,           icon: <Calendar size={12} /> },
                  deal.due_date && { label: 'Contract End', date: deal.due_date, icon: <Calendar size={12} />, highlight: true },
                  deal.terminated_at && { label: 'Terminated On', date: deal.terminated_at, icon: <AlertTriangle size={12} />, warning: true },
                  deal.closed_date && { label: 'Actual Close', date: deal.closed_date, icon: <CheckCircle size={12} /> },
                  currentActionPlanDueDate && {
                    label: 'Action Plan Due', date: currentActionPlanDueDate,
                    icon: <Clock size={12} />,
                    warning: new Date(currentActionPlanDueDate) < new Date(),
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
              <div className="mb-4 pb-4 border-b border-[#f0f2f8]">
                <Select
                  label="Primary Contact for Deal"
                  value={primaryContactId}
                  onChange={(e) => setPrimaryContactId(e.target.value)}
                  options={clientContactOptions}
                  disabled={(deal.client?.contacts?.length ?? 0) === 0 || updateMutation.isPending}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#8b90a8]">
                    {(deal.client?.contacts?.length ?? 0) === 0
                      ? 'This client has no contacts yet.'
                      : 'Change which client contact is marked as primary for this deal.'}
                  </span>
                  {(deal.client?.contacts?.length ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updateMutation.isPending || primaryContactId === (currentPrimaryDealContact?.contact.id ?? '__NONE__')}
                      onClick={() => updateMutation.mutate({
                        id: deal.id,
                        data: {
                          primaryContactId: primaryContactId === '__NONE__' ? null : primaryContactId,
                        },
                      })}
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save Contact'}
                    </Button>
                  )}
                </div>
              </div>
              {deal.bd && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#f0f2f8]">
                  <Avatar name={`${deal.bd.firstName} ${deal.bd.lastName}`} />
                  <div>
                    <div className="text-xs font-semibold text-[#1a1d2e]">{deal.bd.firstName} {deal.bd.lastName}</div>
                    <div className="text-[10px] text-[#8b90a8]">BD Owner</div>
                  </div>
                </div>
              )}
              {/* Primary Contact */}
              {deal.dealContacts && deal.dealContacts.length > 0 && (() => {
                const primary = deal.dealContacts.find((dc: any) => dc.isPrimary) || deal.dealContacts[0];
                const contact = primary?.contact;
                return contact ? (
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#f0f2f8]">
                    <div className="w-8 h-8 rounded-full bg-[#eef1fe] flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-[#3d5af1]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d2e]">{contact.firstName} {contact.lastName}</div>
                      <div className="text-[10px] text-[#8b90a8]">Primary Contact{contact.designation ? ` · ${contact.designation}` : ''}</div>
                      {contact.email && <div className="text-[10px] text-[#3d5af1] truncate">{contact.email}</div>}
                      {contact.number && <div className="text-[10px] text-[#8b90a8]">{contact.number}</div>}
                    </div>
                  </div>
                ) : null;
              })()}
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
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Contract</div>
                {isTerminated && (
                  <div className="mb-3 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2">
                    <div className="text-xs font-semibold text-[#e11d48]">Contract terminated early</div>
                    <div className="mt-1 text-[11px] text-[#be123c]">
                      {deal.termination_reason || 'No termination reason recorded'}
                    </div>
                    {deal.termination_notes && (
                      <div className="mt-1 text-[11px] text-[#be123c] whitespace-pre-wrap">{deal.termination_notes}</div>
                    )}
                  </div>
                )}
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
