import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, Briefcase, AlertTriangle, ChevronDown } from 'lucide-react';
import Header from '../components/layout/Header';
import { MetricCard, Card, Badge, Button, ProgressBar, Avatar } from '../components/ui/index';
import DealCard from '../components/deals/DealCard';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { MOCK_DEALS, MOCK_BD_DASHBOARD, PIPELINE_STAGES } from '../mockData';
import { formatCurrency, formatDate, cn } from '../lib/utils';

const MONTHLY_PROGRESS = [
  { month: 'Oct', actual: 0, quota: 583333 },
  { month: 'Nov', actual: 1568162, quota: 583333 },
  { month: 'Dec', actual: 0, quota: 583333 },
  { month: 'Jan', actual: 0, quota: 583333 },
  { month: 'Feb', actual: 0, quota: 583333 },
  { month: 'Mar', actual: 0, quota: 583333 },
];

const QUARTERS = ['Q1 2026', 'Q2 2025', 'Q3 2025', 'Q4 2025'];

export default function BDDashboard() {
  const { user } = useAuthStore();
  const [selectedQ, setSelectedQ] = useState('Q1 2026');
  const dash = MOCK_BD_DASHBOARD;
  const myDeals = MOCK_DEALS.filter(d => d.bd_id === user?.id || user?.role === 'Manager');
  const stuckDeals = myDeals.filter(d => (d.days_in_stage || 0) > 3 && !d.is_closed);
  const openDeals = myDeals.filter(d => !d.is_closed);
  const closedWon = myDeals.filter(d => d.stage === 'Closed Won');

  const attainmentPct = Math.min(dash.total_target_status_pct, 100);
  const excessDeficit = dash.quarterly_excess_deficit;
  const isAhead = excessDeficit >= 0;

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${user?.first_name}'s Dashboard`}
        subtitle="Q1 2026 · Jan 1 – Mar 31"
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quarter selector */}
        <div className="flex items-center gap-2 mb-6">
          {QUARTERS.map(q => (
            <button
              key={q}
              onClick={() => setSelectedQ(q)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                q === selectedQ
                  ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                  : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
              )}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Quota attainment hero */}
        <Card className="p-6 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4f6ef708] to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-medium text-[#4a5068] uppercase tracking-wider mb-2 font-display">Quota Attainment · {selectedQ}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold font-display text-[#1a1d2e]">{dash.total_target_status_pct.toFixed(1)}%</span>
                <div>
                  <div className="text-sm text-[#4a5068]">{formatCurrency(dash.actual_closed_quarterly, true)} closed</div>
                  <div className="text-xs text-[#8b90a8]">of {formatCurrency(dash.quota_quarterly, true)} quota</div>
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
                    innerRadius="70%"
                    outerRadius="100%"
                    data={[{ value: attainmentPct, fill: '#4f6ef7' }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: '#ffffff0a' }} cornerRadius={4} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill="#1a1d2e" fontSize={20} fontFamily="Syne">
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
          <MetricCard
            label="Deals Closed"
            value={closedWon.length}
            sub="this quarter"
            accent="#10b981"
            icon={<Target size={16} />}
            delay={0}
          />
          <MetricCard
            label="Open Pipeline"
            value={openDeals.length}
            sub={`${stuckDeals.length} stuck`}
            accent={stuckDeals.length > 0 ? '#f59e0b' : '#4f6ef7'}
            icon={<Briefcase size={16} />}
            delay={50}
          />
          <MetricCard
            label="Sales Forecast"
            value={formatCurrency(dash.sales_forecast, true)}
            sub="closed + negotiation"
            accent="#8b5cf6"
            icon={<TrendingUp size={16} />}
            delay={100}
          />
          <MetricCard
            label="Sales Variance"
            value={formatCurrency(Math.abs(dash.sales_variance), true)}
            sub={dash.sales_variance < 0 ? 'below quota' : 'above quota'}
            accent={dash.sales_variance < 0 ? '#f43f5e' : '#10b981'}
            icon={dash.sales_variance < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            delay={150}
          />
          <MetricCard
            label="Monthly Excess/Deficit"
            value={`${excessDeficit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(dash.monthly_excess_deficit), true)}`}
            sub="month-to-date"
            accent={isAhead ? '#10b981' : '#f43f5e'}
            delay={200}
          />
          <MetricCard
            label="Q Excess/Deficit"
            value={`${excessDeficit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(excessDeficit), true)}`}
            sub="quarter-to-date"
            accent={isAhead ? '#10b981' : '#f43f5e'}
            delay={250}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue vs Quota (Monthly)</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MONTHLY_PROGRESS} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                  <YAxis tick={{ fill: '#4a4f6b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
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

          {/* Pipeline stage breakdown */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="flex flex-col gap-2">
              {PIPELINE_STAGES.filter(s => !['Closed Won', 'Closed Lost'].includes(s.name)).map(stage => {
                const stageDeals = openDeals.filter(d => d.stage === stage.name);
                const totalVal = stageDeals.reduce((sum, d) => sum + d.revenue, 0);
                if (stageDeals.length === 0) return null;
                return (
                  <div key={stage.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      <span className="text-xs text-[#4a5068] truncate">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(totalVal, true)}</span>
                      <span className="text-[10px] text-[#8b90a8] w-4 text-right">{stageDeals.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Stuck deals + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {stuckDeals.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-[#d97706]" />
                <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
                <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {stuckDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} compact />
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Open Deals</div>
            <div className="flex flex-col gap-2">
              {openDeals.slice(0, 5).map(deal => (
                <DealCard key={deal.id} deal={deal} compact />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
