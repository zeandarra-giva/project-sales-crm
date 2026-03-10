import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Calendar, Clock, FileText, CheckCircle,
  AlertTriangle, Edit2, Save, X, ChevronRight, TrendingUp,
} from 'lucide-react';
import { Card, Button, Badge, Textarea, Input, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { MOCK_DEALS, PIPELINE_STAGES } from '../mockData';
import { formatCurrency, formatDate, getStageColor, cn } from '../lib/utils';
import type { PipelineStage } from '../types/index';

const STAGE_CHANGE_CONFIRM = {
  'Closed Won': 'Are you sure you want to mark this deal as Closed Won? This action records the contract as signed.',
  'Closed Lost': 'Moving to Closed Lost is irreversible. Please ensure remarks explain why the deal was lost.',
};

export default function DealDetail() {
  const { id } = useParams();
  const deal = MOCK_DEALS.find(d => d.id === id) || MOCK_DEALS[1];
  const [currentStage, setCurrentStage] = useState<PipelineStage>(deal.stage);
  const [remarks, setRemarks] = useState(deal.remarks);
  const [actionPlan, setActionPlan] = useState(deal.action_plan);
  const [editing, setEditing] = useState(false);
  const [stageConfirm, setStageConfirm] = useState<PipelineStage | null>(null);
  const [contractLink, setContractLink] = useState(deal.contract_link || '');

  const handleStageClick = (stage: PipelineStage) => {
    if (stage === currentStage) return;
    if (stage === 'Closed Won' || stage === 'Closed Lost') {
      setStageConfirm(stage);
    } else {
      setCurrentStage(stage);
    }
  };

  const confirmStageChange = () => {
    if (!stageConfirm) return;
    if (stageConfirm === 'Closed Lost' && !remarks.trim()) {
      alert('Remarks are required before closing as Lost.');
      return;
    }
    setCurrentStage(stageConfirm);
    setStageConfirm(null);
  };

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
          <Badge variant={deal.lead_source === 'Inbound' ? 'success' : deal.lead_source === 'Outbound' ? 'info' : 'warning'} size="sm">
            {deal.lead_source}
          </Badge>
          {editing ? (
            <>
              <Button size="sm" onClick={() => setEditing(false)}>
                <Save size={14} /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={14} />
              </Button>
            </>
          ) : (
            !isClosed && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Edit2 size={14} /> Edit
              </Button>
            )
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
                  {stageConfirm === 'Closed Lost' && (
                    <div className="mb-4 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">
                      Deal remarks must be filled before closing as Lost.
                    </div>
                  )}
                  {stageConfirm === 'Closed Won' && (
                    <div className="mb-4">
                      <Input
                        label="Contract Link (required)"
                        value={contractLink}
                        onChange={e => setContractLink(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setStageConfirm(null)}>Cancel</Button>
                    <Button
                      variant={stageConfirm === 'Closed Lost' ? 'danger' : 'success'}
                      size="sm"
                      onClick={confirmStageChange}
                    >
                      Confirm — {stageConfirm}
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
                {[
                  { stage: 'Inquiry', entered: '2025-11-01', exited: '2025-11-03', days: 2 },
                  { stage: 'Prospecting', entered: '2025-11-03', exited: '2025-11-10', days: 7 },
                  { stage: 'Discovery', entered: '2025-11-10', exited: '2025-11-25', days: 15 },
                  { stage: 'Proposal Sent', entered: '2025-11-25', exited: '2026-01-15', days: 51 },
                  { stage: deal.stage, entered: '2026-01-15', exited: undefined, days: deal.days_in_stage },
                ].map((h, i) => (
                  <div key={i} className="flex gap-4 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: getStageColor(h.stage as PipelineStage) }} />
                      {i < 4 && <div className="w-px flex-1 bg-[#f4f6fb] mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#1a1d2e]">{h.stage}</span>
                        <span className="text-xs text-[#8b90a8]">{h.days}d</span>
                      </div>
                      <span className="text-[10px] text-[#8b90a8]">
                        {formatDate(h.entered)}{h.exited ? ` → ${formatDate(h.exited)}` : ' · current'}
                      </span>
                    </div>
                  </div>
                ))}
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
                  <Avatar name={`${deal.bd.firstName} ${deal.bd.lastName}`} />
                  <div>
                    <div className="text-xs font-semibold text-[#1a1d2e]">{deal.bd.firstName} {deal.bd.lastName}</div>
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
    </div>
  );
}
