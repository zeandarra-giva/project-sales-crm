import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '../components/layout/Header';
import { Card, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { paymentsApi } from '../api/payments';

interface Payment {
  id: string;
  amount: number;
  deal_id: string;
  date_id?: string;
  deal?: { id: string; deal_name: string; client?: { name: string }; stage?: { name: string }; monthly_subscription?: number; duration?: number };
  date?: { year: number; month_number: number; month: number };
}

type Draft = { dealId: string; amount: string; year: string; month: string };
const emptyDraft = (): Draft => ({
  dealId: '', amount: '',
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1),
});

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const YEAR_OPTIONS = [-1, 0, 1, 2].map(offset => {
  const y = String(new Date().getFullYear() + offset);
  return { value: y, label: y };
});

const PAYMENT_STAGES = ['Proposal Sent', 'Negotiation', 'Closed Won'];

const MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
  7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

// ─── DraftFields defined OUTSIDE parent to prevent cursor-reset on re-render ──
interface DraftFieldsProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  deals: any[];
  existingPayments: Payment[];
  excludeId?: string;
}

function DraftFields({ draft, setDraft, deals, existingPayments, excludeId }: DraftFieldsProps) {
  const selectedDeal = draft.dealId ? deals.find((d: any) => d.id === draft.dealId) : null;
  const monthlySub = selectedDeal ? Number(selectedDeal.monthly_subscription ?? 0) : 0;
  const duration = selectedDeal ? Number(selectedDeal.duration ?? 0) : 0;
  const totalContract = monthlySub * duration;

  // Payments already made for this deal (excluding current edit)
  const dealPayments = existingPayments.filter(p => p.deal_id === draft.dealId && p.id !== excludeId);
  const alreadyPaid = dealPayments.reduce((s, p) => s + Number(p.amount), 0);

  // Months already paid for the selected year
  const paidMonthsThisYear = new Set(
    dealPayments
      .filter(p => p.date?.year === Number(draft.year))
      .map(p => String(p.date?.month_number))
  );

  // Warn if existing payments were made at a different rate than current subscription
  const mismatchedPayments = dealPayments.filter(
    p => monthlySub > 0 && Number(p.amount) % monthlySub !== 0
  );
  const hasMismatch = mismatchedPayments.length > 0;

  const enteredAmount = parseFloat(draft.amount) || 0;
  const isMultiple = monthlySub > 0 && enteredAmount > 0 && enteredAmount % monthlySub !== 0;
  const wouldExceed = totalContract > 0 && (alreadyPaid + enteredAmount) > totalContract;
  const remaining = totalContract - alreadyPaid;

  const monthOptions = MONTHS.map(m => ({
    ...m,
    label: paidMonthsThisYear.has(m.value) ? `${m.label} ✓ (paid)` : m.label,
    disabled: paidMonthsThisYear.has(m.value),
  }));

  return (
    <>
      <Select
        label="Deal"
        value={draft.dealId}
        onChange={e => setDraft({ ...draft, dealId: e.target.value })}
        options={deals.map((d: any) => ({
          value: d.id,
          label: `${d.deal_name} — ${d.stage?.name ?? d.stage}`,
        }))}
        placeholder="Select deal..."
        required
      />

      {selectedDeal && (
        <div className="bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl px-4 py-3 text-xs flex gap-4 flex-wrap">
          <div><span className="text-[#8b90a8]">Monthly sub</span><div className="font-semibold text-[#1a1d2e] mt-0.5">{formatCurrency(monthlySub)}</div></div>
          <div><span className="text-[#8b90a8]">Duration</span><div className="font-semibold text-[#1a1d2e] mt-0.5">{duration} mo</div></div>
          <div><span className="text-[#8b90a8]">Total contract</span><div className="font-semibold text-[#1a1d2e] mt-0.5">{formatCurrency(totalContract)}</div></div>
          <div>
            <span className="text-[#8b90a8]">Remaining</span>
            <div className={`font-semibold mt-0.5 ${remaining <= 0 ? 'text-[#e11d48]' : 'text-[#059669]'}`}>
              {formatCurrency(remaining)}
            </div>
          </div>
        </div>
      )}

      <Input
        label="Amount (PHP)"
        type="number"
        value={draft.amount}
        onChange={e => setDraft({ ...draft, amount: e.target.value })}
        placeholder={monthlySub ? String(monthlySub) : '27000'}
        required
      />

      {isMultiple && (
        <div className="text-xs text-[#d97706] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2">
          ⚠️ Amount must be a multiple of ₱{monthlySub.toLocaleString()} (monthly subscription).
        </div>
      )}
      {wouldExceed && (
        <div className="text-xs text-[#e11d48] bg-[#fff1f2] border border-[#fecdd3] rounded-lg px-3 py-2">
          ❌ Exceeds total contract of ₱{totalContract.toLocaleString()}. Max remaining: ₱{remaining.toLocaleString()}
        </div>
      )}

      {hasMismatch && (
        <div className="text-xs text-[#7c3aed] bg-[#f5f3ff] border border-[#ddd6fe] rounded-lg px-3 py-2">
          ⚠️ Some existing payments ({mismatchedPayments.length}) don't match the current monthly subscription of ₱{monthlySub.toLocaleString()}. This may be because the subscription was updated. Those payments are kept as-is.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Year" value={draft.year} onChange={e => setDraft({ ...draft, year: e.target.value, month: '' })} options={YEAR_OPTIONS} required />
        <Select label="Month" value={draft.month} onChange={e => setDraft({ ...draft, month: e.target.value })} options={monthOptions} required />
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft());
  const [deleting, setDeleting] = useState<Payment | null>(null);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await paymentsApi.list();
      return (res as any).data ?? res;
    },
  });
  const payments: Payment[] = (paymentsData as any)?.payments ?? [];

  const { deals: allDeals } = useDeals({});
  const eligibleDeals = allDeals.filter((d: any) =>
    PAYMENT_STAGES.includes(d.stage?.name ?? d.stage)
  );

  const createMutation = useMutation({
    mutationFn: async (d: Draft) => {
      const res = await paymentsApi.create({
        dealId: d.dealId,
        amount: parseFloat(d.amount),
        year: Number(d.year),
        month: Number(d.month),
      });
      return (res as any).data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowAdd(false);
      setAddDraft(emptyDraft());
    },
  });

  const canSubmit = (d: Draft, excludeId?: string) => {
    if (!d.dealId || !d.amount || !d.year || !d.month) return false;
    const deal = eligibleDeals.find((x: any) => x.id === d.dealId) as any;
    const monthlySub = deal ? Number(deal.monthly_subscription ?? 0) : 0;
    const total = monthlySub * Number(deal?.duration ?? 0);
    const amount = parseFloat(d.amount);
    if (isNaN(amount) || amount <= 0) return false;
    if (monthlySub > 0 && amount % monthlySub !== 0) return false;
    const paid = payments
      .filter(p => p.deal_id === d.dealId && p.id !== excludeId)
      .reduce((s, p) => s + Number(p.amount), 0);
    if (total > 0 && paid + amount > total) return false;
    // Block if month already has a payment for this deal+year
    const monthAlreadyPaid = payments.some(p =>
      p.deal_id === d.dealId &&
      p.id !== excludeId &&
      p.date?.year === Number(d.year) &&
      String(p.date?.month_number) === d.month
    );
    if (monthAlreadyPaid) return false;
    return true;
  };

  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0);

  const dealForId = (id: string) => eligibleDeals.find((d: any) => d.id === id) as any;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Payments"
        subtitle="Monthly subscription tracking"
        action={{ label: 'Add Payment', onClick: () => { setAddDraft(emptyDraft()); setShowAdd(true); } }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="p-4 text-center">
            <div className="text-xs text-[#8b90a8] mb-1">Total Received</div>
            <div className="text-2xl font-bold font-display text-[#059669]">{formatCurrency(totalReceived, true)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-[#8b90a8] mb-1">Total Entries</div>
            <div className="text-2xl font-bold font-display text-[#1a1d2e]">{payments.length}</div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Payment Log</div>
          <div className="grid gap-4 pb-2 mb-1 border-b border-[#e2e6f0] text-[10px] text-[#8b90a8] uppercase tracking-wider"
            style={{ gridTemplateColumns: '4fr 2fr 2fr 1fr' }}>
            <div>Deal</div><div>Month</div><div>Amount</div><div />
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-sm text-[#8b90a8]">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#8b90a8]">No payments logged yet</div>
          ) : payments.map(payment => {
            const deal = payment.deal ?? (dealForId(payment.deal_id) as any);
            const stageName = deal?.stage?.name ?? '';
            const mn = payment.date?.month_number;
            const monthLabel = mn ? `${MONTH_NAMES[mn]} ${payment.date?.year}` : '—';
            return (
              <div key={payment.id} className="grid gap-4 py-3 border-b border-[#f0f2f8] items-center group"
                style={{ gridTemplateColumns: '4fr 2fr 2fr 1fr' }}>
                <div>
                  <div className="text-xs font-medium text-[#1a1d2e] truncate">
                    {deal?.deal_name ?? '—'}
                  </div>
                  <div className="text-[10px] text-[#8b90a8]">
                    {deal?.client?.name ?? ''}
                    {stageName && <span className="ml-1.5 text-[#a5b4fc]">· {stageName}</span>}
                  </div>
                </div>
                <div className="text-xs text-[#4a5068]">{monthLabel}</div>
                <div className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(payment.amount)}</div>
                <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setDeleting(payment)}
                    className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#e11d48] hover:bg-[#fff1f2] transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {showAdd && (
        <EditModal title="Add Payment" onClose={() => setShowAdd(false)}
          onSave={() => { if (canSubmit(addDraft)) createMutation.mutate(addDraft); }}
          saveLabel={createMutation.isPending ? 'Saving…' : 'Add Payment'}>
          <DraftFields draft={addDraft} setDraft={setAddDraft} deals={eligibleDeals} existingPayments={payments} />
          {createMutation.isError && (
            <div className="text-xs text-[#e11d48] bg-[#fff1f2] border border-[#fecdd3] rounded-lg px-3 py-2">
              Failed to save. Please try again.
            </div>
          )}
        </EditModal>
      )}

      {deleting && (
        <EditModal title="Delete Payment" onClose={() => setDeleting(null)}
          onSave={() => setDeleting(null)} saveLabel="Delete">
          <p className="text-sm text-[#4a5068]">
            Delete payment of <strong>{formatCurrency(deleting.amount)}</strong>?
          </p>
        </EditModal>
      )}
    </div>
  );
}