// DealForm — reusable form field group used by NewDeal and DealDetail edit flow
import { Input, Select, Textarea } from '../ui/index';
import { MOCK_CLIENTS, MOCK_SERVICES, MOCK_BUNDLES } from '../../mockData';
import { Package, Wrench } from 'lucide-react';

const LEAD_SOURCES = [
  { value: 'Inbound',  label: 'Inbound'  },
  { value: 'Outbound', label: 'Outbound' },
  { value: 'Referral', label: 'Referral' },
];

export interface DealFormState {
  deal_name: string;
  client_id: string;
  service_id: string;
  bundle_id: string;
  dealType: 'service' | 'bundle';
  monthly_subscription: string;
  duration: string;
  lead_source: string;
  due_date: string;
  action_plan_due_date: string;
  proposal_link: string;
  contract_link: string;
  remarks: string;
  action_plan: string;
}

export const defaultDealForm = (): DealFormState => ({
  deal_name: '', client_id: '', service_id: '', bundle_id: '',
  dealType: 'service', monthly_subscription: '', duration: '12',
  lead_source: 'Outbound', due_date: '', action_plan_due_date: '',
  proposal_link: '', contract_link: '', remarks: '', action_plan: '',
});

interface DealFormProps {
  form: DealFormState;
  update: (field: keyof DealFormState, value: string) => void;
}

export default function DealForm({ form, update }: DealFormProps) {
  const clientOptions  = MOCK_CLIENTS.map(c => ({ value: c.id, label: c.name }));
  const serviceOptions = MOCK_SERVICES.map(s => ({ value: s.id, label: s.name }));
  const bundleOptions  = MOCK_BUNDLES.map(b => ({ value: b.id, label: b.name }));
  const selectedBundle = MOCK_BUNDLES.find(b => b.id === form.bundle_id);
  const contractValue  = parseFloat(form.monthly_subscription || '0') * parseFloat(form.duration || '0');

  return (
    <div className="flex flex-col gap-4">
      <Input label="Deal Name" value={form.deal_name} onChange={e => update('deal_name', e.target.value)}
        placeholder="Client – Service" required />

      <Select label="Client" value={form.client_id} onChange={e => update('client_id', e.target.value)}
        options={clientOptions} placeholder="Select client..." required />

      {/* Deal type toggle */}
      <div>
        <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider block mb-1.5">Deal Type</label>
        <div className="flex gap-2">
          {(['service', 'bundle'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => { update('dealType', t); update(t === 'service' ? 'bundle_id' : 'service_id', ''); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border font-medium transition-all ${
                form.dealType === t ? 'bg-[#eef1fe] border-[#c7d0fb] text-[#3d5af1]' : 'bg-white border-[#e2e6f0] text-[#8b90a8]'
              }`}
            >
              {t === 'service' ? <Wrench size={12} /> : <Package size={12} />}
              {t === 'service' ? 'Single Service' : 'Bundle'}
            </button>
          ))}
        </div>
      </div>

      {form.dealType === 'service' ? (
        <Select label="Service" value={form.service_id} onChange={e => update('service_id', e.target.value)}
          options={serviceOptions} placeholder="Select service..." required />
      ) : (
        <div className="flex flex-col gap-2">
          <Select label="Bundle" value={form.bundle_id} onChange={e => update('bundle_id', e.target.value)}
            options={bundleOptions} placeholder="Select bundle..." required />
          {selectedBundle && (
            <div className="p-3 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl">
              <div className="text-[10px] font-semibold text-[#8b90a8] uppercase tracking-wider mb-2">Included Services</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedBundle.services.map(s => (
                  <span key={s.service_id} className="px-2 py-1 bg-[#eef1fe] border border-[#c7d0fb] text-[#3d5af1] text-xs rounded-lg font-medium">
                    {s.name} ({s.revenue_share_pct}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="Monthly Subscription (PHP)" type="number" value={form.monthly_subscription}
          onChange={e => update('monthly_subscription', e.target.value)} placeholder="85000" required />
        <Input label="Duration (months)" type="number" value={form.duration}
          onChange={e => update('duration', e.target.value)} placeholder="12" required />
      </div>

      {contractValue > 0 && (
        <div className="p-3 bg-[#eef1fe] border border-[#c7d0fb] rounded-xl flex justify-between items-center">
          <span className="text-xs text-[#3d5af1] font-medium">Total Contract Value</span>
          <span className="text-sm font-bold text-[#3d5af1] font-display">₱{contractValue.toLocaleString()}</span>
        </div>
      )}

      <Select label="Lead Source" value={form.lead_source} onChange={e => update('lead_source', e.target.value)}
        options={LEAD_SOURCES} required />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Expected Close Date" type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} required />
        <Input label="Action Plan Due Date" type="date" value={form.action_plan_due_date} onChange={e => update('action_plan_due_date', e.target.value)} />
      </div>

      <Input label="Proposal Link" type="url" value={form.proposal_link} onChange={e => update('proposal_link', e.target.value)} placeholder="https://drive.google.com/..." />
      <Input label="Contract Link" type="url" value={form.contract_link} onChange={e => update('contract_link', e.target.value)} placeholder="https://drive.google.com/..." />

      <Textarea label="Remarks" value={form.remarks} onChange={e => update('remarks', e.target.value)} rows={3}
        placeholder="Client context, notes..." />
      <Textarea label="Action Plan" value={form.action_plan} onChange={e => update('action_plan', e.target.value)} rows={3}
        placeholder="Next steps..." />
    </div>
  );
}
