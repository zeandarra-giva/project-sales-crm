import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
  ComposedChart, Bar, Line, Legend,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, Briefcase, AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import { MetricCard, Card, Badge, ProgressBar } from '../components/ui/index';
import DealCard from '../components/deals/DealCard';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { useBDDashboard } from '../hooks/useDashboard';
import { formatCurrency, cn } from '../lib/utils';

const QUARTERS: Array<{ label: string; year: number; q: number }> = [
  { label: 'Q1 2026', year: 2026, q: 1 },
  { label: 'Q4 2025', year: 2025, q: 4 },
  { label: 'Q3 2025', year: 2025, q: 3 },
  { label: 'Q2 2025', year: 2025, q: 2 },
];

const STAGE_COLORS: Record<string, string> = {
  Inquiry: '#64748b',
  Prospecting: '#3b82f6',
  Discovery: '#8b5cf6',
  'Proposal Sent': '#f59e0b',
  Negotiation: '#f97316',
};

export default function BDDashboard() {
  const { user } = useAuthStore();
  const [selectedQ, setSelectedQ] = useState(QUARTERS[0]);
  const { data, isLoading } = useBDDashboard(selectedQ.year, selectedQ.q);

  const metrics = data?.metrics;
  const stuckDeals = data?.stuck_deals ?? [];
  const pipelineByStage = data?.pipeline_by_stage ?? [];
  const revenueTrend = data?.revenue_trend ?? [];
  const monthlyForecast = data?.monthly_forecast ?? [];

  const attainmentPct = Math.min(metrics?.quota_attainment_pct ?? 0, 100);
  const isAhead = (metrics?.quarterly_excess_deficit ?? 0) >= 0;

  // Build monthly area chart from revenueTrend
  const monthlyMap: Record<string, number> = {};
  revenueTrend.forEach(r => {
    const month = new Date(r.closed_date).toLocaleString('en-PH', { month: 'short' });
    monthlyMap[month] = (monthlyMap[month] ?? 0) + Number(r.revenue ?? 0);
  });
  const monthlyQuota = (metrics?.monthly_quota ?? 0);
  const chartData = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map(m => ({
    month: m,
    actual: monthlyMap[m] ?? 0,
    quota: monthlyQuota,
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title={`${user?.first_name ?? 'My'}'s Dashboard`} subtitle="Loading…" action={{ label: 'New Deal', to: '/deals/new' }} />
        <div className="flex-1 flex items-center justify-center text-sm text-[#8b90a8]">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${user?.first_name}'s Dashboard`}
        subtitle={`${selectedQ.label} · ${data?.period?.start ? new Date(data.period.start).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''} – ${data?.period?.end ? new Date(data.period.end).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quarter selector */}
        <div className="flex items-center gap-2 mb-6">
          {QUARTERS.map(q => (
            <button
              key={q.label}
              onClick={() => setSelectedQ(q)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                q.label === selectedQ.label
                  ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                  : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Quota attainment hero */}
        <Card className="p-6 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4f6ef708] to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-medium text-[#4a5068] uppercase tracking-wider mb-2 font-display">Quota Attainment · {selectedQ.label}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold font-display text-[#1a1d2e]">{(metrics?.quota_attainment_pct ?? 0).toFixed(1)}%</span>
                <div>
                  <div className="text-sm text-[#4a5068]">{formatCurrency(metrics?.actual_revenue ?? 0, true)} closed</div>
                  <div className="text-xs text-[#8b90a8]">of {formatCurrency(metrics?.quota ?? 0, true)} quota</div>
                </div>
              </div>
              <ProgressBar
                value={attainmentPct}
                className="mt-4 h-2 w-72"
                color={attainmentPct >= 100 ? '#10b981' : attainmentPct >= 50 ? '#f59e0b' : '#4f6ef7'}
              />
            </div>
            <div className="flex flex-col items-center">
              <div className="w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="70%" outerRadius="100%"
                    data={[{ value: attainmentPct, fill: '#4f6ef7' }]}
                    startAngle={90} endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: '#ffffff0a' }} cornerRadius={4} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#1a1d2e" fontSize={20} fontFamily="Syne">
                      {attainmentPct.toFixed(0)}%
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <MetricCard label="Deals Closed" value={metrics?.deals_closed_won ?? 0} sub="this quarter" accent="#10b981" icon={<Target size={16} />} delay={0} />
          <MetricCard label="Open Pipeline" value={metrics?.open_deals ?? 0} sub={`${stuckDeals.length} stuck`} accent={stuckDeals.length > 0 ? '#f59e0b' : '#4f6ef7'} icon={<Briefcase size={16} />} delay={50} />
          <MetricCard label="Sales Forecast" value={formatCurrency(metrics?.sales_forecast ?? 0, true)} sub="closed + negotiation" accent="#8b5cf6" icon={<TrendingUp size={16} />} delay={100} />
          <MetricCard label="Sales Variance" value={formatCurrency(Math.abs(metrics?.sales_variance ?? 0), true)} sub={(metrics?.sales_variance ?? 0) > 0 ? 'below quota' : 'above quota'} accent={(metrics?.sales_variance ?? 0) > 0 ? '#f43f5e' : '#10b981'} icon={(metrics?.sales_variance ?? 0) > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />} delay={150} />
          <MetricCard label="Monthly Excess/Deficit" value={`${(metrics?.monthly_excess_deficit ?? 0) >= 0 ? '+' : ''}${formatCurrency(metrics?.monthly_excess_deficit ?? 0, true)}`} sub="month-to-date" accent={(metrics?.monthly_excess_deficit ?? 0) >= 0 ? '#10b981' : '#f43f5e'} delay={200} />
          <MetricCard label="Q Excess/Deficit" value={`${isAhead ? '+' : ''}${formatCurrency(metrics?.quarterly_excess_deficit ?? 0, true)}`} sub="quarter-to-date" accent={isAhead ? '#10b981' : '#f43f5e'} delay={250} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue vs Quota (Monthly)</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="quotaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                  <XAxis dataKey="month" tick={{ fill: '#4a4f6b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a4f6b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#8b90a8' }}
                    formatter={(val: number) => [formatCurrency(val), '']}
                  />
                  <Area type="monotone" dataKey="quota" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#quotaGrad)" name="Quota" />
                  <Area type="monotone" dataKey="actual" stroke="#4f6ef7" strokeWidth={2} fill="url(#actualGrad)" name="Actual" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Monthly Sales Forecast */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Monthly Sales Forecast</div>
              <div className="flex items-center gap-3 text-[10px] text-[#8b90a8]">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-[#10b981]" />Closed Won</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-[#3d5af1]" />Negotiation (80%)</span>
              </div>
            </div>
            <p className="text-[10px] text-[#8b90a8] mb-4">Full monthly subscription spread across contract duration</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyForecast} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="month" tick={{ fill: '#4a4f6b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a4f6b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#1a1d2e', fontWeight: 600 }}
                    formatter={(val: number, name: string) => {
                      const labels: Record<string, string> = { actual: 'Closed Won', negotiation: 'Negotiation (80%)' };
                      return [formatCurrency(val), labels[name] ?? name];
                    }}
                  />
                  <Bar dataKey="actual" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="actual" />
                  <Bar dataKey="negotiation" stackId="a" fill="#3d5af1" radius={[4, 4, 0, 0]} name="negotiation" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {monthlyForecast.every(m => m.actual === 0 && m.negotiation === 0) && (
              <p className="text-xs text-[#8b90a8] text-center py-4">No forecast data — add deals with start and due dates</p>
            )}
          </Card>

          {/* Pipeline stage breakdown */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="flex flex-col gap-2">
              {pipelineByStage.map(row => {
                const stageName = (row as any).stage_name ?? row.stage_id;
                const color = STAGE_COLORS[stageName] ?? '#4f6ef7';
                const count = (row._count as any)?.id ?? 0;
                const value = Number((row._sum as any)?.revenue ?? 0);
                if (count === 0) return null;
                return (
                  <div key={row.stage_id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-[#4a5068] truncate">{stageName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(value, true)}</span>
                      <span className="text-[10px] text-[#8b90a8] w-4 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
              {pipelineByStage.length === 0 && (
                <p className="text-xs text-[#8b90a8] text-center py-4">No open pipeline</p>
              )}
            </div>
          </Card>
        </div>

        {/* Stuck deals */}
        {stuckDeals.length > 0 && (
          <div className="mt-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-[#d97706]" />
                <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
                <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {stuckDeals.map((deal: any) => (
                  <div key={deal.id} className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#1a1d2e]">{deal.deal_name}</span>
                      <span className="text-xs text-[#d97706] font-bold">{deal.days_in_stage ?? deal.days_in_current_stage}d</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <StagePill stage={deal.stage?.name ?? deal.stage} size="sm" />
                      <span className="text-xs text-[#8b90a8]">{deal.client?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}