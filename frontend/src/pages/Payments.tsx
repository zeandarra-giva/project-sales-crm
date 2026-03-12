import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/index';
import { paymentsApi } from '../api/payments';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STAGE_PILL: Record<string, { color: string; bg: string; border: string }> = {
  'Proposal Sent': { color: 'text-[#d97706]', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]' },
  'Negotiation': { color: 'text-[#f97316]', bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]' },
  'Closed Won': { color: 'text-[#059669]', bg: 'bg-[#ecfdf5]', border: 'border-[#a7f3d0]' },
  'Closed Lost': { color: 'text-[#e11d48]', bg: 'bg-[#fff1f2]', border: 'border-[#fecdd3]' },
};
const DEFAULT_PILL = { color: 'text-[#8b90a8]', bg: 'bg-[#f4f6fb]', border: 'border-[#e2e6f0]' };

interface Payment {
  id: string;
  amount: number;
  deal_id: string;
  date?: { year: number; month_number: number };
  deal?: {
    deal_name: string;
    revenue: number;
    monthly_subscription: number;
    duration: number;
    client?: { name: string };
    stage?: { name: string } | string;
  };
}

interface DealGroup {
  dealId: string;
  dealName: string;
  clientName: string;
  stageName: string;
  isClosedWon: boolean;
  contractValue: number;
  monthlySubscription: number;
  payments: Payment[];
  totalReceived: number;
}

function buildGroups(raw: Payment[]): DealGroup[] {
  const map: Record<string, DealGroup> = {};
  for (const p of raw) {
    const dealId = p.deal_id;
    if (!dealId) continue;
    const stageName = typeof p.deal?.stage === 'object'
      ? (p.deal?.stage as any)?.name ?? '' : p.deal?.stage ?? '';
    if (!map[dealId]) {
      map[dealId] = {
        dealId,
        dealName: p.deal?.deal_name ?? 'Unknown',
        clientName: p.deal?.client?.name ?? '',
        stageName,
        isClosedWon: stageName === 'Closed Won',
        contractValue: Number(p.deal?.revenue ?? 0),
        monthlySubscription: Number(p.deal?.monthly_subscription ?? 0),
        payments: [],
        totalReceived: 0,
      };
    }
    map[dealId].payments.push(p);
    map[dealId].totalReceived += Number(p.amount);
  }
  return Object.values(map).map(g => ({
    ...g,
    payments: [...g.payments].sort((a, b) =>
      ((a.date?.year ?? 0) * 100 + (a.date?.month_number ?? 0)) -
      ((b.date?.year ?? 0) * 100 + (b.date?.month_number ?? 0))
    ),
  }));
}

