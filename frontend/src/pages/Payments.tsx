import { useMemo, useState } from 'react';
import { BarChart3, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  BarChart,
} from 'recharts';
import Header from '../components/layout/Header';
import { Badge, Button, Card, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import { useAuthStore } from '../store/authStore';
import {
  usePayments,
  usePaymentsOverview,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
} from '../hooks/usePayments';
import { useDeals } from '../hooks/useDeals';
import { useBDList, useCollectionsReport } from '../hooks/useReports';
import type { PaymentLog } from '../api/payments';
import { formatCurrency, formatDate } from '../lib/utils';

type PaymentDraft = {
  dealId: string;
  amount: string;
  billingYear: string;
  billingMonth: string;
};

const emptyDraft = (): PaymentDraft => ({
  dealId: '',
  amount: '',
  billingYear: String(new Date().getFullYear()),
  billingMonth: String(new Date().getMonth() + 1),
});

const monthOptions = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const quarterOptions = [
  { value: 'All', label: 'All Quarters' },
  { value: '1', label: 'Q1' },
  { value: '2', label: 'Q2' },
  { value: '3', label: 'Q3' },
  { value: '4', label: 'Q4' },
];

function statusBadge(status: string) {
  if (status === 'Overdue') return <Badge variant="danger">Overdue</Badge>;
  if (status === 'Due This Month') return <Badge variant="warning">Due This Month</Badge>;
  return <Badge variant="success">Current</Badge>;
}

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'SALES_MANAGER';
  const [bdFilter, setBdFilter] = useState(isManager ? 'All' : user?.id || 'All');
  const [yearFilter, setYearFilter] = useState('All');
  const [quarterFilter, setQuarterFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Received' | 'Unassigned'>('All');

  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<PaymentDraft>(emptyDraft());
  const [editing, setEditing] = useState<PaymentLog | null>(null);
  const [editDraft, setEditDraft] = useState<PaymentDraft>(emptyDraft());
  const [deleting, setDeleting] = useState<PaymentLog | null>(null);

  const selectedBdId = isManager ? (bdFilter === 'All' ? undefined : bdFilter) : user?.id;
  const selectedYear = yearFilter === 'All' ? undefined : Number(yearFilter);
  const selectedQuarter = quarterFilter === 'All' ? undefined : Number(quarterFilter);

  const { data: bdReps = [] } = useBDList();
  const { data: rawDeals } = useDeals();
  const { data: overview, isLoading: loadingOverview } = usePaymentsOverview({
    ...(selectedBdId ? { bdId: selectedBdId } : {}),
    ...(selectedYear ? { year: selectedYear } : {}),
    ...(selectedQuarter ? { quarter: selectedQuarter } : {}),
  });
  const { data: paymentLogs = [], isLoading: loadingPayments } = usePayments({
    ...(selectedBdId ? { bdId: selectedBdId } : {}),
    ...(selectedYear ? { year: selectedYear } : {}),
    ...(selectedQuarter ? { quarter: selectedQuarter } : {}),
  });
  const { data: collectionsReport } = useCollectionsReport({
    ...(selectedBdId ? { bdId: selectedBdId } : {}),
    ...(selectedYear ? { year: selectedYear } : {}),
    ...(selectedQuarter ? { quarter: selectedQuarter } : {}),
  });
  const { mutate: createPayment, isPending: creating } = useCreatePayment();
  const { mutate: updatePayment, isPending: updating } = useUpdatePayment();
  const { mutate: deletePayment, isPending: deletingPayment } = useDeletePayment();

  const dealsData: any[] = Array.isArray(rawDeals) ? rawDeals : (rawDeals as any)?.data || [];
  const closedDeals = dealsData.filter((deal: any) => deal.stage?.name === 'Closed Won' || deal.isClosed);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    overview?.filterYears?.forEach((year) => years.add(year));
    paymentLogs.forEach((payment) => payment.billingYear && years.add(payment.billingYear));
    if (new Date().getFullYear()) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [overview?.filterYears, paymentLogs]);

  const filteredLogs = useMemo(() => (
    paymentLogs.filter((payment) => {
      if (statusFilter !== 'All' && payment.status !== statusFilter) return false;
      return true;
    })
  ), [paymentLogs, statusFilter]);

  const summary = overview?.summary;
  const trackedDeals = overview?.deals || [];
  const followUps = overview?.followUps || [];
  const trendData = collectionsReport?.monthlyTrend || [];
  const byBd = collectionsReport?.byBd || [];
  const byAccount = collectionsReport?.byAccount || [];

  const handleAdd = () => {
    if (!addDraft.dealId || !addDraft.amount || !addDraft.billingYear || !addDraft.billingMonth) return;
    createPayment({
      dealId: addDraft.dealId,
      amount: Number(addDraft.amount),
      billingYear: Number(addDraft.billingYear),
      billingMonth: Number(addDraft.billingMonth),
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setAddDraft(emptyDraft());
      },
    });
  };

  const openEdit = (payment: PaymentLog) => {
    setEditing(payment);
    setEditDraft({
      dealId: payment.dealId,
      amount: String(payment.amount),
      billingYear: payment.billingYear ? String(payment.billingYear) : String(new Date().getFullYear()),
      billingMonth: payment.billingMonth ? String(payment.billingMonth) : '1',
    });
  };

  const handleEdit = () => {
    if (!editing || !editDraft.amount || !editDraft.billingYear || !editDraft.billingMonth) return;
    updatePayment({
      id: editing.id,
      data: {
        amount: Number(editDraft.amount),
        billingYear: Number(editDraft.billingYear),
        billingMonth: Number(editDraft.billingMonth),
      },
    }, {
      onSuccess: () => {
        setEditing(null);
      },
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    deletePayment(deleting.id, {
      onSuccess: () => setDeleting(null),
    });
  };

  const DraftFields = ({
    draft,
    setDraft,
    lockDeal = false,
  }: {
    draft: PaymentDraft;
    setDraft: (value: PaymentDraft) => void;
    lockDeal?: boolean;
  }) => (
    <>
      <Select
        label="Closed Deal"
        value={draft.dealId}
        onChange={(e) => setDraft({ ...draft, dealId: e.target.value })}
        options={closedDeals.map((deal: any) => ({
          value: deal.id,
          label: `${deal.dealName || deal.deal_name} · ${deal.client?.name || 'No client'}`,
        }))}
        placeholder="Select closed deal..."
        disabled={lockDeal}
      />
      <Input
        label="Amount (PHP)"
        type="number"
        value={draft.amount}
        onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
        placeholder="85000"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Billing Year"
          value={draft.billingYear}
          onChange={(e) => setDraft({ ...draft, billingYear: e.target.value })}
          options={yearOptions.length
            ? yearOptions.map((year) => ({ value: String(year), label: String(year) }))
            : [{ value: String(new Date().getFullYear()), label: String(new Date().getFullYear()) }]}
        />
        <Select
          label="Billing Month"
          value={draft.billingMonth}
          onChange={(e) => setDraft({ ...draft, billingMonth: e.target.value })}
          options={monthOptions}
        />
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Payments"
        subtitle="Collections visibility for booked versus collected subscription revenue"
        action={{ label: 'Add Payment', onClick: () => { setAddDraft(emptyDraft()); setShowAdd(true); } }}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {isManager && (
              <div className="min-w-[220px]">
                <Select
                  label="BD Member"
                  value={bdFilter}
                  onChange={(e) => setBdFilter(e.target.value)}
                  options={[
                    { value: 'All', label: 'All BD Members' },
                    ...bdReps.map((bd: any) => ({
                      value: bd.id,
                      label: `${bd.firstName || bd.first_name} ${bd.lastName || bd.last_name}`,
                    })),
                  ]}
                />
              </div>
            )}
            <div className="min-w-[160px]">
              <Select
                label="Year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                options={[
                  { value: 'All', label: 'All Years' },
                  ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
                ]}
              />
            </div>
            <div className="min-w-[160px]">
              <Select
                label="Quarter"
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                options={quarterOptions}
              />
            </div>
            <div className="min-w-[180px]">
              <Select
                label="Log Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Received' | 'Unassigned')}
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'Received', label: 'Received' },
                  { value: 'Unassigned', label: 'Unassigned' },
                ]}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-[#8b90a8] mb-1">Booked Revenue</div>
            <div className="text-2xl font-bold font-display text-[#111827]">{formatCurrency(summary?.bookedRevenue || 0, true)}</div>
            <div className="text-xs text-[#8b90a8] mt-2">Closed deals in scope</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-[#8b90a8] mb-1">Expected Collections</div>
            <div className="text-2xl font-bold font-display text-[#111827]">{formatCurrency(summary?.expectedRevenue || 0, true)}</div>
            <div className="text-xs text-[#8b90a8] mt-2">Scheduled monthly billings</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-[#8b90a8] mb-1">Collected Revenue</div>
            <div className="text-2xl font-bold font-display text-[#059669]">{formatCurrency(summary?.collectedRevenue || 0, true)}</div>
            <div className="text-xs text-[#8b90a8] mt-2">Actual receipts logged</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-[#8b90a8] mb-1">Outstanding</div>
            <div className="text-2xl font-bold font-display text-[#d97706]">{formatCurrency(summary?.outstandingRevenue || 0, true)}</div>
            <div className="text-xs text-[#8b90a8] mt-2">Expected minus collected</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-[#8b90a8] mb-1">Overdue</div>
            <div className="text-2xl font-bold font-display text-[#e11d48]">{formatCurrency(summary?.overdueRevenue || 0, true)}</div>
            <div className="text-xs text-[#8b90a8] mt-2">{summary?.coveragePct || 0}% collection coverage</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr,1fr] gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-[#3d5af1]" />
              <div>
                <div className="text-sm font-semibold text-[#1a1d2e]">Booked vs Actual Receipts</div>
                <div className="text-xs text-[#8b90a8]">Analytics-service comparison of monthly booked, expected, and collected revenue</div>
              </div>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData}>
                  <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `₱${Math.round(value / 1000)}k`} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
                  <Legend />
                  <Bar dataKey="bookedRevenue" fill="#c7d2fe" name="Booked" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expectedRevenue" fill="#fdba74" name="Expected" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="collectedRevenue" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} name="Collected" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Account Follow-up Queue</div>
            <div className="text-xs text-[#8b90a8] mb-4">Clients with unpaid or overdue subscription months</div>
            <div className="space-y-3">
              {followUps.length === 0 ? (
                <div className="text-sm text-[#8b90a8] py-8 text-center">No unpaid accounts in the current scope.</div>
              ) : followUps.map((deal) => (
                <div key={deal.dealId} className="border border-[#edf0f7] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#1a1d2e]">{deal.clientName || deal.dealName}</div>
                      <div className="text-xs text-[#8b90a8]">{deal.dealName} · {deal.bdName}</div>
                    </div>
                    {statusBadge(deal.followUpStatus)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <div className="text-[#8b90a8]">Overdue</div>
                      <div className="font-semibold text-[#e11d48]">{formatCurrency(deal.overdueRevenue)}</div>
                    </div>
                    <div>
                      <div className="text-[#8b90a8]">Next Due</div>
                      <div className="font-semibold text-[#1a1d2e]">{deal.nextDueLabel || 'Fully paid'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {isManager && (
            <Card className="p-5">
              <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Collections by BD</div>
              <div className="text-xs text-[#8b90a8] mb-4">Manager view across all BD payment logs</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBd}>
                    <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `₱${Math.round(value / 1000)}k`} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
                    <Legend />
                    <Bar dataKey="bookedRevenue" fill="#c7d2fe" name="Booked" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="collectedRevenue" fill="#34d399" name="Collected" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Collections by Account Type</div>
            <div className="text-xs text-[#8b90a8] mb-4">Booked versus actual receipts by account mix</div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAccount}>
                  <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `₱${Math.round(value / 1000)}k`} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
                  <Legend />
                  <Bar dataKey="expectedRevenue" fill="#fdba74" name="Expected" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="collectedRevenue" fill="#059669" name="Collected" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt size={16} className="text-[#3d5af1]" />
            <div>
              <div className="text-sm font-semibold text-[#1a1d2e]">Subscription Tracking</div>
              <div className="text-xs text-[#8b90a8]">Per-deal collection progress, unpaid months, and next follow-up target</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[2fr,1.2fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-3 pb-2 border-b border-[#e2e6f0] text-[10px] uppercase tracking-wider text-[#8b90a8]">
                <div>Account / Deal</div>
                <div>BD</div>
                <div>Monthly</div>
                <div>Booked</div>
                <div>Collected</div>
                <div>Outstanding</div>
                <div>Months</div>
                <div>Status</div>
              </div>
              {trackedDeals.length === 0 ? (
                <div className="py-8 text-sm text-[#8b90a8] text-center">
                  {loadingOverview ? 'Loading collections overview...' : 'No closed subscription deals found for the current scope.'}
                </div>
              ) : trackedDeals.map((deal) => (
                <div key={deal.dealId} className="grid grid-cols-[2fr,1.2fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-3 py-3 border-b border-[#f1f5f9] items-center">
                  <div>
                    <div className="text-sm font-semibold text-[#1a1d2e]">{deal.clientName || deal.dealName}</div>
                    <div className="text-xs text-[#8b90a8]">{deal.dealName}</div>
                    {deal.startDate && <div className="text-[11px] text-[#94a3b8] mt-1">Start {formatDate(deal.startDate)}</div>}
                  </div>
                  <div className="text-xs text-[#4a5068]">{deal.bdName}</div>
                  <div className="text-sm font-semibold text-[#1a1d2e]">{formatCurrency(deal.monthlySubscription)}</div>
                  <div className="text-sm text-[#1a1d2e]">{formatCurrency(deal.bookedRevenue)}</div>
                  <div className="text-sm text-[#059669]">{formatCurrency(deal.collectedRevenue)}</div>
                  <div>
                    <div className="text-sm text-[#d97706]">{formatCurrency(deal.outstandingRevenue)}</div>
                    {deal.overdueRevenue > 0 && <div className="text-[11px] text-[#e11d48]">Overdue {formatCurrency(deal.overdueRevenue)}</div>}
                  </div>
                  <div className="text-xs text-[#4a5068]">
                    <div>{deal.paidMonths} paid</div>
                    <div>{deal.unpaidMonths} unpaid</div>
                    <div>{deal.overdueMonths} overdue</div>
                  </div>
                  <div>
                    {statusBadge(deal.followUpStatus)}
                    <div className="text-[11px] text-[#8b90a8] mt-1">{deal.nextDueLabel || deal.lastPaidLabel || 'No schedule yet'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-[#1a1d2e]">Payment Log</div>
              <div className="text-xs text-[#8b90a8]">
                {isManager ? 'Manager view across all BD payment logs with BD, year, and quarter filters.' : 'Your recorded receipts for subscription deals.'}
              </div>
            </div>
            <Badge variant="info">{filteredLogs.length} entries</Badge>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className={`grid gap-3 pb-2 border-b border-[#e2e6f0] text-[10px] uppercase tracking-wider text-[#8b90a8] ${isManager ? 'grid-cols-[2fr,1.2fr,1fr,1fr,1fr,0.8fr]' : 'grid-cols-[2fr,1fr,1fr,1fr,0.8fr]'}`}>
                <div>Deal / Account</div>
                {isManager && <div>BD</div>}
                <div>Billing Period</div>
                <div>Amount</div>
                <div>Status</div>
                <div />
              </div>
              {filteredLogs.length === 0 ? (
                <div className="py-8 text-sm text-[#8b90a8] text-center">
                  {loadingPayments ? 'Loading payment logs...' : 'No payment logs match the current filters.'}
                </div>
              ) : filteredLogs.map((payment) => (
                <div
                  key={payment.id}
                  className={`grid gap-3 py-3 border-b border-[#f1f5f9] items-center group ${isManager ? 'grid-cols-[2fr,1.2fr,1fr,1fr,1fr,0.8fr]' : 'grid-cols-[2fr,1fr,1fr,1fr,0.8fr]'}`}
                >
                  <div>
                    <div className="text-sm font-semibold text-[#1a1d2e]">{payment.dealName}</div>
                    <div className="text-xs text-[#8b90a8]">{payment.clientName || 'No client linked'}</div>
                  </div>
                  {isManager && <div className="text-xs text-[#4a5068]">{payment.bdName}</div>}
                  <div className="text-xs text-[#4a5068]">{payment.billingLabel}</div>
                  <div className="text-sm font-semibold text-[#1a1d2e]">{formatCurrency(payment.amount)}</div>
                  <div>{payment.status === 'Received' ? <Badge variant="success">Received</Badge> : <Badge variant="warning">Unassigned</Badge>}</div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManager && (
                      <>
                        <button
                          onClick={() => openEdit(payment)}
                          className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-all"
                          title="Edit payment"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleting(payment)}
                          className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#e11d48] hover:bg-[#fff1f2] transition-all"
                          title="Delete payment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {showAdd && (
        <EditModal title="Add Payment" onClose={() => setShowAdd(false)} onSave={handleAdd} saveLabel="Add Payment" saving={creating}>
          <DraftFields draft={addDraft} setDraft={setAddDraft} />
        </EditModal>
      )}

      {editing && (
        <EditModal title="Edit Payment" onClose={() => setEditing(null)} onSave={handleEdit} saveLabel="Save Changes" saving={updating}>
          <DraftFields draft={editDraft} setDraft={setEditDraft} lockDeal />
        </EditModal>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 shadow-xl animate-fade-in">
            <h2 className="font-bold text-sm font-display text-[#1a1d2e] mb-2">Delete Payment?</h2>
            <p className="text-xs text-[#4a5068] mb-5">
              Remove the <strong>{formatCurrency(deleting.amount)}</strong> payment for <strong>{deleting.billingLabel}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deletingPayment}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
