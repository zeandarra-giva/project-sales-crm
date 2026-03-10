import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Input, Select, Button, Card } from '../components/ui/index';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { clientsApi } from '../api/clients';
import apiClient from '../api/client';

const ACCOUNT_TYPES = [
  { value: 'ENTERPRISE', label: 'Enterprise' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'SMB', label: 'SMB' },
  { value: 'GOVERNMENT', label: 'Government' },
];

const CLIENT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function NewClientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', brand: '', account_type: 'ENTERPRISE', status: 'PROSPECT', industry_id: '',
  });

  const { data: industriesData } = useQuery({
    queryKey: ['industries'],
    queryFn: async () => {
      const res = await apiClient.get('/industries');
      const body = res.data as any;
      return (body.industries ?? body) as { id: string; name: string }[];
    },
  });
  const industryOptions = (industriesData ?? []).map(i => ({ value: i.id, label: i.name }));

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const createMutation = useMutation({
    mutationFn: (data: any) => clientsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); navigate('/clients'); },
    onError: (err: any) => alert(err?.response?.data?.error ?? 'Failed to create client'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.industry_id) delete payload.industry_id;
    if (!payload.brand) delete payload.brand;
    createMutation.mutate(payload);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to="/clients" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <h1 className="font-bold text-base font-display text-[#1a1d2e]">New Client</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">
          <Card className="p-6">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Client Information
            </div>
            <div className="flex flex-col gap-4">
              <Input
                label="Company Name"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="TechCorp Philippines"
                required
              />
              <Input
                label="Brand Name (optional)"
                value={form.brand}
                onChange={e => update('brand', e.target.value)}
                placeholder="TechCorp"
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Account Type"
                  value={form.account_type}
                  onChange={e => update('account_type', e.target.value)}
                  options={ACCOUNT_TYPES}
                  required
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={e => update('status', e.target.value)}
                  options={CLIENT_STATUSES}
                  required
                />
              </div>
              <Select
                label="Industry"
                value={form.industry_id}
                onChange={e => update('industry_id', e.target.value)}
                options={industryOptions}
                placeholder="Select industry..."
              />
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit">Create Client</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
