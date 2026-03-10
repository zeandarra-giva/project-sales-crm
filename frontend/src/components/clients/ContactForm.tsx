import { Input, Select } from '../ui/index';
import { useClients } from '../../hooks/useClients';
import type { DecisionRank } from '../../types';

const DECISION_RANKS: DecisionRank[] = [
  'Tier 1 Economic Buyer', 'Tier 2 Decision Maker', 'Tier 3 Influencer',
  'Tier 4 End User', 'Tier 5 Gatekeeper',
];

export interface ContactFormState {
  first_name: string;
  last_name: string;
  email: string;
  number: string;
  designation: string;
  decision_rank: string;
  client_id: string;
  is_primary: boolean;
}

export const defaultContactForm = (clientId = ''): ContactFormState => ({
  first_name: '', last_name: '', email: '', number: '', designation: '',
  decision_rank: 'Tier 2 Decision Maker', client_id: clientId, is_primary: false,
});

interface ContactFormProps {
  form: ContactFormState;
  update: (field: keyof ContactFormState, value: string | boolean) => void;
  hideClientPicker?: boolean;
}

export default function ContactForm({ form, update, hideClientPicker }: ContactFormProps) {
  const { clients } = useClients();
  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" value={form.first_name} onChange={e => update('first_name', e.target.value)} required />
        <Input label="Last Name"  value={form.last_name}  onChange={e => update('last_name',  e.target.value)} required />
      </div>
      <Input label="Email" type="email" value={form.email}  onChange={e => update('email',  e.target.value)} required />
      <Input label="Phone" type="tel"   value={form.number} onChange={e => update('number', e.target.value)} />
      <Input label="Designation / Title" value={form.designation} onChange={e => update('designation', e.target.value)} />
      {!hideClientPicker && (
        <Select label="Client" value={form.client_id} onChange={e => update('client_id', e.target.value)}
          options={clientOptions} placeholder="Select client..." required />
      )}
      <Select label="Decision Rank" value={form.decision_rank} onChange={e => update('decision_rank', e.target.value)}
        options={DECISION_RANKS.map(r => ({ value: r, label: r }))} required />
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
          <span className="text-xs text-[#4a5068]">{form.is_primary ? 'Yes – primary contact' : 'No – secondary contact'}</span>
        </div>
      </div>
    </div>
  );
}
