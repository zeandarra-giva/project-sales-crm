import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ExternalLink, Calendar, Clock, FileText, CheckCircle,
  AlertTriangle, Edit2, Save, X, ChevronRight, TrendingUp, Trash2, Pencil,
} from 'lucide-react';
import { Card, Button, Badge, Textarea, Input, Avatar, Select } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useDeal, useDealHistory, useDeals } from '../hooks/useDeals';
import { dealsApi } from '../api/deals';
import { formatCurrency, formatDate, getStageColor, cn } from '../lib/utils';
import type { PipelineStage } from '../types/index';

const PIPELINE_STAGES = [
  { id: '1', name: 'Inquiry' as PipelineStage, probability: 10, color: '#64748b' },
  { id: '2', name: 'Prospecting' as PipelineStage, probability: 20, color: '#3b82f6' },
  { id: '3', name: 'Discovery' as PipelineStage, probability: 40, color: '#8b5cf6' },
  { id: '4', name: 'Proposal Sent' as PipelineStage, probability: 60, color: '#f59e0b' },
  { id: '5', name: 'Negotiation' as PipelineStage, probability: 75, color: '#f97316' },
  { id: '6', name: 'Closed Won' as PipelineStage, probability: 100, color: '#10b981' },
  { id: '7', name: 'Closed Lost' as PipelineStage, probability: 0, color: '#e11d48' },
];

