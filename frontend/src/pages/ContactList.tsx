import { useState } from 'react';
import { Search, Mail, Phone, Star, Pencil, Trash2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, Avatar, Button, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import { useContacts, useUpdateContact } from '../hooks/useContacts';
import { useClients } from '../hooks/useClients';
import { cn } from '../lib/utils';
import type { Contact, DecisionRank } from '../types/index';

const RANK_CONFIG: Record<DecisionRank, { color: string }> = {
  'Tier 1 Economic Buyer': { color: '#d97706' },
  'Tier 2 Decision Maker': { color: '#3d5af1' },
  'Tier 3 Influencer':     { color: '#7c3aed' },
  'Tier 4 End User':       { color: '#059669' },
  'Tier 5 Gatekeeper':     { color: '#e11d48' },
};

const DECISION_RANKS: DecisionRank[] = [
  'Tier 1 Economic Buyer', 'Tier 2 Decision Maker', 'Tier 3 Influencer',
  'Tier 4 End User', 'Tier 5 Gatekeeper',
];

const RANKS: (DecisionRank | 'All')[] = ['All', ...DECISION_RANKS];

export default function ContactList() {
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState<DecisionRank | 'All'>('All');

  const { data: contacts = [], isLoading } = useContacts();
  const { data: clients = [] } = useClients();
  const updateContact = useUpdateContact();

  // Edit state
  const [editing, setEditing] = useState<Contact | null>(null);
  const [draft, setDraft]     = useState<Partial<Contact>>({});

  const filtered = contacts.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !c.email.includes(search.toLowerCase())) return false;
    if (rankFilter !== 'All' && c.decision_rank !== rankFilter) return false;
    return true;
  });

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setDraft({ ...contact });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateContact.mutate({
      id: editing.id,
      data: {
        firstName: draft.first_name,
        lastName: draft.last_name,
        email: draft.email,
        phone: draft.number,
        jobTitle: draft.designation,
        isPrimary: draft.is_primary,
      },
    });
    setEditing(null);
  };

  const ud = (field: keyof Contact, val: string | boolean) => setDraft(p => ({ ...p, [field]: val }));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Contacts" action={{ label: 'New Contact', to: '/contacts/new' }} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8b90a8]">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Contacts" subtitle={`${contacts.length} contacts`} action={{ label: 'New Contact', to: '/contacts/new' }} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b90a8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="h-9 w-56 bg-white border border-[#e2e6f0] rounded-xl pl-8 pr-3 text-sm text-[#1a1d2e] placeholder-[#8b90a8] focus:outline-none focus:border-[#c7d0fb]"
            />
          </div>
          <select
            value={rankFilter}
            onChange={e => setRankFilter(e.target.value as any)}
            className="h-9 bg-white border border-[#e2e6f0] rounded-xl px-3 text-xs text-[#4a5068] focus:outline-none cursor-pointer"
          >
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {(search || rankFilter !== 'All') && (
            <button onClick={() => { setSearch(''); setRankFilter('All'); }} className="text-xs text-[#8b90a8] hover:text-[#4a5068] transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(contact => {
            const client   = clients.find(c => c.id === contact.client_id);
            const rankConf = RANK_CONFIG[contact.decision_rank] || { color: '#8b90a8' };
            return (
              <Card key={contact.id} className="p-4 hover:border-[#c7d0fb] transition-all group relative">
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(contact)} className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-all" title="Edit">
                    <Pencil size={12} />
                  </button>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={`${contact.first_name} ${contact.last_name}`} />
                  <div className="flex-1 min-w-0 pr-10">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[#1a1d2e] truncate">{contact.first_name} {contact.last_name}</h3>
                      {contact.is_primary && <Star size={10} className="text-[#d97706] fill-[#f59e0b] flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-[#8b90a8] truncate">{contact.designation}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mb-3">
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-[#4a5068] hover:text-[#3d5af1] transition-colors">
                    <Mail size={11} className="text-[#8b90a8]" />
                    <span className="truncate">{contact.email}</span>
                  </a>
                  {contact.number && (
                    <div className="flex items-center gap-2 text-xs text-[#8b90a8]">
                      <Phone size={11} /> <span>{contact.number}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#f0f2f8] pt-3">
                  <Badge size="sm" style={{ background: `${rankConf.color}15`, color: rankConf.color, borderColor: `${rankConf.color}30` }}>
                    {contact.decision_rank.split(' ').slice(0, 2).join(' ')}
                  </Badge>
                  {client && <span className="text-[10px] text-[#8b90a8] truncate">{client.name}</span>}
                </div>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-[#8b90a8]">No contacts match the current filters</div>
        )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────── */}
      {editing && (
        <EditModal title="Edit Contact" onClose={() => setEditing(null)} onSave={saveEdit}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={draft.first_name ?? ''} onChange={e => ud('first_name', e.target.value)} required />
            <Input label="Last Name"  value={draft.last_name  ?? ''} onChange={e => ud('last_name',  e.target.value)} required />
          </div>
          <Input label="Email" type="email" value={draft.email ?? ''} onChange={e => ud('email', e.target.value)} required />
          <Input label="Phone" type="tel"   value={draft.number ?? ''} onChange={e => ud('number', e.target.value)} />
          <Input label="Designation" value={draft.designation ?? ''} onChange={e => ud('designation', e.target.value)} />
          <Select
            label="Decision Rank"
            value={draft.decision_rank ?? ''}
            onChange={e => ud('decision_rank', e.target.value)}
            options={DECISION_RANKS.map(r => ({ value: r, label: r }))}
          />
          <div>
            <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider block mb-1.5">Primary Contact</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => ud('is_primary', !draft.is_primary)}
                className={`relative w-10 h-5 rounded-full transition-all ${draft.is_primary ? 'bg-[#3d5af1]' : 'bg-[#e2e6f0]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${draft.is_primary ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-[#4a5068]">{draft.is_primary ? 'Primary contact' : 'Secondary contact'}</span>
            </div>
          </div>
        </EditModal>
      )}
    </div>
  );
}
