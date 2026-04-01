import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Input, Select, Textarea, Button, Card } from '../components/ui/index';
import { useClients } from '../hooks/useClients';
import { useCreateDeal } from '../hooks/useDeals';
import { useServices } from '../hooks/useServices';

const LEAD_SOURCES = [
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'REFERRAL', label: 'Referral' },
];

export default function NewDealPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get('client_id') ?? '';

  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const createDeal = useCreateDeal();

  const [form, setForm] = useState({
    deal_name: '',
    monthly_subscription: '',
    duration: '12',
    lead_source: 'OUTBOUND',
    client_id: prefillClientId,
    service_id: '',
    contract_start_date: '',
    contract_end_date: '',
    proposal_link: '',
    contract_link: '',
  });

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));
  const serviceOptions = services.map(service => ({ value: service.id, label: service.name }));

  const contractValue =
    form.monthly_subscription && form.duration
      ? parseFloat(form.monthly_subscription) * parseFloat(form.duration)
      : 0;
  const invalidContractRange =
    !!form.contract_start_date &&
    !!form.contract_end_date &&
    new Date(form.contract_end_date) < new Date(form.contract_start_date);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidContractRange) return;
    createDeal.mutate({
      dealName: form.deal_name,
      clientId: form.client_id,
      monthlySubscription: parseFloat(form.monthly_subscription),
      duration: parseInt(form.duration),
      leadSource: form.lead_source as 'INBOUND' | 'OUTBOUND' | 'REFERRAL',
      serviceId: form.service_id,
      contractStartDate: form.contract_start_date,
      contractEndDate: form.contract_end_date,
      proposalLink: form.proposal_link || undefined,
      contractLink: form.contract_link || undefined,
    }, {
      onSuccess: () => navigate('/pipeline'),
    });
  };

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <h1 className="font-bold text-base font-display text-[#1a1d2e]">New Deal</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Information</div>
            <div className="flex flex-col gap-4">
              <Input label="Deal Name" value={form.deal_name} onChange={e => update('deal_name', e.target.value)} placeholder="Client Name – Service" required />
              <Select label="Client" value={form.client_id} onChange={e => update('client_id', e.target.value)} options={clientOptions} placeholder="Select client..." required />
              <Select
                label="Service"
                value={form.service_id}
                onChange={e => update('service_id', e.target.value)}
                options={serviceOptions}
                placeholder="Select service..."
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Monthly Subscription (PHP)" type="number" value={form.monthly_subscription} onChange={e => update('monthly_subscription', e.target.value)} placeholder="85000" required />
                <Input label="Duration (months)" type="number" value={form.duration} onChange={e => update('duration', e.target.value)} placeholder="12" required />
              </div>
              {contractValue > 0 && (
                <div className="p-3 bg-[#eef1fe] border border-[#c7d0fb] rounded-xl flex justify-between items-center">
                  <span className="text-xs text-[#3d5af1] font-medium">Total Contract Value</span>
                  <span className="text-sm font-bold text-[#3d5af1] font-display">₱{contractValue.toLocaleString()}</span>
                </div>
              )}
              <Select label="Lead Source" value={form.lead_source} onChange={e => update('lead_source', e.target.value)} options={LEAD_SOURCES} required />
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

          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Contract</div>
            <Input label="Proposal Link" type="url" value={form.proposal_link} onChange={e => update('proposal_link', e.target.value)} placeholder="https://drive.google.com/..." />
            <div className="mt-4">
              <Input label="Contract Link" type="url" value={form.contract_link} onChange={e => update('contract_link', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={createDeal.isPending || invalidContractRange}>{createDeal.isPending ? 'Creating...' : 'Create Deal'}</Button>
          </div>
          {createDeal.isError && (
            <div className="p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">Failed to create deal. Please make sure a client, service, and valid contract dates are selected.</div>
          )}
        </form>
      </div>
    </div>
  );
}
