import { useState } from 'react';
import { Building2, Search, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { Card, Badge, Avatar } from '../components/ui/index';
import { useClients } from '../hooks/useClients';
import { useDeals } from '../hooks/useDeals';
import { formatCurrency, cn } from '../lib/utils';
import type { AccountType } from '../types/index';

const ACCOUNT_TYPES: (AccountType | 'All')[] = ['All', 'Enterprise', 'Corporate', 'SMB', 'Government'];
const ACCOUNT_COLORS: Record<AccountType, string> = {
  Enterprise: '#4f6ef7',
  Corporate: '#10b981',
  SMB: '#f59e0b',
  Government: '#8b5cf6',
};

export default function ClientList() {
  const [typeFilter, setTypeFilter] = useState<AccountType | 'All'>('All');
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: deals = [] } = useDeals();

  const filteredClients = clients.filter(c => {
    if (typeFilter !== 'All' && c.account_type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getClientRevenue = (clientId: string) =>
    deals.filter(d => d.client_id === clientId && d.stage === 'Closed Won')
      .reduce((sum, d) => sum + d.revenue, 0);

  const getClientDeals = (clientId: string) =>
    deals.filter(d => d.client_id === clientId).length;

  if (loadingClients) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Clients" action={{ label: 'New Client', to: '/clients/new' }} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8b90a8]">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Clients" subtitle={`${clients.length} accounts`} action={{ label: 'New Client', to: '/clients/new' }} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b90a8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="h-9 w-56 bg-white border border-[#e2e6f0] rounded-xl pl-8 pr-3 text-sm text-[#1a1d2e] placeholder-[#8b90a8] focus:outline-none focus:border-[#818cf8]"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#e2e6f0] rounded-xl p-1">
            {ACCOUNT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  typeFilter === t ? 'text-white' : 'text-[#8b90a8] hover:text-[#4a5068]'
                )}
                style={typeFilter === t && t !== 'All' ? {
                  background: `${ACCOUNT_COLORS[t as AccountType]}20`,
                  color: ACCOUNT_COLORS[t as AccountType],
                  border: `1px solid ${ACCOUNT_COLORS[t as AccountType]}40`,
                } : typeFilter === t ? { background: '#ffffff10', color: '#ffffff' } : {}}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Client grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredClients.map((client) => {
            const revenue = getClientRevenue(client.id);
            const dealCount = getClientDeals(client.id);
            const color = ACCOUNT_COLORS[client.account_type];

            return (
              <Link key={client.id} to={`/clients/${client.id}`}>
                <Card className="p-5 hover:border-[#c7d0fb] transition-all cursor-pointer group">
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold font-display text-sm"
                      style={{ background: `${color}18`, color }}
                    >
                      {client.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#1a1d2e] group-hover:text-[#3d5af1] transition-colors truncate">{client.name}</h3>
                      {client.brand && client.brand !== client.name && (
                        <p className="text-xs text-[#8b90a8] truncate">{client.brand}</p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-[#8b90a8] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>

                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Badge size="sm" style={{ background: `${color}15`, color, borderColor: `${color}30` }}>
                      {client.account_type}
                    </Badge>
                    <Badge variant={client.status === 'Active' ? 'success' : client.status === 'Prospect' ? 'warning' : 'neutral'} size="sm">
                      {client.status}
                    </Badge>
                    {client.industry && (
                      <span className="text-[10px] text-[#8b90a8]">{client.industry.name}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#f0f2f8] pt-3">
                    <div>
                      <div className="text-xs text-[#8b90a8]">Closed Revenue</div>
                      <div className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(revenue, true)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#8b90a8]">Total Deals</div>
                      <div className="text-sm font-bold font-display text-[#1a1d2e]">{dealCount}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
