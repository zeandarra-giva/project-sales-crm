import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Trophy, AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useExecutiveDashboard } from '../hooks/useDashboard';
import { formatCurrency, cn } from '../lib/utils';

const QUARTERS: Array<{ label: string; year: number; q: number }> = [
  { label: 'Q1 2026', year: 2026, q: 1 },
  { label: 'Q4 2025', year: 2025, q: 4 },
  { label: 'Q3 2025', year: 2025, q: 3 },
  { label: 'Q2 2025', year: 2025, q: 2 },
];

export default function ExecutiveDashboard() {
  const [selectedQ, setSelectedQ] = useState(QUARTERS[0]);
  const { data, isLoading } = useExecutiveDashboard(selectedQ.year, selectedQ.q);

  const team = data?.team;
  const leaderboard = data?.leaderboard ?? [];
  const stuckDeals = data?.stuck_deals ?? [];
  const pipelineByStage = data?.pipeline_by_stage ?? [];
  const byAccountType = data?.by_account_type ?? [];
  const byService = data?.by_service ?? [];

  const stageData = pipelineByStage.map(row => ({
    stage: (row as any).stage_name ?? row.stage_id,
    total_value: Number((row._sum as any)?.revenue ?? 0),
    count: (row._count as any)?.id ?? 0,
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Executive Dashboard" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center text-sm text-[#8b90a8]">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle={`Team-wide performance · ${selectedQ.label}`} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quarter selector */}
        <div className="flex items-center gap-2 mb-6">
          {QUARTERS.map(q => (
            <button key={q.label} onClick={() => setSelectedQ(q)} className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              q.label === selectedQ.label
                ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
            )}>
              {q.label}
            </button>
          ))}
        </div>

        {/* Team metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Team Actual" value={formatCurrency(team?.total_revenue ?? 0, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(team?.total_quota ?? 0, true)} sub="this quarter" accent="#4f6ef7" delay={50} />
          <MetricCard label="Team Forecast" value={formatCurrency(team?.sales_forecast ?? 0, true)} sub="Won + Negotiation" accent="#8b5cf6" delay={100} />
          <MetricCard label="Attainment" value={`${(team?.attainment_pct ?? 0).toFixed(1)}%`} sub="of quarterly quota" accent="#f59e0b" delay={150} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Pipeline funnel */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4a4f6b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, name: string) => [
                      name === 'total_value' ? formatCurrency(val) : val,
                      name === 'total_value' ? 'Total Value' : 'Count',
                    ]}
                  />
                  <Bar dataKey="total_value" fill="#4f6ef730" stroke="#4f6ef7" strokeWidth={1} radius={[0, 4, 4, 0]} name="total_value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Stuck deals */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
              <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {stuckDeals.map((deal: any) => (
                <div key={deal.id} className="p-3 bg-[#f4f6fb] border border-[#d9770620] rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{deal.deal_name}</span>
                    <span className="text-xs text-[#d97706] font-bold">{deal.days_in_stage ?? deal.days_in_current_stage}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StagePill stage={deal.stage?.name ?? deal.stage} size="sm" />
                    <span className="text-xs text-[#8b90a8]">{deal.bd?.first_name}</span>
                  </div>
                </div>
              ))}
              {stuckDeals.length === 0 && (
                <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals 🎉</div>
              )}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · {selectedQ.label}</span>
          </div>
          <div className="flex flex-col gap-0">
            <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
              <div className="col-span-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">#</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Member</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Closed Rev.</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Attainment</div>
              <div className="col-span-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">Win Rate</div>
            </div>
            {leaderboard.map((entry, idx) => {
              const rankColors = ['#f59e0b', '#8b90a8', '#cd7f32'];
              return (
                <div key={entry.bd.id} className="grid grid-cols-12 gap-4 py-3 border-b border-[#f0f2f8] hover:bg-[#fafbfd] transition-colors">
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-bold font-display" style={{ color: rankColors[idx] || '#4a4f6b' }}>{idx + 1}</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Avatar name={`${entry.bd.first_name} ${entry.bd.last_name}`} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d2e] truncate">{entry.bd.first_name}</div>
                      <div className="text-[10px] text-[#8b90a8] truncate">{entry.bd.role}</div>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(entry.revenue, true)}</span>
                  </div>
                  <div className="col-span-3 flex flex-col justify-center gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4a5068]">{entry.attainment_pct.toFixed(1)}%</span>
                      <span className="text-[#8b90a8]">{formatCurrency(entry.quota, true)}</span>
                    </div>
                    <ProgressBar value={entry.attainment_pct} color={entry.attainment_pct > 50 ? '#10b981' : entry.attainment_pct > 20 ? '#f59e0b' : '#f43f5e'} />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant={entry.win_rate > 50 ? 'success' : entry.win_rate > 20 ? 'warning' : 'danger'} size="sm">
                      {entry.win_rate}%
                    </Badge>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-xs text-[#8b90a8]">No data for this quarter</div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By account type */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deals by Account Type</div>
            <div className="flex flex-col gap-2">
              {byAccountType.map((item: any, i) => {
                const colors = ['#4f6ef7', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <div key={item.account_type} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="text-xs text-[#4a5068] capitalize">{item.account_type?.toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue, true)}</span>
                      <Badge variant="neutral" size="sm">{item.count} deals</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* By service */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Service Performance</div>
            <div className="flex flex-col gap-2">
              {byService.map((svc: any) => (
                <div key={svc.service} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d2e]">{svc.service}</div>
                    <div className="text-[10px] text-[#8b90a8]">{svc.count} deals</div>
                  </div>
                  <span className="text-xs font-bold text-[#1a1d2e] flex-shrink-0">{formatCurrency(svc.revenue, true)}</span>
                </div>
              ))}
              {byService.length === 0 && (
                <p className="text-xs text-[#8b90a8] text-center py-4">No closed deals this quarter</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