function DealPaymentCard({
  group,
  onAmountUpdated,
}: {
  group: DealGroup;
  onAmountUpdated: (paymentId: string, newAmount: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const startEdit = (p: Payment) => {
    setEditingId(p.id);
    setEditValues(prev => ({ ...prev, [p.id]: String(p.amount) }));
    setEditErrors(prev => ({ ...prev, [p.id]: '' }));
  };

  const saveEdit = async (id: string) => {
    const n = parseFloat(editValues[id] ?? '');
    if (isNaN(n) || n < 0) {
      setEditErrors(prev => ({ ...prev, [id]: 'Enter a valid amount (0 or more)' }));
      return;
    }
    setSaving(id);
    try {
      await paymentsApi.update(id, { amount: n });
      onAmountUpdated(id, n);
      setEditingId(null);
    } catch (err: any) {
      setEditErrors(prev => ({ ...prev, [id]: err?.response?.data?.error ?? 'Failed to update' }));
    } finally {
      setSaving(null);
    }
  };

  const pill = STAGE_PILL[group.stageName] ?? DEFAULT_PILL;
  const pct = group.contractValue > 0 ? Math.min(100, (group.totalReceived / group.contractValue) * 100) : 0;
  const remaining = group.contractValue - group.totalReceived;

  return (
    <Card className="p-0 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#f9fafb] transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown size={14} className="text-[#8b90a8] flex-shrink-0" />
            : <ChevronRight size={14} className="text-[#8b90a8] flex-shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#1a1d2e] truncate">{group.dealName}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill.bg} ${pill.border} ${pill.color}`}>
                {group.stageName}
              </span>
            </div>
            <div className="text-xs text-[#8b90a8]">{group.clientName}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0 ml-4">
          {group.isClosedWon && (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-[#8b90a8]">Received</div>
                <div className="text-sm font-bold text-[#059669]">₱{group.totalReceived.toLocaleString()}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-[#8b90a8]">Remaining</div>
                <div className={`text-sm font-bold ${remaining > 0 ? 'text-[#e11d48]' : 'text-[#8b90a8]'}`}>
                  ₱{remaining.toLocaleString()}
                </div>
              </div>
            </>
          )}
          <div className="text-right">
            <div className="text-xs text-[#8b90a8]">Contract</div>
            <div className="text-sm font-bold text-[#1a1d2e]">₱{group.contractValue.toLocaleString()}</div>
          </div>
        </div>
      </button>

      {group.isClosedWon && (
        <div className="h-1 bg-[#f0f2f8]">
          <div className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : pct > 50 ? '#3d5af1' : '#f59e0b' }} />
        </div>
      )}

      {expanded && (
        <div className="divide-y divide-[#f0f2f8]">
          {group.payments.map(payment => {
            const monthNum = payment.date?.month_number ?? 1;
            const year = payment.date?.year ?? new Date().getFullYear();
            const received = Number(payment.amount);
            const expected = group.monthlySubscription;
            const isEditing = editingId === payment.id;
            const isSaving = saving === payment.id;

            return (
              <div key={payment.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#fafbff] transition-colors">
                <div className="w-16 flex-shrink-0">
                  <div className="text-sm font-semibold text-[#1a1d2e]">{MONTH_NAMES[monthNum - 1]}</div>
                  <div className="text-[10px] text-[#8b90a8]">{year}</div>
                </div>

                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#8b90a8]">₱</span>
                        <input
                          type="number"
                          value={editValues[payment.id] ?? ''}
                          onChange={e => setEditValues(prev => ({ ...prev, [payment.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(payment.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          disabled={isSaving}
                          className="w-24 px-2 py-1 text-sm border border-[#3d5af1] rounded-lg outline-none bg-white text-[#1a1d2e] font-medium disabled:opacity-50"
                        />
                        <button onClick={() => saveEdit(payment.id)} disabled={isSaving}
                          className="p-1 rounded-lg bg-[#3d5af1] text-white hover:bg-[#3451d1] disabled:opacity-50">
                          <Check size={11} />
                        </button>
                        <button onClick={() => setEditingId(null)} disabled={isSaving}
                          className="p-1 rounded-lg text-[#8b90a8] hover:text-[#1a1d2e] disabled:opacity-50">
                          <X size={11} />
                        </button>
                      </div>
                      {editErrors[payment.id] && <p className="text-[10px] text-[#e11d48]">{editErrors[payment.id]}</p>}
                      {isSaving && <p className="text-[10px] text-[#8b90a8]">Saving…</p>}
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        {group.isClosedWon ? (
                          <>
                            {received !== expected && (
                              <div className="text-[10px] text-[#8b90a8] line-through">₱{expected.toLocaleString()}</div>
                            )}
                            <div className={`text-sm font-bold ${received >= expected ? 'text-[#059669]' : received > 0 ? 'text-[#d97706]' : 'text-[#8b90a8]'}`}>
                              ₱{received.toLocaleString()}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-medium text-[#4a5068]">₱{received.toLocaleString()}</div>
                        )}
                      </div>
                      <button onClick={() => startEdit(payment)}
                        className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-colors">
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8f9fd]">
            {group.isClosedWon ? (
              <>
                <span className="text-xs text-[#8b90a8]">
                  {group.payments.filter(p => Number(p.amount) >= group.monthlySubscription).length} of {group.payments.length} months paid
                </span>
                <span className="text-xs font-semibold text-[#4a5068]">
                  ₱{group.totalReceived.toLocaleString()} / ₱{group.contractValue.toLocaleString()}
                  <span className="text-[#8b90a8] font-normal ml-1">({Math.round(pct)}%)</span>
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-[#8b90a8]">{group.payments.length} months scheduled</span>
                <span className="text-xs font-semibold text-[#4a5068]">₱{group.contractValue.toLocaleString()} total</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Payments() {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState('all');
  const [dealFilter, setDealFilter] = useState('all');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await paymentsApi.list();
      const data = ((res.data as any).payments ?? []) as Payment[];
      setPayments(data);
    } catch (e) {
      console.error('Failed to load payments', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Optimistically update a single payment's amount in local state
  const handleAmountUpdated = useCallback((paymentId: string, newAmount: number) => {
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, amount: newAmount } : p));
    qc.invalidateQueries({ queryKey: ['dashboard-bd'] });
    qc.invalidateQueries({ queryKey: ['dashboard-executive'] });
  }, [qc]);

  const dealGroups = buildGroups(payments);

  const stages = ['all', 'Proposal Sent', 'Negotiation', 'Closed Won'];
  const dealOptions = [{ id: 'all', name: 'All Deals' }, ...dealGroups.map(g => ({ id: g.dealId, name: g.dealName }))];

  const filtered = dealGroups
    .filter(g => stageFilter === 'all' || g.stageName === stageFilter)
    .filter(g => dealFilter === 'all' || g.dealId === dealFilter);

  const totalReceived = dealGroups.filter(g => g.isClosedWon).reduce((s, g) => s + g.totalReceived, 0);
  const totalScheduled = dealGroups.filter(g => !g.isClosedWon).reduce((s, g) => s + g.contractValue, 0);
  const totalContract = dealGroups.reduce((s, g) => s + g.contractValue, 0);

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-sm text-[#8b90a8]">Loading payments…</div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0 gap-4">
        <h1 className="font-bold text-base font-display text-[#1a1d2e] flex-shrink-0">Payments</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select value={dealFilter} onChange={e => setDealFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-[#e2e6f0] bg-white text-[#4a5068] outline-none cursor-pointer">
            {dealOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {stages.map(s => (
            <button key={s} onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${stageFilter === s
                  ? 'bg-[#eef1fe] border-[#c7d0fb] text-[#3d5af1]'
                  : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                }`}>
              {s === 'all' ? 'All Stages' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Received', sub: 'Closed Won only', value: totalReceived, color: 'text-[#059669]' },
            { label: 'Pipeline Scheduled', sub: 'Proposal Sent + Negotiation', value: totalScheduled, color: 'text-[#3d5af1]' },
            { label: 'Total Contract', sub: 'All active deals', value: totalContract, color: 'text-[#1a1d2e]' },
          ].map(item => (
            <Card key={item.label} className="p-4">
              <div className="text-xs text-[#8b90a8]">{item.label}</div>
              <div className="text-[10px] text-[#c8cfe8] mb-1">{item.sub}</div>
              <div className={`text-xl font-bold font-display ${item.color}`}>₱{item.value.toLocaleString()}</div>
            </Card>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#8b90a8]">
            {dealGroups.length === 0
              ? 'No payment schedules yet. Move a deal to Proposal Sent to auto-generate monthly payments.'
              : 'No deals match this filter.'}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(g => (
              <DealPaymentCard key={g.dealId} group={g} onAmountUpdated={handleAmountUpdated} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}