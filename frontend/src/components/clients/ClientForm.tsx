import { Input, Select } from '../ui/index';
import { INDUSTRIES } from '../../mockData';

const ACCOUNT_TYPES  = ['Enterprise', 'Corporate', 'SMB', 'Government'].map(v => ({ value: v, label: v }));
const CLIENT_STATUSES = ['Active', 'Prospect', 'Inactive'].map(v => ({ value: v, label: v }));
const INDUSTRY_OPTS  = INDUSTRIES.map(i => ({ value: i, label: i }));

export interface ClientFormState {
  name: string;
  brand: string;
  account_type: string;
  status: string;
  industry: string;
  notes: string;
}

export const defaultClientForm = (): ClientFormState => ({
  name: '', brand: '', account_type: 'Enterprise', status: 'Prospect', industry: '', notes: '',
});

interface ClientFormProps {
  form: ClientFormState;
  update: (field: keyof ClientFormState, value: string) => void;
}

export default function ClientForm({ form, update }: ClientFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input label="Company Name"      value={form.name}         onChange={e => update('name', e.target.value)}         placeholder="TechCorp Philippines" required />
      <Input label="Brand Name"        value={form.brand}        onChange={e => update('brand', e.target.value)}        placeholder="TechCorp (optional)" />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Account Type"   value={form.account_type} onChange={e => update('account_type', e.target.value)} options={ACCOUNT_TYPES}  required />
        <Select label="Status"         value={form.status}       onChange={e => update('status', e.target.value)}       options={CLIENT_STATUSES} required />
      </div>
      <Select label="Industry"         value={form.industry}     onChange={e => update('industry', e.target.value)}     options={INDUSTRY_OPTS} placeholder="Select industry..." />
    </div>
  );
}