const STAGE_CHANGE_CONFIRM = {
  'Closed Won': 'Are you sure you want to mark this deal as Closed Won? This action records the contract as signed.',
  'Closed Lost': 'Moving to Closed Lost is irreversible. Please ensure remarks explain why the deal was lost.',
};

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: deal, isLoading, refetch } = useDeal(id!);
  const { data: historyData } = useDealHistory(id!);
  const { updateStage, updateDeal, isUpdating } = useDeals();

  const [currentStage, setCurrentStage] = useState<PipelineStage>('Inquiry');
  const [remarks, setRemarks] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [contractLink, setContractLink] = useState('');
  const [finalProposedValue, setFinalProposedValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [stageConfirm, setStageConfirm] = useState<PipelineStage | null>(null);
  const [stageError, setStageError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit deal fields
  const [editDraft, setEditDraft] = useState({
    deal_name: '', monthly_subscription: '', duration: '', due_date: '', start_date: '',
    lead_source: '', proposal_link: '',
  });
  const [showEditDeal, setShowEditDeal] = useState(false);

  useEffect(() => {
    if (deal) {
      setCurrentStage(deal.stage);
      setRemarks(deal.remarks ?? '');
      setActionPlan(deal.action_plan ?? '');
      setContractLink(deal.contract_link ?? '');
    }
  }, [deal]);

  const handleStageClick = (stage: PipelineStage) => {
    if (stage === currentStage) return;
    setStageConfirm(stage);
    setStageError('');
  };

  const confirmStageChange = async () => {
    if (!stageConfirm) return;
    if (stageConfirm === 'Closed Lost' && !remarks.trim()) {
      setStageError('Remarks are required before closing as Lost.');
      return;
    }
    if (stageConfirm === 'Closed Won' && !contractLink.trim()) {
      setStageError('Contract link is required to close as Won.');
      return;
    }
    try {
      await updateStage({
        id: id!,
        stage: stageConfirm,
        notes: stageNotes || undefined,
        remarks: stageConfirm === 'Closed Lost' ? remarks : undefined,
        contractLink: stageConfirm === 'Closed Won' ? contractLink : undefined,
        finalProposedValue: finalProposedValue ? parseFloat(finalProposedValue) : undefined,
      });
      setCurrentStage(stageConfirm);
      setStageConfirm(null);
      setStageNotes('');
      refetch();
      // Trigger real-time notification refresh
      setTimeout(() => qc.invalidateQueries({ queryKey: ['notifications'] }), 800);
    } catch (err: any) {
      setStageError(err?.response?.data?.error ?? 'Failed to update stage');
    }
  };

  const openEditDeal = () => {
    setEditDraft({
      deal_name: deal!.deal_name,
      monthly_subscription: String(deal!.monthly_subscription),
      duration: String(deal!.duration),
      due_date: deal!.due_date ? new Date(deal!.due_date).toISOString().split('T')[0] : '',
      start_date: deal!.start_date ? new Date(deal!.start_date).toISOString().split('T')[0] : '',
      lead_source: deal!.lead_source ?? 'OUTBOUND',
      proposal_link: deal!.proposal_link ?? '',
    });
    setShowEditDeal(true);
  };

  const saveEditDeal = async () => {
    try {
      const monthly = Number(editDraft.monthly_subscription);
      const dur = Number(editDraft.duration);
      await updateDeal({
        id: id!, data: {
          deal_name: editDraft.deal_name,
          monthly_subscription: monthly,
          duration: dur,
          revenue: monthly * dur,
          due_date: editDraft.due_date || undefined,
          start_date: editDraft.start_date || undefined,
          lead_source: editDraft.lead_source as any,
          proposal_link: editDraft.proposal_link || undefined,
        }
      });
      setShowEditDeal(false);
      refetch();
    } catch { alert('Failed to update deal'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dealsApi.delete(id!);
      navigate('/pipeline');
    } catch {
      alert('Delete failed — DELETE method may not be enabled yet in Motia. You can hard-delete via the database.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateDeal({ id: id!, data: { remarks, action_plan: actionPlan, contract_link: contractLink } });
      setEditing(false);
      refetch();
    } catch {
      alert('Failed to save changes');
    }
  };

  if (isLoading || !deal) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-[#f4f6fb] flex-shrink-0">
          <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors"><ArrowLeft size={16} /></Link>
          <h1 className="font-bold text-base font-display text-[#1a1d2e]">{isLoading ? 'Loading…' : 'Deal not found'}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-[#8b90a8]">
          {isLoading ? 'Loading deal…' : <Button onClick={() => navigate('/pipeline')}>Back to Pipeline</Button>}
        </div>
      </div>
    );
  }

  const stageIndex = PIPELINE_STAGES.findIndex(s => s.name === currentStage);
  const isClosed = ['Closed Won', 'Closed Lost'].includes(currentStage);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-[#f4f6fb] flex-shrink-0">
        <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#ffffff0a]" />
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base font-display text-[#1a1d2e] truncate">{deal.deal_name}</h1>
          <div className="flex items-center gap-2 text-xs text-[#8b90a8]">
            <span>{deal.client?.name}</span>
            <span>·</span>
            <StagePill stage={currentStage} daysInStage={deal.days_in_stage} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={deal.lead_source === 'INBOUND' ? 'success' : deal.lead_source === 'OUTBOUND' ? 'info' : 'warning'} size="sm">
            {deal.lead_source}
          </Badge>
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                <Save size={14} /> {isUpdating ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={14} />
              </Button>
            </>
          ) : (
            <>
              {!isClosed && (
                <>
                  <Button size="sm" variant="secondary" onClick={openEditDeal}>
                    <Pencil size={14} /> Edit Deal
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    <Edit2 size={14} /> Notes
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)}
                className="text-[#e11d48] hover:bg-[#fff1f2]">
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Stage pipeline tracker */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline Stage</div>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {PIPELINE_STAGES.filter(s => !['Closed Lost'].includes(s.name)).map((stage, i, arr) => {
                  const isCurrent = stage.name === currentStage;
                  const isPast = PIPELINE_STAGES.findIndex(s => s.name === stage.name) < stageIndex;
                  const isLast = i === arr.length - 1;

                  return (
                    <div key={stage.id} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => !isClosed && handleStageClick(stage.name)}
                        disabled={isClosed}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          isCurrent && 'text-white border-transparent',
                          isPast && !isCurrent && 'text-[#8b90a8] border-[#e2e6f0] bg-[#f4f6fb]',
                          !isCurrent && !isPast && 'text-[#8b90a8] border-transparent hover:border-[#c8cfe8] hover:text-[#4a5068]',
                          isClosed && 'cursor-default'
                        )}
                        style={isCurrent ? { background: `${stage.color}20`, borderColor: `${stage.color}40`, color: stage.color } : {}}
                      >
                        {stage.name}
                      </button>
                      {!isLast && <ChevronRight size={12} className="text-[#8b90a8] mx-0.5 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Lost button */}
              {!isClosed && (
                <div className="mt-3 pt-3 border-t border-[#e2e6f0] flex items-center justify-between">
                  <button
                    onClick={() => setStageConfirm('Closed Lost')}
                    className="text-xs text-[#e11d48] hover:text-[#c81d3e] transition-colors"
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

            {/* Stage confirm modal */}
            {stageConfirm && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#f4f6fb] border border-[#d1d5e8] rounded-2xl p-6 max-w-md w-full">
                  <h3 className="font-bold font-display text-[#1a1d2e] mb-2">
                    Move to {stageConfirm}?
                  </h3>
                  <p className="text-sm text-[#4a5068] mb-4">
                    {STAGE_CHANGE_CONFIRM[stageConfirm as keyof typeof STAGE_CHANGE_CONFIRM] || `Move "${deal.deal_name}" to ${stageConfirm}?`}
                  </p>
                  {stageError && (
                    <div className="mb-3 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">{stageError}</div>
                  )}
                  {stageConfirm === 'Closed Lost' && (
                    <div className="mb-3 flex flex-col gap-3">
                      <Textarea
                        label="Remarks (required — explain why deal was lost)"
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        rows={3}
                        placeholder="Budget constraints, competitor won, timing..."
                      />
                      <Input
                        label="Final Proposed Value (optional)"
                        type="number"
                        value={finalProposedValue}
                        onChange={e => setFinalProposedValue(e.target.value)}
                        placeholder="85000"
                      />
                    </div>
                  )}
                  {stageConfirm === 'Closed Won' && (
                    <div className="mb-3">
                      <Input
                        label="Contract Link (required)"
                        value={contractLink}
                        onChange={e => setContractLink(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                  <div className="mb-4">
                    <Textarea
                      label="Stage transition notes (optional)"
                      value={stageNotes}
                      onChange={e => setStageNotes(e.target.value)}
                      rows={2}
                      placeholder="Notes about this stage change..."
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => { setStageConfirm(null); setStageError(''); }}>Cancel</Button>
                    <Button
                      variant={stageConfirm === 'Closed Lost' ? 'danger' : 'success'}
                      size="sm"
                      onClick={confirmStageChange}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating…' : `Confirm — ${stageConfirm}`}
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
                {!remarks.trim() && !isClosed && (
                  <Badge variant="danger" size="sm">Required for Closed Lost</Badge>
                )}
              </div>
              {editing ? (
                <Textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={4}
                  placeholder="Add deal notes, client context, and progress updates..."
                />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {remarks || <span className="text-[#8b90a8] italic">No remarks yet</span>}
                </p>
              )}
            </Card>

            {/* Action plan */}
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[#059669]" />
                  <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Action Plan</span>
                </div>
                {deal.action_plan_due_date && (
                  <Badge
                    variant={new Date(deal.action_plan_due_date) < new Date() ? 'danger' : 'neutral'}
                    size="sm"
                  >
                    Due {formatDate(deal.action_plan_due_date)}
                  </Badge>
                )}
              </div>
              {editing ? (
                <Textarea
                  value={actionPlan}
                  onChange={e => setActionPlan(e.target.value)}
                  rows={3}
                  placeholder="Next steps, action items..."
                />
              ) : (
                <p className="text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">
                  {actionPlan || <span className="text-[#8b90a8] italic">No action plan set</span>}
                </p>
              )}
            </Card>

            {/* Stage history */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Stage History</div>
              <div className="flex flex-col gap-0">
                {((historyData as any[]) ?? []).map((h: any, i: number) => {
                  const stageName = h.stage?.name ?? h.stage;
                  const daysVal = h.days_in_stage ?? h.days ?? '—';
                  const isLast = i === ((historyData as any[])?.length ?? 0) - 1;
                  return (
                    <div key={h.id ?? i} className="flex gap-4 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: getStageColor(stageName as PipelineStage) }} />
                        {!isLast && <div className="w-px flex-1 bg-[#f4f6fb] mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#1a1d2e]">{stageName}</span>
                          <span className="text-xs text-[#8b90a8]">{daysVal}d</span>
                        </div>
                        <span className="text-[10px] text-[#8b90a8]">
                          {h.entered_at ? formatDate(h.entered_at) : ''}
                          {h.exited_at ? ` → ${formatDate(h.exited_at)}` : ' · current'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!historyData || (historyData as any[]).length === 0) && (
                  <p className="text-xs text-[#8b90a8] text-center py-4">No history available</p>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Deal value */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Value</div>
              <div className="text-3xl font-bold font-display text-[#1a1d2e] mb-1">{formatCurrency(deal.revenue, true)}</div>
              <div className="text-xs text-[#8b90a8] mb-4">
                ₱{deal.monthly_subscription.toLocaleString()}/mo × {deal.duration} months
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b90a8]">Win probability</span>
                  <span className="font-semibold text-[#4a5068]">{deal.probability_pct}%</span>
                </div>
                <div className="h-1.5 bg-[#ffffff0a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${deal.probability_pct}%`, background: '#4f6ef7' }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b90a8]">Weighted value</span>
                  <span className="font-semibold text-[#4a5068]">
                    {formatCurrency(deal.revenue * (deal.probability_pct || 0) / 100, true)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Key dates */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Key Dates</div>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Deal Created', date: deal.start_date, icon: <Calendar size={12} /> },
                  { label: 'Expected Close', date: deal.due_date, icon: <Calendar size={12} />, highlight: true },
                  deal.closed_date && { label: 'Actual Close', date: deal.closed_date, icon: <CheckCircle size={12} /> },
                  deal.action_plan_due_date && { label: 'Action Plan Due', date: deal.action_plan_due_date, icon: <Clock size={12} />, warning: new Date(deal.action_plan_due_date) < new Date() },
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

            {/* BD & Client */}
            <Card className="p-5">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">People</div>
              {deal.bd && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#f0f2f8]">
                  <Avatar name={`${deal.bd.first_name} ${deal.bd.last_name}`} />
                  <div>
                    <div className="text-xs font-semibold text-[#1a1d2e]">{deal.bd.first_name} {deal.bd.last_name}</div>
                    <div className="text-[10px] text-[#8b90a8]">{deal.bd.role} · BD Owner</div>
                  </div>
                </div>
              )}
              {deal.client && (
                <div>
                  <div className="text-xs font-semibold text-[#1a1d2e]">{deal.client.name}</div>
                  <div className="text-[10px] text-[#8b90a8] mt-0.5">{deal.client.account_type} · {deal.client.industry?.name}</div>
                  <Badge variant="neutral" size="sm" className="mt-2">{deal.client.status}</Badge>
                </div>
              )}
            </Card>

            {/* Links */}
            {(deal.proposal_link || deal.contract_link) && (
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Documents</div>
                <div className="flex flex-col gap-2">
                  {deal.proposal_link && (
                    <a href={deal.proposal_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-[#3d5af1] hover:text-[#3d5af1] transition-colors">
                      <ExternalLink size={12} />
                      View Proposal
                    </a>
                  )}
                  {deal.contract_link && (
                    <a href={deal.contract_link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-[#059669] hover:text-[#047857] transition-colors">
                      <ExternalLink size={12} />
                      View Contract
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Deal Modal ─────────────────────────────────────── */}
      {showEditDeal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e2e6f0] rounded-2xl p-6 max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold font-display text-[#1a1d2e]">Edit Deal</h3>
              <button onClick={() => setShowEditDeal(false)} className="text-[#8b90a8] hover:text-[#1a1d2e]"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <Input label="Deal Name" value={editDraft.deal_name}
                onChange={e => setEditDraft(p => ({ ...p, deal_name: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Monthly Subscription (₱)" type="number" value={editDraft.monthly_subscription}
                  onChange={e => setEditDraft(p => ({ ...p, monthly_subscription: e.target.value }))} required />
                <Input label="Duration (months)" type="number" value={editDraft.duration}
                  onChange={e => setEditDraft(p => ({ ...p, duration: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Expected Close Date" type="date" value={editDraft.due_date}
                  onChange={e => setEditDraft(p => ({ ...p, due_date: e.target.value }))} />
                <Input label="Start Date" type="date" value={editDraft.start_date}
                  onChange={e => setEditDraft(p => ({ ...p, start_date: e.target.value }))} />
                <Select label="Lead Source" value={editDraft.lead_source}
                  onChange={e => setEditDraft(p => ({ ...p, lead_source: e.target.value }))}
                  options={[
                    { value: 'INBOUND', label: 'Inbound' },
                    { value: 'OUTBOUND', label: 'Outbound' },
                    { value: 'REFERRAL', label: 'Referral' },
                  ]} />
              </div>
              <Input label="Proposal Link (optional)" value={editDraft.proposal_link}
                onChange={e => setEditDraft(p => ({ ...p, proposal_link: e.target.value }))}
                placeholder="https://..." />
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <Button variant="secondary" size="sm" onClick={() => setShowEditDeal(false)}>Cancel</Button>
              <Button size="sm" onClick={saveEditDeal} disabled={isUpdating}>
                {isUpdating ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e2e6f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#fff1f2] flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-[#e11d48]" />
              </div>
              <div>
                <h3 className="font-bold font-display text-[#1a1d2e]">Delete Deal</h3>
                <p className="text-xs text-[#8b90a8]">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-[#4a5068] mb-5">
              Are you sure you want to delete <span className="font-semibold">"{deal.deal_name}"</span>? All stage history and audit logs will also be removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Deal'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}