import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, Button, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import { MOCK_DEALS, MOCK_BDS, MOCK_CLIENTS } from '../mockData';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

interface Payment {
  id: string;
  deal_id: string;
  bd_id: string;
  amount: number;
  date: string;
  status: 'Received' | 'Pending';
}

const INITIAL_PAYMENTS: Payment[] = [
  { id: 'pay-001', deal_id: 'd-001', bd_id: 'bd-001', amount: 85000, date: '2025-12-01', status: 'Received' },
  { id: 'pay-002', deal_id: 'd-001', bd_id: 'bd-001', amount: 85000, date: '2026-01-01', status: 'Received' },
  { id: 'pay-003', deal_id: 'd-001', bd_id: 'bd-001', amount: 85000, date: '2026-02-01', status: 'Received' },
  { id: 'pay-004', deal_id: 'd-001', bd_id: 'bd-001', amount: 85000, date: '2026-03-01', status: 'Pending' },
];

type PaymentDraft = { deal_id: string; bd_id: string; amount: string; date: string; status: 'Received' | 'Pending' };
const emptyDraft = (bdId: string): PaymentDraft => ({ deal_id: '', bd_id: bdId, amount: '', date: '', status: 'Pending' });

const STATUS_OPTIONS = [{ value: 'Received', label: 'Received' }, { value: 'Pending', label: 'Pending' }];

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [payments, setPayments]       = useState<Payment[]>(INITIAL_PAYMENTS);
  const [bdFilter, setBdFilter]       = useState(user?.role === 'Manager' ? 'All' : (user?.id ?? 'All'));
  const [statusFilter, setStatusFilter] = useState('All');

  // Add modal
  const [showAdd, setShowAdd]         = useState(false);
  const [addDraft, setAddDraft]       = useState<PaymentDraft>(emptyDraft(user?.id ?? ''));

  // Edit modal
  const [editing, setEditing]         = useState<Payment | null>(null);
  const [editDraft, setEditDraft]     = useState<PaymentDraft>(emptyDraft(user?.id ?? ''));

  // Delete confirm
  const [deleting, setDeleting]       = useState<Payment | null>(null);

  const isManager   = user?.role === 'Manager';
  const closedDeals = MOCK_DEALS.filter(d => d.stage === 'Closed Won');
  const bdReps      = MOCK_BDS.filter(b => b.role !== 'Manager');

  const filtered = payments.filter(p => {
    if (bdFilter !== 'All' && p.bd_id !== bdFilter) return false;
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    return true;
  });

  const totalReceived = filtered.filter(p => p.status === 'Received').reduce((s, p) => s + p.amount, 0);
  const totalPending  = filtered.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);

  // ── Add ─────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!addDraft.deal_id || !addDraft.amount || !addDraft.date) return;
    const p: Payment = {
      id: `pay-${Date.now()}`,
      deal_id: addDraft.deal_id,
      bd_id:   addDraft.bd_id || user?.id || '',
      amount:  parseFloat(addDraft.amount),
      date:    addDraft.date,
      status:  addDraft.status,
    };
    setPayments(prev => [p, ...prev]);
    setShowAdd(false);
    setAddDraft(emptyDraft(user?.id ?? ''));
  };

  // ── Edit ─────────────────────────────────────────────────────────
  const openEdit = (p: Payment) => {
    setEditing(p);
    setEditDraft({ deal_id: p.deal_id, bd_id: p.bd_id, amount: String(p.amount), date: p.date, status: p.status });
  };

  const handleEdit = () => {
    if (!editing) return;
    setPayments(prev => prev.map(p =>
      p.id === editing.id
        ? { ...p, deal_id: editDraft.deal_id, bd_id: editDraft.bd_id, amount: parseFloat(editDraft.amount), date: editDraft.date, status: editDraft.status }
        : p
    ));
    setEditing(null);
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleting) return;
    setPayments(prev => prev.filter(p => p.id !== deleting.id));
    setDeleting(null);
  };

  const dealForId = (id: string) => MOCK_DEALS.find(d => d.id === id);
  const bdForId   = (id: string) => MOCK_BDS.find(b => b.id === id);

  const DraftFields = ({ draft, setDraft }: { draft: PaymentDraft; setDraft: (d: PaymentDraft) => void }) => (
    <>
      <Select
        label="Deal"
        value={draft.deal_id}
        onChange={e => setDraft({ ...draft, deal_id: e.target.value })}
        options={closedDeals.map(d => ({ value: d.id, label: d.deal_name }))}
        placeholder="Select closed deal..."
        required
      />
      {isManager && (
        <Select
          label="BD Member"
          value={draft.bd_id}
          onChange={e => setDraft({ ...draft, bd_id: e.target.value })}
          options={bdReps.map(b => ({ value: b.id, label: `${b.first_name} ${b.last_name}` }))}
          placeholder="Select BD..."
          required
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Amount (PHP)"
          type="number"
          value={draft.amount}
          onChange={e => setDraft({ ...draft, amount: e.target.value })}
          placeholder="85000"
          required
        />
        <Input
          label="Date"
          type="date"
          value={draft.date}
          onChange={e => setDraft({ ...draft, date: e.target.value })}
          required
        />
      </div>
      <Select
        label="Status"
        value={draft.status}
        onChange={e => setDraft({ ...draft, status: e.target.value as any })}
        options={STATUS_OPTIONS}
        required
      />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Payments"
        subtitle="Monthly subscription tracking"
        action={{ label: 'Add Payment', onClick: () => { setAddDraft(emptyDraft(user?.id ?? '')); setShowAdd(true); } }}
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
              {bdReps.map(b => <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl p-1">
            {['All', 'Received', 'Pending'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  statusFilter === s ? 'bg-white text-[#3d5af1] border border-[#c7d0fb] shadow-sm' : 'text-[#8b90a8] hover:text-[#4a5068]'
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
            filtered.map(payment => {
              const deal = dealForId(payment.deal_id);
              const bd   = bdForId(payment.bd_id);
              return (
                <div
                  key={payment.id}
                  className="grid gap-4 py-3 border-b border-[#f0f2f8] items-center group"
                  style={{ gridTemplateColumns: isManager ? '3fr 2fr 2fr 2fr 2fr 1fr' : '4fr 2fr 2fr 2fr 1fr' }}
                >
                  <div>
                    <div className="text-xs font-medium text-[#1a1d2e] truncate">{deal?.deal_name ?? '—'}</div>
                    <div className="text-[10px] text-[#8b90a8]">{deal ? MOCK_CLIENTS.find(c => c.id === deal.client_id)?.name : ''}</div>
                  </div>
                  {isManager && (
                    <div className="text-xs text-[#4a5068]">{bd ? `${bd.first_name} ${bd.last_name}` : '—'}</div>
                  )}
                  <div className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(payment.amount)}</div>
                  <div className="text-xs text-[#4a5068]">{formatDate(payment.date)}</div>
                  <div>
                    <Badge variant={payment.status === 'Received' ? 'success' : 'warning'} size="sm">{payment.status}</Badge>
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
              Remove the <strong>{formatCurrency(deleting.amount)}</strong> payment from{' '}
              <strong>{formatDate(deleting.date)}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger"    size="sm" onClick={handleDelete}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
