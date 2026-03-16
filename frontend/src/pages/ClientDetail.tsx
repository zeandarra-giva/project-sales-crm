import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2, Plus, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Card, Badge, Avatar, Button, Input, Select } from '../components/ui/index';
import { EditModal } from '../components/ui/EditModal';
import StagePill from '../components/deals/StagePill';
import { INDUSTRIES } from '../mockData';
import { useClient, useUpdateClient } from '../hooks/useClients';
import { useContacts, useUpdateContact } from '../hooks/useContacts';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency, formatDate } from '../lib/utils';
import type { AccountType, Client, Contact, DecisionRank } from '../types/index';

const ACCOUNT_COLORS: Record<AccountType, string> = {
  Enterprise: '#3d5af1', Corporate: '#059669', SMB: '#d97706', Government: '#7c3aed',
};
const ACCOUNT_TYPES  = ['Enterprise', 'Corporate', 'SMB', 'Government'];
const CLIENT_STATUSES = ['Active', 'Inactive', 'Prospect'];
const DECISION_RANKS: DecisionRank[] = [
  'Tier 1 Economic Buyer', 'Tier 2 Decision Maker', 'Tier 3 Influencer', 'Tier 4 End User', 'Tier 5 Gatekeeper',
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading: loadingClient } = useClient(id || '');
  const { data: allContacts = [] } = useContacts();
  const { data: allDeals = [] } = useDeals();
  const updateClient = useUpdateClient();
  const updateContact = useUpdateContact();

  const contacts = allContacts.filter(c => c.client_id === id);
  const clientDeals = allDeals.filter(d => d.client_id === id);

  // Edit client modal
  const [editClient, setEditClient] = useState(false);
  const [clientDraft, setClientDraft] = useState<Partial<Client>>({});

  // Edit contact modal
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactDraft, setContactDraft] = useState<Partial<Contact>>({});

  if (loadingClient) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-[#8b90a8]">Loading client...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="text-sm text-[#8b90a8]">Client not found</div>
        <Button variant="secondary" onClick={() => navigate('/clients')}>Back to Clients</Button>
      </div>
    );
  }

  const closedRevenue = clientDeals.filter(d => d.stage === 'Closed Won').reduce((s, d) => s + d.revenue, 0);
  const openPipeline  = clientDeals.filter(d => !d.is_closed).reduce((s, d) => s + d.revenue, 0);
  const color         = ACCOUNT_COLORS[client.account_type] || '#4a5068';

  // ── Client edit handlers ──────────────────────────────────────────
  const openEditClient = () => {
    setClientDraft({ name: client.name, brand: client.brand, account_type: client.account_type, status: client.status });
    setEditClient(true);
  };

  const saveClient = () => {
    updateClient.mutate({ id: client.id, data: clientDraft });
    setEditClient(false);
  };

  // ── Contact edit handlers ─────────────────────────────────────────
  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactDraft({ ...contact });
  };

  const saveContact = () => {
    if (!editingContact) return;
    updateContact.mutate({
      id: editingContact.id,
      data: {
        firstName: contactDraft.first_name,
        lastName: contactDraft.last_name,
        email: contactDraft.email,
        phone: contactDraft.number,
        jobTitle: contactDraft.designation,
        isPrimary: contactDraft.is_primary,
      },
    });
    setEditingContact(null);
  };

  const uc = (field: keyof Client, val: string) => setClientDraft(p => ({ ...p, [field]: val }));
  const ucon = (field: keyof Contact, val: string | boolean) => setContactDraft(p => ({ ...p, [field]: val }));

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 h-16 px-6 border-b border-[#e2e6f0] bg-white flex-shrink-0">
        <Link to="/clients" className="text-[#8b90a8] hover:text-[#1a1d2e] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="h-4 w-px bg-[#e2e6f0]" />
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold font-display text-sm flex-shrink-0" style={{ background: `${color}18`, color }}>
          {client.name[0]}
        </div>
        <div>
          <h1 className="font-bold text-base font-display text-[#1a1d2e] leading-none">{client.name}</h1>
          {client.brand && client.brand !== client.name && <p className="text-xs text-[#8b90a8]">{client.brand}</p>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={openEditClient}><Pencil size={12} /> Edit Client</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/contacts/new?client_id=${id}`)}><Plus size={12} /> Add Contact</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/deals/new?client_id=${id}`)}><Plus size={12} /> New Deal</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#f4f6fb]">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Closed Revenue', value: formatCurrency(closedRevenue, true), color: '#059669' },
              { label: 'Open Pipeline',  value: formatCurrency(openPipeline, true),  color: '#3d5af1' },
              { label: 'Total Deals',    value: String(clientDeals.length),           color: '#1a1d2e' },
              { label: 'Contacts',       value: String(contacts.length),              color: '#7c3aed' },
            ].map(m => (
              <Card key={m.label} className="p-4 text-center">
                <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                <div className="text-xl font-bold font-display" style={{ color: m.color }}>{m.value}</div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Details */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Details</div>
                <button onClick={openEditClient} className="text-[#8b90a8] hover:text-[#3d5af1] transition-colors"><Pencil size={13} /></button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] text-[#8b90a8] uppercase tracking-wider mb-1">Account Type</div>
                  <Badge size="sm" style={{ background: `${color}15`, color, borderColor: `${color}30` }}>{client.account_type}</Badge>
                </div>
                <div>
                  <div className="text-[10px] text-[#8b90a8] uppercase tracking-wider mb-1">Status</div>
                  <Badge variant={client.status === 'Active' ? 'success' : client.status === 'Prospect' ? 'warning' : 'neutral'} size="sm">{client.status}</Badge>
                </div>
                {client.industry && (
                  <div>
                    <div className="text-[10px] text-[#8b90a8] uppercase tracking-wider mb-1">Industry</div>
                    <div className="text-xs text-[#4a5068] flex items-center gap-1"><Building2 size={11} className="text-[#8b90a8]" /> {client.industry.name}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Contacts */}
            <Card className="p-5 col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Contacts</div>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/contacts/new?client_id=${id}`)}><Plus size={12} /> Add</Button>
              </div>
              {contacts.length === 0 ? (
                <div className="text-xs text-[#8b90a8] py-4 text-center">No contacts yet</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f4f6fb] transition-all group">
                      <Avatar name={`${contact.first_name} ${contact.last_name}`} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#1a1d2e]">{contact.first_name} {contact.last_name}</span>
                          {contact.is_primary && (
                            <span className="text-[9px] bg-[#eef1fe] text-[#3d5af1] border border-[#c7d0fb] px-1.5 py-0.5 rounded-full font-medium">Primary</span>
                          )}
                        </div>
                        {contact.designation && <div className="text-[10px] text-[#8b90a8]">{contact.designation}</div>}
                        <div className="flex items-center gap-2 mt-0.5">
                          <a href={`mailto:${contact.email}`} className="text-[10px] text-[#3d5af1] hover:underline flex items-center gap-0.5">
                            <Mail size={9} /> {contact.email}
                          </a>
                          {contact.number && (
                            <span className="text-[10px] text-[#8b90a8] flex items-center gap-0.5"><Phone size={9} /> {contact.number}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="neutral" size="sm">{contact.decision_rank.replace('Tier ', 'T')}</Badge>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button onClick={() => openEditContact(contact)} className="p-1 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-all" title="Edit contact">
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Deals */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Deals</div>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/deals/new?client_id=${id}`)}><Plus size={12} /> New Deal</Button>
            </div>
            {clientDeals.length === 0 ? (
              <div className="text-xs text-[#8b90a8] py-6 text-center">No deals yet</div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-12 gap-3 px-2 py-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">
                  <div className="col-span-4">Deal</div>
                  <div className="col-span-3">Stage</div>
                  <div className="col-span-3">Revenue</div>
                  <div className="col-span-2">Date</div>
                </div>
                {clientDeals.map(deal => (
                  <Link key={deal.id} to={`/deals/${deal.id}`} className="grid grid-cols-12 gap-3 px-2 py-2.5 rounded-xl hover:bg-[#f4f6fb] items-center transition-all group">
                    <div className="col-span-4 text-xs font-semibold text-[#1a1d2e] group-hover:text-[#3d5af1] truncate transition-colors">{deal.deal_name}</div>
                    <div className="col-span-3"><StagePill stage={deal.stage} size="sm" /></div>
                    <div className="col-span-3 text-xs font-bold font-display text-[#1a1d2e]">{formatCurrency(deal.revenue, true)}</div>
                    <div className="col-span-1 text-xs text-[#8b90a8]">{deal.closed_date ? formatDate(deal.closed_date) : deal.due_date ? formatDate(deal.due_date) : '—'}</div>
                    <div className="col-span-1 flex justify-end"><ExternalLink size={11} className="text-[#8b90a8] opacity-0 group-hover:opacity-100" /></div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Edit Client Modal ─────────────────────────────────────────── */}
      {editClient && (
        <EditModal title="Edit Client" onClose={() => setEditClient(false)} onSave={saveClient}>
          <Input label="Company Name" value={clientDraft.name ?? ''} onChange={e => uc('name', e.target.value)} required />
          <Input label="Brand Name" value={clientDraft.brand ?? ''} onChange={e => uc('brand', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Account Type" value={clientDraft.account_type ?? client.account_type} onChange={e => uc('account_type', e.target.value)} options={ACCOUNT_TYPES.map(t => ({ value: t, label: t }))} />
            <Select label="Status" value={clientDraft.status ?? client.status} onChange={e => uc('status', e.target.value)} options={CLIENT_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <Select
            label="Industry"
            value={clientDraft.industry?.name ?? ''}
            onChange={e => setClientDraft(p => ({ ...p, industry: { id: `ind-${Date.now()}`, name: e.target.value } }))}
            options={INDUSTRIES.map(i => ({ value: i, label: i }))}
            placeholder="Select industry..."
          />
        </EditModal>
      )}

      {/* ── Edit Contact Modal ────────────────────────────────────────── */}
      {editingContact && (
        <EditModal title="Edit Contact" onClose={() => setEditingContact(null)} onSave={saveContact}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={contactDraft.first_name ?? ''} onChange={e => ucon('first_name', e.target.value)} required />
            <Input label="Last Name"  value={contactDraft.last_name  ?? ''} onChange={e => ucon('last_name', e.target.value)}  required />
          </div>
          <Input label="Email" type="email" value={contactDraft.email ?? ''} onChange={e => ucon('email', e.target.value)} required />
          <Input label="Phone" type="tel" value={contactDraft.number ?? ''} onChange={e => ucon('number', e.target.value)} />
          <Input label="Designation" value={contactDraft.designation ?? ''} onChange={e => ucon('designation', e.target.value)} />
          <Select
            label="Decision Rank"
            value={contactDraft.decision_rank ?? editingContact.decision_rank}
            onChange={e => ucon('decision_rank', e.target.value)}
            options={DECISION_RANKS.map(r => ({ value: r, label: r }))}
          />
          <div>
            <label className="text-xs font-medium text-[#4a5068] uppercase tracking-wider block mb-1.5">Primary Contact</label>
            <button
              type="button"
              onClick={() => ucon('is_primary', !contactDraft.is_primary)}
              className={`relative w-10 h-5 rounded-full transition-all ${contactDraft.is_primary ? 'bg-[#3d5af1]' : 'bg-[#e2e6f0]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${contactDraft.is_primary ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </EditModal>
      )}
    </div>
  );
}
