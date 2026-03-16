import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Input, Select, Button, Card } from '../components/ui/index';
import { useClients } from '../hooks/useClients';
import { useCreateContact } from '../hooks/useContacts';

const DECISION_RANKS = [
  { value: '1', label: 'Tier 1 – Economic Buyer' },
  { value: '2', label: 'Tier 2 – Decision Maker' },
  { value: '3', label: 'Tier 3 – Influencer' },
  { value: '4', label: 'Tier 4 – End User' },
  { value: '5', label: 'Tier 5 – Gatekeeper' },
];

export default function NewContactPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillClientId = searchParams.get('client_id') ?? '';

  const { data: clients = [] } = useClients();
  const createContact = useCreateContact();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    number: '',
    designation: '',
    decision_rank: '2',
    client_id: prefillClientId,
    is_primary: false,
  });

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));

  const update = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createContact.mutate({
      firstName: form.first_name,
      lastName: form.last_name,
      email: form.email,
      phone: form.number || undefined,
      jobTitle: form.designation || undefined,
      decisionMakerTier: parseInt(form.decision_rank),
      clientId: form.client_id,
      isPrimary: form.is_primary,
    }, {
      onSuccess: () => {
        if (prefillClientId) {
          navigate(`/clients/${prefillClientId}`);
        } else {
          navigate('/contacts');
        }
      },
    });
  };

  const backTo = prefillClientId ? `/clients/${prefillClientId}` : '/contacts';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to={backTo} className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <h1 className="font-bold text-base font-display text-[#1a1d2e]">New Contact</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Contact Information</div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" value={form.first_name} onChange={e => update('first_name', e.target.value)} placeholder="Ricardo" required />
                <Input label="Last Name" value={form.last_name} onChange={e => update('last_name', e.target.value)} placeholder="Santos" required />
              </div>
              <Input label="Email Address" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="rsantos@company.ph" required />
              <Input label="Phone Number" type="tel" value={form.number} onChange={e => update('number', e.target.value)} placeholder="+63 917 123 4567" />
              <Input label="Designation / Title" value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="Chief Technology Officer" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Role & Association</div>
            <div className="flex flex-col gap-4">
              <Select label="Client" value={form.client_id} onChange={e => update('client_id', e.target.value)} options={clientOptions} placeholder="Select client..." required />
              <Select label="Decision Rank" value={form.decision_rank} onChange={e => update('decision_rank', e.target.value)} options={DECISION_RANKS} required />
              <div>
                <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider block mb-1.5">Primary Contact</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => update('is_primary', !form.is_primary)}
                    className={`relative w-10 h-5 rounded-full transition-all ${form.is_primary ? 'bg-[#3d5af1]' : 'bg-[#e2e6f0]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${form.is_primary ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs text-[#4a5068]">{form.is_primary ? 'Yes – primary contact for this client' : 'No – secondary contact'}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(backTo)}>Cancel</Button>
            <Button type="submit" disabled={createContact.isPending}>{createContact.isPending ? 'Creating...' : 'Create Contact'}</Button>
          </div>
          {createContact.isError && (
            <div className="p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-xs text-[#e11d48]">Failed to create contact. Please check all fields and try again.</div>
          )}
        </form>
      </div>
    </div>
  );
}
