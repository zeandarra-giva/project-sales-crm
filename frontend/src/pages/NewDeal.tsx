import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Package, Wrench } from 'lucide-react';
import { Input, Select, Textarea, Button, Card } from '../components/ui/index';
import { MOCK_CLIENTS, MOCK_SERVICES, MOCK_BUNDLES } from '../mockData';

const LEAD_SOURCES = [
  { value: 'Inbound', label: 'Inbound' },
  { value: 'Outbound', label: 'Outbound' },
  { value: 'Referral', label: 'Referral' },
];

export default function NewDealPage() {
  const navigate = useNavigate();
  const [dealType, setDealType] = useState<'service' | 'bundle'>('service');
  const [form, setForm] = useState({
    deal_name: '',
    monthly_subscription: '',
    duration: '12',
    lead_source: 'Outbound',
    client_id: '',
    service_id: '',
    bundle_id: '',
    proposal_link: '',
    contract_link: '',
    remarks: '',
    action_plan: '',
    due_date: '',
    action_plan_due_date: '',
  });

  const clientOptions = MOCK_CLIENTS.map(c => ({ value: c.id, label: c.name }));
  const serviceOptions = MOCK_SERVICES.map(s => ({ value: s.id, label: s.name }));
  const bundleOptions = MOCK_BUNDLES.map(b => ({ value: b.id, label: b.name }));

  const selectedBundle = MOCK_BUNDLES.find(b => b.id === form.bundle_id);
  const contractValue =
    form.monthly_subscription && form.duration
      ? parseFloat(form.monthly_subscription) * parseFloat(form.duration)
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Deal created successfully! (mock)');
    navigate('/pipeline');
  };

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to="/pipeline" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <h1 className="font-bold text-base font-display text-[#1a1d2e]">New Deal</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Deal Info */}
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Deal Information
            </div>
            <div className="flex flex-col gap-4">
              <Input
                label="Deal Name"
                value={form.deal_name}
                onChange={e => update('deal_name', e.target.value)}
                placeholder="Client Name – Service (e.g. TechCorp – MEDIAWATCH)"
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

              {/* Deal type toggle */}
              <div>
                <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider block mb-1.5">
                  Deal Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setDealType('service'); update('bundle_id', ''); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border font-medium transition-all ${
                      dealType === 'service'
                        ? 'bg-[#eef1fe] border-[#c7d0fb] text-[#3d5af1]'
                        : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                    }`}
                  >
                    <Wrench size={12} />
                    Single Service
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDealType('bundle'); update('service_id', ''); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border font-medium transition-all ${
                      dealType === 'bundle'
                        ? 'bg-[#eef1fe] border-[#c7d0fb] text-[#3d5af1]'
                        : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                    }`}
                  >
                    <Package size={12} />
                    Bundle
                  </button>
                </div>
              </div>

              {/* Service or Bundle picker */}
              {dealType === 'service' ? (
                <Select
                  label="Service"
                  value={form.service_id}
                  onChange={e => update('service_id', e.target.value)}
                  options={serviceOptions}
                  placeholder="Select service..."
                  required
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <Select
                    label="Bundle"
                    value={form.bundle_id}
                    onChange={e => update('bundle_id', e.target.value)}
                    options={bundleOptions}
                    placeholder="Select bundle..."
                    required
                  />
                  {selectedBundle && (
                    <div className="p-3 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl">
                      <div className="text-[10px] font-semibold text-[#8b90a8] uppercase tracking-wider mb-2">
                        Included Services
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBundle.services.map(s => (
                          <span
                            key={s.service_id}
                            className="px-2 py-1 bg-[#eef1fe] border border-[#c7d0fb] text-[#3d5af1] text-xs rounded-lg font-medium"
                          >
                            {s.name} ({s.revenue_share_pct}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  label="Expected Close Date"
                  type="date"
                  value={form.due_date}
                  onChange={e => update('due_date', e.target.value)}
                  required
                />
                <Input
                  label="Action Plan Due Date"
                  type="date"
                  value={form.action_plan_due_date}
                  onChange={e => update('action_plan_due_date', e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Documents */}
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Documents
            </div>
            <div className="flex flex-col gap-4">
              <Input
                label="Proposal Link"
                type="url"
                value={form.proposal_link}
                onChange={e => update('proposal_link', e.target.value)}
                placeholder="https://drive.google.com/..."
              />
              <Input
                label="Contract Link"
                type="url"
                value={form.contract_link}
                onChange={e => update('contract_link', e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Notes & Action Plan
            </div>
            <div className="flex flex-col gap-4">
              <Textarea
                label="Remarks"
                value={form.remarks}
                onChange={e => update('remarks', e.target.value)}
                rows={3}
                placeholder="Initial notes about this deal, client context..."
              />
              <Textarea
                label="Action Plan"
                value={form.action_plan}
                onChange={e => update('action_plan', e.target.value)}
                rows={3}
                placeholder="Next steps and action items..."
              />
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit">Create Deal</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
