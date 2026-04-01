import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Tag, Layers } from 'lucide-react';
import { Input, Select, Textarea, Button, Card, Badge } from '../components/ui/index';
import { useClients } from '../hooks/useClients';
import { useCreateDeal } from '../hooks/useDeals';
import { useServices } from '../hooks/useServices';
import { useBundles } from '../hooks/useBundles';
import { formatCurrency } from '../lib/utils';

const LEAD_SOURCES = [
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'REFERRAL', label: 'Referral' },
];

type OfferingType = 'service' | 'bundle';

export default function NewDealPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get('client_id') ?? '';

  const { data: clients = [] }  = useClients();
  const { data: services = [] } = useServices();
  const { data: bundles = [] }  = useBundles();
  const createDeal = useCreateDeal();

  const [offeringType, setOfferingType] = useState<OfferingType>('service');

  const [form, setForm] = useState({
    deal_name: '',
    monthly_subscription: '',
    duration: '12',
    lead_source: 'OUTBOUND',
    client_id: prefillClientId,
    service_id: '',
    bundle_id: '',
    primary_contact_id: '',
    contract_start_date: '',
    contract_end_date: '',
    proposal_link: '',
    contract_link: '',
  });

  const clientOptions  = clients.map(c => ({ value: c.id, label: c.name }));
  const serviceOptions = services.map(s => ({ value: s.id, label: s.name }));
  const bundleOptions  = bundles.map(b => ({
    value: b.id,
    label: `${b.name}${b.services?.length ? ` (${b.services.length} service${b.services.length === 1 ? '' : 's'})` : ''}`,
  }));

  const selectedClient   = clients.find(c => c.id === form.client_id);
  const clientContacts   = selectedClient?.contacts ?? [];
  const hasClientPrimary = clientContacts.some(c => c.is_primary);
  const primaryContactOptions = [
    ...(!hasClientPrimary && form.client_id ? [{ value: '__NONE__', label: 'No primary contact yet' }] : []),
    ...clientContacts.map(c => ({
      value: c.id,
      label: `${c.first_name} ${c.last_name}${c.is_primary ? ' (Client Primary)' : ''}`,
    })),
  ];

  // Selected bundle preview
  const selectedBundle = bundles.find(b => b.id === form.bundle_id);

  const contractValue =
    form.monthly_subscription && form.duration
      ? parseFloat(form.monthly_subscription) * parseFloat(form.duration)
      : 0;

  const invalidContractRange =
    !!form.contract_start_date &&
    !!form.contract_end_date &&
    new Date(form.contract_end_date) < new Date(form.contract_start_date);

  useEffect(() => {
    if (!form.client_id) {
      setForm(prev => ({ ...prev, primary_contact_id: '' }));
      return;
    }
    const primary = clientContacts.find(c => c.is_primary);
    setForm(prev => ({ ...prev, primary_contact_id: primary?.id ?? '__NONE__' }));
  }, [form.client_id, selectedClient?.id, clientContacts.length]);

  // Clear the irrelevant field when the offering type switches
  useEffect(() => {
    if (offeringType === 'service') setForm(prev => ({ ...prev, bundle_id: '' }));
    else setForm(prev => ({ ...prev, service_id: '' }));
  }, [offeringType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidContractRange) return;
    createDeal.mutate({
      dealName:            form.deal_name,
      clientId:            form.client_id,
      monthlySubscription: parseFloat(form.monthly_subscription),
      duration:            parseInt(form.duration),
      leadSource:          form.lead_source as 'INBOUND' | 'OUTBOUND' | 'REFERRAL',
      serviceId:           offeringType === 'service' ? form.service_id : undefined,
      bundleId:            offeringType === 'bundle'  ? form.bundle_id  : undefined,
      primaryContactId:    form.primary_contact_id && form.primary_contact_id !== '__NONE__' ? form.primary_contact_id : undefined,
      contractStartDate:   form.contract_start_date,
      contractEndDate:     form.contract_end_date,
      proposalLink:        form.proposal_link  || undefined,
      contractLink:        form.contract_link  || undefined,
    }, { onSuccess: () => navigate('/pipeline') });
  };

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const canSubmit =
    form.deal_name && form.client_id && form.monthly_subscription && form.duration &&
    form.contract_start_date && form.contract_end_date &&
    (offeringType === 'service' ? !!form.service_id : !!form.bundle_id) &&
    !invalidContractRange;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <h1 className="font-bold text-base font-display text-[#1a1d2e]">New Deal</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Deal Information */}
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Information</div>
            <div className="flex flex-col gap-4">
              <Input
                label="Deal Name"
                value={form.deal_name}
                onChange={e => update('deal_name', e.target.value)}
                placeholder="Client Name – Service"
                required
              />
              <Select
                label="Client"
                value={form.client_id}
                onChange={e => update('client_id', e.target.value)}
                options={clientOptions}
                placeholder="Select client..."
                required
              />
              {form.client_id && (
                <div className="flex flex-col gap-2">
                  <Select
                    label="Primary Contact for Deal"
                    value={form.primary_contact_id}
                    onChange={e => update('primary_contact_id', e.target.value)}
                    options={primaryContactOptions}
                    placeholder={clientContacts.length > 0 ? 'Select primary contact...' : 'No contacts for this client yet'}
                    disabled={clientContacts.length === 0}
                  />
                  {!hasClientPrimary && (
                    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">
                      This client does not have a primary contact yet. You can continue and update it later on the deal detail page.
                    </div>
                  )}
                </div>
              )}

              {/* ── Offering type toggle ── */}
              <div>
                <label className="block text-[11px] font-medium text-[#64748B] uppercase tracking-[0.16em] mb-2">
                  Offering Type
                </label>
                <div className="flex gap-2">
                  {([
                    { key: 'service', icon: <Tag size={13} />, label: 'Single Service' },
                    { key: 'bundle',  icon: <Layers size={13} />, label: 'Bundle' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setOfferingType(opt.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium border transition-all ${
                        offeringType === opt.key
                          ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                          : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service picker */}
              {offeringType === 'service' && (
                <Select
                  label="Service *"
                  value={form.service_id}
                  onChange={e => update('service_id', e.target.value)}
                  options={serviceOptions}
                  placeholder="Select service..."
                  required
                />
              )}

              {/* Bundle picker + preview */}
              {offeringType === 'bundle' && (
                <div className="flex flex-col gap-2">
                  <Select
                    label="Bundle *"
                    value={form.bundle_id}
                    onChange={e => update('bundle_id', e.target.value)}
                    options={bundleOptions}
                    placeholder={bundleOptions.length === 0 ? 'No bundles available — create one in Services & Bundles' : 'Select bundle...'}
                    required
                  />
                  {bundleOptions.length === 0 && (
                    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">
                      No bundles exist yet. Ask a manager to create one in <span className="font-semibold">Services & Bundles</span>.
                    </div>
                  )}
                  {/* Selected bundle preview */}
                  {selectedBundle && (selectedBundle.services || []).length > 0 && (
                    <div className="rounded-xl border border-[rgba(61,90,241,0.16)] bg-[rgba(61,90,241,0.03)] p-3">
                      <div className="text-[11px] font-semibold text-[#3d5af1] uppercase tracking-wider mb-2">
                        Included Services
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {(selectedBundle.services || []).map(bs => (
                          <div key={bs.service_id} className="flex items-center justify-between">
                            <span className="text-[12px] text-[#1a1d2e] font-medium">{bs.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#8b90a8]">{formatCurrency(bs.service_value, true)}</span>
                              <Badge variant="blue" size="sm">{bs.revenue_share_pct}% rev share</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-[rgba(61,90,241,0.10)] flex justify-between items-center">
                        <span className="text-[11px] text-[#8b90a8]">Total bundle value</span>
                        <span className="text-[12px] font-semibold text-[#3d5af1]">
                          {formatCurrency(
                            (selectedBundle.services || []).reduce((s, b) => s + (b.service_value || 0), 0),
                            true
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Financial fields */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Monthly Subscription (PHP)"
                  type="number"
                  value={form.monthly_subscription}
                  onChange={e => update('monthly_subscription', e.target.value)}
                  placeholder="85000"
                  required
                />
                <Input
                  label="Duration (months)"
                  type="number"
                  value={form.duration}
                  onChange={e => update('duration', e.target.value)}
                  placeholder="12"
                  required
                />
              </div>
              {contractValue > 0 && (
                <div className="p-3 bg-[#eef1fe] border border-[#c7d0fb] rounded-xl flex justify-between items-center">
                  <span className="text-xs text-[#3d5af1] font-medium">Total Contract Value</span>
                  <span className="text-sm font-bold text-[#3d5af1] font-display">
                    ₱{contractValue.toLocaleString()}
                  </span>
                </div>
              )}
              <Select
                label="Lead Source"
                value={form.lead_source}
                onChange={e => update('lead_source', e.target.value)}
                options={LEAD_SOURCES}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Contract Start Date"
                  type="date"
                  value={form.contract_start_date}
                  onChange={e => update('contract_start_date', e.target.value)}
                  required
                />
                <Input
                  label="Contract End Date"
                  type="date"
                  value={form.contract_end_date}
                  onChange={e => update('contract_end_date', e.target.value)}
                  required
                />
              </div>
              {invalidContractRange && (
                <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-xs text-[#e11d48]">
                  Contract end date must be on or after the contract start date.
                </div>
              )}
            </div>
          </Card>

          {/* Contract links */}
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Contract</div>
            <Input
              label="Proposal Link"
              type="url"
              value={form.proposal_link}
              onChange={e => update('proposal_link', e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <div className="mt-4">
              <Input
                label="Contract Link"
                type="url"
                value={form.contract_link}
                onChange={e => update('contract_link', e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || createDeal.isPending}>
              {createDeal.isPending ? 'Creating...' : 'Create Deal'}
            </Button>
          </div>
          {createDeal.isError && (
            <div className="p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">
              Failed to create deal. Please make sure all required fields are filled in correctly.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
