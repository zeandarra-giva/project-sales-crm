import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, Button, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import { useAuthStore } from '../store/authStore';
import { usePayments, useCreatePayment } from '../hooks/usePayments';
import { useDeals } from '../hooks/useDeals';
import { useBDList } from '../hooks/useReports';
import { formatCurrency, formatDate } from '../lib/utils';

interface Payment {
  id: string;
  dealId: string;
  amount: number;
  deal?: any;
  date: any;
}

type PaymentDraft = { deal_id: string; amount: string; };
const emptyDraft = (): PaymentDraft => ({ deal_id: '', amount: '' });

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [bdFilter, setBdFilter] = useState(user?.role === 'SALES_MANAGER' ? 'All' : (user?.id ?? 'All'));
  const [statusFilter, setStatusFilter] = useState('All');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<PaymentDraft>(emptyDraft());

  // Edit modal
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editDraft, setEditDraft] = useState<PaymentDraft>(emptyDraft());

  // Delete confirm
  const [deleting, setDeleting] = useState<Payment | null>(null);

  const isManager = user?.role === 'SALES_MANAGER';
  const { data: bdReps = [] } = useBDList();
  const { data: rawDeals } = useDeals();
  const { data: apiPayments = [], isLoading: loadingPayments } = usePayments();
  const { mutate: createPayment } = useCreatePayment();

  const dealsData: any[] = Array.isArray(rawDeals) ? rawDeals : (rawDeals as any)?.data || [];
  const closedDeals = dealsData.filter((d: any) => d.stage?.name === 'Closed Won' || d.isClosed);
  const payments: Payment[] = apiPayments || [];

  const filtered = payments.filter(p => {
    // We don't have BD info directly on payment currently without deep relation, so filter is basic
    return true;
  });

  const totalReceived = filtered.reduce((s: number, p: Payment) => s + Number(p.amount), 0);
  const totalPending = 0;

  // ── Add ─────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!addDraft.deal_id || !addDraft.amount) return;
    createPayment({
      dealId: addDraft.deal_id,
      amount: parseFloat(addDraft.amount),
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setAddDraft(emptyDraft());
      }
    });
  };

  // ── Edit ─────────────────────────────────────────────────────────
  const openEdit = (p: Payment) => {
    // setEditing(p);
    // setEditDraft({ deal_id: p.dealId, amount: String(p.amount) });
    alert("Editing payments is not supported by the backend yet.");
  };

  const handleEdit = () => {
    setEditing(null);
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = () => {
    setDeleting(null);
    alert("Deleting payments is not supported by the backend yet.");
  };

  const dealForId = (id: string) => dealsData.find((d: any) => d.id === id);

  const DraftFields = ({ draft, setDraft }: { draft: PaymentDraft; setDraft: (d: PaymentDraft) => void }) => (
    <>
      <Select
        label="Deal"
        value={draft.deal_id}
        onChange={e => setDraft({ ...draft, deal_id: e.target.value })}
        options={closedDeals.map((d: any) => ({ value: d.id, label: d.dealName || d.deal_name }))}
        placeholder="Select closed deal..."
        required
      />
      <div className="grid grid-cols-1 gap-3">
        <Input
          label="Amount (PHP)"
          type="number"
          value={draft.amount}
          onChange={e => setDraft({ ...draft, amount: e.target.value })}
          placeholder="85000"
          required
        />
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Payments"
        subtitle="Monthly subscription tracking"
        action={{ label: 'Add Payment', onClick: () => { setAddDraft(emptyDraft()); setShowAdd(true); } }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 text-center">
            <div className="text-xs text-[#8b90a8] mb-1">Total Received</div>
            <div className="text-2xl font-bold font-display text-[#059669]">{formatCurrency(totalReceived, true)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-[#8b90a8] mb-1">Pending</div>
            <div className="text-2xl font-bold font-display text-[#d97706]">{formatCurrency(totalPending, true)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs text-[#8b90a8] mb-1">Total Entries</div>
            <div className="text-2xl font-bold font-display text-[#1a1d2e]">{filtered.length}</div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {isManager && (
            <select
              value={bdFilter}
              onChange={e => setBdFilter(e.target.value)}
              className="h-8 bg-white border border-[#e2e6f0] rounded-lg px-3 text-xs text-[#4a5068] focus:outline-none"
            >
              <option value="All">All BD Members</option>
              {bdReps.map((b: any) => <option key={b.id} value={b.id}>{b.firstName || b.first_name} {b.lastName || b.last_name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl p-1">
            {['All', 'Received', 'Pending'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${statusFilter === s ? 'bg-white text-[#3d5af1] border border-[#c7d0fb] shadow-sm' : 'text-[#8b90a8] hover:text-[#4a5068]'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        <Card className="p-5">
          <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Payment Log</div>

          {/* Header row */}
          <div className={`grid gap-4 pb-2 mb-1 border-b border-[#e2e6f0] text-[10px] text-[#8b90a8] uppercase tracking-wider ${isManager ? 'grid-cols-13' : 'grid-cols-11'}`}
            style={{ gridTemplateColumns: isManager ? '3fr 2fr 2fr 2fr 2fr 1fr' : '4fr 2fr 2fr 2fr 1fr' }}>
            <div>Deal</div>
            {isManager && <div>BD</div>}
            <div>Amount</div>
            <div>Date</div>
            <div>Status</div>
            <div />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#8b90a8]">No payments match the current filters</div>
          ) : (
            filtered.map((payment: Payment) => {
              const deal = payment.deal || dealForId(payment.dealId);
              return (
                <div
                  key={payment.id}
                  className="grid gap-4 py-3 border-b border-[#f0f2f8] items-center group"
                  style={{ gridTemplateColumns: isManager ? '3fr 2fr 2fr 2fr 2fr 1fr' : '4fr 2fr 2fr 2fr 1fr' }}
                >
                  <div>
                    <div className="text-xs font-medium text-[#1a1d2e] truncate">{deal?.dealName || deal?.deal_name || '—'}</div>
                    <div className="text-[10px] text-[#8b90a8]">{deal?.client?.name || ''}</div>
                  </div>
                  {isManager && (
                    <div className="text-xs text-[#4a5068]">{'—'}</div>
                  )}
                  <div className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(payment.amount)}</div>
                  <div className="text-xs text-[#4a5068]">{payment.date ? `${payment.date.month}/${payment.date.year}` : 'N/A'}</div>
                  <div>
                    <Badge variant={'success'} size="sm">Received</Badge>
                  </div>
                  {/* Row actions */}
                  <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(payment)}
                      className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-all"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeleting(payment)}
                      className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#e11d48] hover:bg-[#fff1f2] transition-all"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* ── Add Modal ────────────────────────────────────────────────── */}
      {showAdd && (
        <EditModal title="Add Payment" onClose={() => setShowAdd(false)} onSave={handleAdd} saveLabel="Add Payment">
          <DraftFields draft={addDraft} setDraft={setAddDraft} />
        </EditModal>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editing && (
        <EditModal title="Edit Payment" onClose={() => setEditing(null)} onSave={handleEdit}>
          <DraftFields draft={editDraft} setDraft={setEditDraft} />
        </EditModal>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 shadow-xl animate-fade-in">
            <h2 className="font-bold text-sm font-display text-[#1a1d2e] mb-2">Delete Payment?</h2>
            <p className="text-xs text-[#4a5068] mb-5">
              Remove the <strong>{formatCurrency(deleting?.amount || 0)}</strong> payment? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
