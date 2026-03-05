import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import Header from '../components/layout/Header';
import { Card, Badge } from '../components/ui/index';
import { MOCK_DEALS, PIPELINE_BY_STAGE } from '../mockData';
import { formatCurrency, cn } from '../lib/utils';

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {value} ({(percent * 100).toFixed(0)}%)
    </text>
  );
};

const TABS = ['Pipeline', 'Quota Performance', 'Win/Loss', 'Sales Cycle', 'Service Performance', 'Growth'];
const WIN_LOSS_DATA = [
  { name: 'Won',    value: 1, color: '#059669' },
  { name: 'Lost',   value: 1, color: '#e11d48' },
  { name: 'Active', value: 5, color: '#3d5af1' },
];
const SALES_CYCLE_DATA = [
  { stage: 'Inquiry',       avg_days: 2.5 },
  { stage: 'Prospecting',   avg_days: 7   },
  { stage: 'Discovery',     avg_days: 15  },
  { stage: 'Proposal Sent', avg_days: 30  },
  { stage: 'Negotiation',   avg_days: 45  },
];
const GROWTH_DATA = [
  { period: 'Q3 25', revenue: 0 },
  { period: 'Q4 25', revenue: 1958162 },
  { period: 'Q1 26', revenue: 1958162 },
];
const SERVICE_PERF = [
  { name: 'LOCOBUZZ',   deals: 3, revenue: 1440000, win_rate: 50 },
  { name: 'MEDIAWATCH', deals: 3, revenue: 1568162, win_rate: 67 },
  { name: 'SHAREDVIEW', deals: 1, revenue: 0,       win_rate: 0  },
  { name: 'REPORTS',    deals: 1, revenue: 0,       win_rate: 0  },
];
const QUOTA_DATA = [
  { name: 'Henne', quota: 7000000, actual: 1568162 },
  { name: 'Isten', quota: 7000000, actual: 390000  },
  { name: 'Brian', quota: 7000000, actual: 0       },
];
const COLORS = ['#3d5af1', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];
const TT = {
  contentStyle: { background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' },
  itemStyle: { color: '#4a5068' },
  labelStyle: { color: '#1a1d2e', fontWeight: 600 },
};

export default function ReportsPage() {
  const [tab, setTab] = useState('Pipeline');
  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" subtitle="Analytics and performance insights" action={{ label: 'Export', onClick: () => alert('Export coming soon') }} />
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-1 px-6 pt-4 pb-0 overflow-x-auto border-b border-[#e2e6f0]">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px', tab === t ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-[#8b90a8] border-transparent hover:text-[#4a5068]')}>
              {t}
            </button>
          ))}
        </div>
        <div className="p-6">

          {tab === 'Pipeline' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Total Pipeline', value: formatCurrency(8100000, true) }, { label: 'Weighted Value', value: formatCurrency(3312000, true) }, { label: 'Active Deals', value: '5' }].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-2xl font-bold font-display text-[#1a1d2e]">{m.value}</div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline Value by Stage</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={PIPELINE_BY_STAGE} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="stage" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), 'Value']} />
                      <Bar dataKey="total_value" radius={[4, 4, 0, 0]}>
                        {PIPELINE_BY_STAGE.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length] + '40'} stroke={COLORS[i % COLORS.length]} strokeWidth={1} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {tab === 'Win/Loss' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Status Distribution</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={WIN_LOSS_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={renderPieLabel}>
                        {WIN_LOSS_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Legend formatter={val => <span style={{ color: '#6b7280', fontSize: 12 }}>{val}</span>} />
                      <Tooltip {...TT} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Lost Deals Analysis</div>
                <div className="flex flex-col gap-3">
                  {MOCK_DEALS.filter(d => d.stage === 'Closed Lost').map(deal => (
                    <div key={deal.id} className="p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-semibold text-[#1a1d2e]">{deal.deal_name}</span>
                        <span className="text-xs text-[#e11d48]">{formatCurrency(deal.final_proposed_value || 0, true)}/mo</span>
                      </div>
                      <p className="text-xs text-[#4a5068] leading-relaxed">{deal.remarks}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#8b90a8]">Cycle: {deal.sales_cycle_days}d</span>
                        <span className="text-[10px] text-[#8b90a8]">·</span>
                        <span className="text-[10px] text-[#8b90a8]">{deal.proposal_revision_count} revisions</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === 'Sales Cycle' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Avg. Days per Stage</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SALES_CYCLE_DATA} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
                      <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TT} formatter={(val: number) => [`${val} days`, 'Avg. Duration']} />
                      <Bar dataKey="avg_days" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Bottleneck Stage', value: 'Negotiation', sub: '45 avg days' }, { label: 'Avg. Sales Cycle', value: '67 days', sub: 'closed deals' }, { label: 'Fastest Close', value: '45 days', sub: 'TechCorp MEDIAWATCH' }].map(m => (
                  <Card key={m.label} className="p-4">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-lg font-bold font-display text-[#1a1d2e]">{m.value}</div>
                    <div className="text-xs text-[#8b90a8] mt-0.5">{m.sub}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === 'Service Performance' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue by Service</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SERVICE_PERF} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), 'Revenue']} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {SERVICE_PERF.map((_, i) => <Cell key={i} fill={COLORS[i]} fillOpacity={0.75} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {SERVICE_PERF.map((svc, i) => (
                  <Card key={svc.name} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                      <span className="text-xs font-bold font-display text-[#1a1d2e]">{svc.name}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Revenue</span><span className="text-[#4a5068] font-medium">{formatCurrency(svc.revenue, true)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Deals</span><span className="text-[#4a5068] font-medium">{svc.deals}</span></div>
                      <div className="flex justify-between text-xs items-center"><span className="text-[#8b90a8]">Win Rate</span><Badge variant={svc.win_rate > 50 ? 'success' : svc.win_rate > 0 ? 'warning' : 'neutral'} size="sm">{svc.win_rate}%</Badge></div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === 'Growth' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue Growth QoQ</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={GROWTH_DATA} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3d5af1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3d5af1" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="period" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#3d5af1" strokeWidth={2} fill="url(#growthGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Q4 25 Revenue', value: '₱1.96M', sub: 'baseline' }, { label: 'Q1 26 YTD', value: '₱1.96M', sub: '0% QoQ' }, { label: 'Projected Q1 26', value: '₱5.2M', sub: 'incl. negotiation' }].map(m => (
                  <Card key={m.label} className="p-4">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-2xl font-bold font-display text-[#1a1d2e]">{m.value}</div>
                    <div className="text-xs text-[#8b90a8] mt-1">{m.sub}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === 'Quota Performance' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Quota vs Actual by BD Member · Q1 2026</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={QUOTA_DATA} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' }} labelStyle={{ color: '#1a1d2e', fontWeight: 600 }} itemStyle={{ color: '#4a5068' }} formatter={(val: number) => [formatCurrency(val), '']} />
                      <Bar dataKey="quota"  name="Quota"  fill="#e6eaf5" stroke="#c8cfe8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
