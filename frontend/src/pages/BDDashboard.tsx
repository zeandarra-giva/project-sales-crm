import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar, PolarAngleAxis,
  ReferenceLine,
} from 'recharts';
import {
  Target, TrendingUp, TrendingDown, Briefcase, AlertTriangle,
  Phone, Mail, Users, Zap, CheckCircle, Clock, ArrowUpRight,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { MetricCard, Card, Badge, Button, ProgressBar } from '../components/ui/index';
import DealCard from '../components/deals/DealCard';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { analyticsDashboardApi } from '../api/analyticsDashboard';
import { MOCK_DEALS, PIPELINE_STAGES } from '../mockData';
import { formatCurrency, cn } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentQuarter(): { year: number; quarter: number; label: string } {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return { year: now.getFullYear(), quarter: q, label: `Q${q} ${now.getFullYear()}` };
}

const QUARTER_OPTIONS = (() => {
  const { year, quarter } = getCurrentQuarter();
  const opts = [];
  for (let i = 0; i < 4; i++) {
    let q = quarter - i;
    let y = year;
    if (q <= 0) { q += 4; y -= 1; }
    opts.push({ label: `Q${q} ${y}`, year: y, quarter: q });
  }
  return opts;
})();

// Pie chart colours mapped to service names
const SERVICE_COLORS: Record<string, string> = {
  MEDIAWATCH: '#4f6ef7',
  LOCOBUZZ: '#8b5cf6',
  SHAREDVIEW: '#10b981',
  REPORTS: '#f59e0b',
};
const FALLBACK_COLORS = ['#4f6ef7', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  Enterprise: '#4f6ef7',
  Corporate: '#8b5cf6',
  SMB: '#10b981',
  Government: '#f59e0b',
};

const LEAD_SOURCE_COLORS: Record<string, string> = {
  Inbound: '#10b981',
  Outbound: '#4f6ef7',
  Referral: '#f59e0b',
};

// ── Custom tooltip for bar chart ──────────────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e2e6f0] rounded-xl shadow-lg px-4 py-3 text-xs">
      <div className="font-semibold text-[#1a1d2e] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.stroke }} />
          <span className="text-[#4a5068]">{p.name}:</span>
          <span className="font-medium text-[#1a1d2e]">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Custom pie label ──────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BDDashboard() {
  const { user } = useAuthStore();
  const [selectedQ, setSelectedQ] = useState(QUARTER_OPTIONS[0]);

  // ── Fetch from analytics service ────────────────────────────────────────────
  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ['bd-dashboard', user?.id, selectedQ.year, selectedQ.quarter],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');
      const res = await analyticsDashboardApi.bd({
        year: selectedQ.year,
        quarter: selectedQ.quarter,
        bd_id: user.id,
      });
      return res.data;
    },
    enabled: !!user?.id,
    staleTime: 60_000, // treat data as fresh for 1 min — dashboards update on deal save
  });

  // ── Fallback to mock data while analytics service isn't connected ────────────
  const myDeals = MOCK_DEALS.filter(d => d.bd_id === user?.id);
  const stuckDeals = myDeals.filter(d => (d.days_in_stage || 0) > 3 && !d.is_closed);
  const openDeals = myDeals.filter(d => !d.is_closed);

  // ── Derived values from analytics response ──────────────────────────────────
  const totalRevenue = analytics?.total_revenue ?? 0;
  const quota = analytics?.quota ?? 7_000_000;
  const monthlyQuota = analytics?.monthly_quota ?? 583_333;
  const attainmentPct = analytics?.attainment_pct ?? 0;
  const salesForecast = analytics?.sales_forecast ?? 0;
  const variance = analytics?.variance ?? -quota;
  const monthlyVariance = analytics?.monthly_variance ?? -monthlyQuota;
  const excessDeficit = analytics?.excess_deficit ?? 'Deficit';
  const monthlyExcessDeficit = analytics?.monthly_excess_deficit ?? 'Deficit';
  const openPipeline = analytics?.open_pipeline ?? 0;

  const revenueByMonth = analytics?.revenue_by_month ?? [];
  const pipelineByStage = analytics?.pipeline_by_stage ?? [];
  const openDealsList = analytics?.open_deals ?? [];
  const serviceRevenue = analytics?.service_revenue ?? [];
  const accountTypePipeline = analytics?.account_type_pipeline ?? [];
  const leadSource = analytics?.lead_source ?? [];
  const followUp = analytics?.follow_up ?? {
    total_open: 0, overdue_action_plans: 0, overdue_follow_ups: 0, upcoming_action_plans: 0,
  };

  const gaugeValue = Math.min(attainmentPct, 100);

  // Total pipeline deals count from analytics or fallback
  const totalOpenCount = pipelineByStage
    .filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage_name))
    .reduce((sum, s) => sum + s.deal_count, 0) || openDeals.length;

  const stuckCount = openDealsList.filter(d => d.days_in_stage > 3).length || stuckDeals.length;

  // Compute total service revenue for percentage labels
  const totalServiceRevenue = serviceRevenue.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${user?.firstName}'s Dashboard`}
        subtitle={`${selectedQ.label} · Real-time performance`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Quarter selector ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          {QUARTER_OPTIONS.map(q => (
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
          {isLoading && (
            <span className="ml-2 text-xs text-[#8b90a8] flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-[#4f6ef7] border-t-transparent rounded-full animate-spin" />
              Loading…
            </span>
          )}
          {isError && (
            <span className="ml-2 text-xs text-[#f43f5e] flex items-center gap-1">
              <AlertTriangle size={12} /> Analytics offline — showing mock data
            </span>
          )}
        </div>

        {/* ── Quota Attainment Hero ────────────────────────────────────── */}
        {/* Main value is now REVENUE CLOSED, quota is a sub-label       */}
        <Card className="p-6 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4f6ef708] to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#4a5068] uppercase tracking-wider mb-2 font-display">
                Quota Attainment · {selectedQ.label}
              </div>
              {/* PRIMARY: revenue amount closed */}
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-4xl font-bold font-display text-[#1a1d2e]">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
              {/* SUB-LABELS: quota + attainment % */}
              <div className="flex items-center gap-3 text-sm text-[#4a5068] mb-3">
                <span>of <span className="font-semibold">{formatCurrency(quota)}</span> quota</span>
                <span className={cn(
                  'inline-flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded-full',
                  attainmentPct >= 100
                    ? 'bg-[#ecfdf5] text-[#059669]'
                    : attainmentPct >= 50
                      ? 'bg-[#fffbeb] text-[#d97706]'
                      : 'bg-[#eef1fe] text-[#3d5af1]'
                )}>
                  {attainmentPct.toFixed(1)}% attained
                </span>
              </div>
              <ProgressBar
                value={gaugeValue}
                className="h-2 w-72 max-w-full"
                color={attainmentPct >= 100 ? '#10b981' : attainmentPct >= 50 ? '#f59e0b' : '#4f6ef7'}
              />
              {/* Variance line */}
              <div className={cn(
                'mt-3 text-xs font-medium flex items-center gap-1',
                variance >= 0 ? 'text-[#059669]' : 'text-[#e11d48]'
              )}>
                {variance >= 0 ? <ArrowUpRight size={13} /> : <TrendingDown size={13} />}
                {variance >= 0
                  ? `${formatCurrency(variance)} ahead of quota`
                  : `${formatCurrency(Math.abs(variance))} behind quota`}
              </div>
            </div>

            {/* Radial gauge */}
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="70%" outerRadius="100%"
                  data={[{ value: gaugeValue, fill: '#4f6ef7' }]}
                  startAngle={90} endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" background={{ fill: '#f0f2f8' }} cornerRadius={4} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                    fill="#1a1d2e" fontSize={20} fontFamily="Syne" fontWeight={700}>
                    {gaugeValue.toFixed(0)}%
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* ── Key Metric Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <MetricCard
            label="Open Pipeline"
            value={totalOpenCount.toString()}
            sub={stuckCount > 0 ? `${stuckCount} stuck` : 'all healthy'}
            accent={stuckCount > 0 ? '#f59e0b' : '#4f6ef7'}
            icon={<Briefcase size={16} />}
            delay={0}
          />
          <MetricCard
            label="Sales Forecast"
            value={formatCurrency(salesForecast, true)}
            sub="won + negotiation"
            accent="#8b5cf6"
            icon={<TrendingUp size={16} />}
            delay={50}
          />
          <MetricCard
            label="Quarterly Variance"
            value={`${variance >= 0 ? '+' : ''}${formatCurrency(Math.abs(variance), true)}`}
            sub={excessDeficit === 'Excess' ? 'above quota' : 'below quota'}
            accent={excessDeficit === 'Excess' ? '#10b981' : '#f43f5e'}
            icon={excessDeficit === 'Excess' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            delay={100}
          />
          <MetricCard
            label="Monthly Variance"
            value={`${monthlyVariance >= 0 ? '+' : ''}${formatCurrency(Math.abs(monthlyVariance), true)}`}
            sub={monthlyExcessDeficit === 'Excess' ? 'month-to-date' : 'month-to-date'}
            accent={monthlyExcessDeficit === 'Excess' ? '#10b981' : '#f43f5e'}
            delay={150}
          />
          {/* Lead Source summary card */}
          <MetricCard
            label="Top Lead Source"
            value={leadSource[0]?.lead_source ?? '—'}
            sub={leadSource[0]
              ? `${leadSource[0].won_deals} won · ${formatCurrency(leadSource[0].won_revenue, true)}`
              : 'no data yet'}
            accent="#06b6d4"
            icon={<Phone size={16} />}
            delay={200}
          />
          {/* Follow-up summary card */}
          <MetricCard
            label="Follow-Up Alerts"
            value={`${followUp.overdue_action_plans + followUp.overdue_follow_ups}`}
            sub={followUp.upcoming_action_plans > 0
              ? `${followUp.upcoming_action_plans} due soon`
              : 'nothing upcoming'}
            accent={
              followUp.overdue_action_plans + followUp.overdue_follow_ups > 0
                ? '#f43f5e'
                : '#10b981'
            }
            icon={<Clock size={16} />}
            delay={250}
          />
        </div>

        {/* ── Revenue vs Quota Bar Chart + Pipeline by Stage ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Revenue vs Quota (Monthly)
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueByMonth}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  barCategoryGap="35%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                  <XAxis
                    dataKey="month_name"
                    tick={{ fill: '#4a4f6b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4a4f6b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `₱${(v / 1_000_000).toFixed(1)}M`}
                    width={52}
                  />
                  <Tooltip content={<BarTooltip />} />
                  {/* Quota reference line using first row's quota value */}
                  {revenueByMonth[0]?.quota ? (
                    <ReferenceLine
                      y={revenueByMonth[0].quota}
                      stroke="#f59e0b"
                      strokeDasharray="5 3"
                      strokeWidth={1.5}
                      label={{
                        value: 'Monthly Quota',
                        position: 'insideTopRight',
                        fill: '#d97706',
                        fontSize: 10,
                      }}
                    />
                  ) : null}
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#4f6ef7"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Pipeline by Stage */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Pipeline by Stage
            </div>
            <div className="flex flex-col gap-2">
              {(pipelineByStage.length > 0 ? pipelineByStage : PIPELINE_STAGES.map(s => ({
                stage_name: s.name,
                deal_count: openDeals.filter(d => d.stage === s.name).length,
                total_value: openDeals.filter(d => d.stage === s.name).reduce((sum, d) => sum + d.revenue, 0),
              }))).filter(s =>
                !['Closed Won', 'Closed Lost'].includes(s.stage_name) && s.deal_count > 0
              ).map(stage => {
                const stageColor = PIPELINE_STAGES.find(p => p.name === stage.stage_name)?.color ?? '#4f6ef7';
                return (
                  <div key={stage.stage_name} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stageColor }} />
                      <span className="text-xs text-[#4a5068] truncate">{stage.stage_name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-[#1a1d2e]">
                        {formatCurrency(stage.total_value, true)}
                      </span>
                      <span className="text-[10px] text-[#8b90a8] w-4 text-right">{stage.deal_count}</span>
                    </div>
                  </div>
                );
              })}
              {pipelineByStage.filter(s =>
                !['Closed Won', 'Closed Lost'].includes(s.stage_name) && s.deal_count > 0
              ).length === 0 && (
                  <p className="text-xs text-[#8b90a8] py-2">No open deals in pipeline.</p>
                )}
            </div>
          </Card>
        </div>

        {/* ── Service Revenue Pie + Account Type on Pipeline ───────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Service Revenue Breakdown — Pie Chart */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Revenue by Service (Closed Won)
            </div>
            {serviceRevenue.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceRevenue}
                      dataKey="revenue"
                      nameKey="service_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={3}
                      labelLine={false}
                      label={<PieLabel />}
                    >
                      {serviceRevenue.map((entry, index) => (
                        <Cell
                          key={entry.service_name}
                          fill={SERVICE_COLORS[entry.service_name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number, name: string) => [
                        `${formatCurrency(val)} (${totalServiceRevenue > 0 ? ((val / totalServiceRevenue) * 100).toFixed(1) : 0}%)`,
                        name,
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ color: '#4a5068', fontSize: 11 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center gap-2">
                <Target size={28} className="text-[#e2e6f0]" />
                <p className="text-xs text-[#8b90a8]">No closed deals this quarter yet.</p>
              </div>
            )}

            {/* Service rows with account type sub-breakdown */}
            {serviceRevenue.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-t border-[#f0f2f8] pt-3">
                {serviceRevenue.map((svc, i) => (
                  <div key={svc.service_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: SERVICE_COLORS[svc.service_name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                      />
                      <span className="text-xs text-[#1a1d2e] font-medium">{svc.service_name}</span>
                      <Badge variant="neutral" size="sm">{svc.deal_count} deal{svc.deal_count !== 1 ? 's' : ''}</Badge>
                    </div>
                    <span className="text-xs font-semibold text-[#1a1d2e]">
                      {formatCurrency(svc.revenue, true)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Account Type Breakdown on Open Pipeline */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Open Pipeline by Account Type
            </div>
            {accountTypePipeline.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={accountTypePipeline}
                      layout="vertical"
                      margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#4a4f6b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `${v}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="account_type"
                        tick={{ fill: '#4a5068', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                        formatter={(val: number) => [`${val} deal${val !== 1 ? 's' : ''}`, 'Count']}
                      />
                      <Bar dataKey="deal_count" name="Deals" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {accountTypePipeline.map((entry) => (
                          <Cell
                            key={entry.account_type}
                            fill={ACCOUNT_TYPE_COLORS[entry.account_type] ?? '#4f6ef7'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Summary rows */}
                <div className="mt-2 flex flex-col gap-1.5 border-t border-[#f0f2f8] pt-3">
                  {accountTypePipeline.map((row) => (
                    <div key={row.account_type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: ACCOUNT_TYPE_COLORS[row.account_type] ?? '#4f6ef7' }}
                        />
                        <span className="text-[#4a5068]">{row.account_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#8b90a8]">{row.deal_count} deal{row.deal_count !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-[#1a1d2e]">{formatCurrency(row.total_value, true)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center gap-2">
                <Users size={28} className="text-[#e2e6f0]" />
                <p className="text-xs text-[#8b90a8]">No open deals yet.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Lead Source Card + Follow-Up Detail ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Lead Source Breakdown */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Lead Source Performance
            </div>
            {leadSource.length > 0 ? (
              <div className="flex flex-col gap-3">
                {leadSource.map((src) => {
                  const winRate = src.total_deals > 0
                    ? Math.round((src.won_deals / src.total_deals) * 100)
                    : 0;
                  const color = LEAD_SOURCE_COLORS[src.lead_source] ?? '#4f6ef7';
                  return (
                    <div key={src.lead_source}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-sm font-medium text-[#1a1d2e]">{src.lead_source}</span>
                          <Badge variant="neutral" size="sm">{src.total_deals} deals</Badge>
                        </div>
                        <span className="text-xs font-semibold text-[#1a1d2e]">
                          {formatCurrency(src.won_revenue, true)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#f0f2f8] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${winRate}%`, background: color }}
                          />
                        </div>
                        <span className="text-[10px] text-[#8b90a8] w-14 text-right flex-shrink-0">
                          {src.won_deals} won ({winRate}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <Phone size={24} className="text-[#e2e6f0]" />
                <p className="text-xs text-[#8b90a8]">No deals recorded yet.</p>
              </div>
            )}
          </Card>

          {/* Follow-Up Detail */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Follow-Up Status
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={cn(
                'rounded-xl p-4 border',
                followUp.overdue_action_plans > 0
                  ? 'bg-[#fff1f2] border-[#fecdd3]'
                  : 'bg-[#f0f2f8] border-[#e2e6f0]'
              )}>
                <div className={cn(
                  'text-2xl font-bold font-display mb-0.5',
                  followUp.overdue_action_plans > 0 ? 'text-[#e11d48]' : 'text-[#4a5068]'
                )}>
                  {followUp.overdue_action_plans}
                </div>
                <div className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Overdue Action Plans
                </div>
              </div>
              <div className={cn(
                'rounded-xl p-4 border',
                followUp.overdue_follow_ups > 0
                  ? 'bg-[#fffbeb] border-[#fde68a]'
                  : 'bg-[#f0f2f8] border-[#e2e6f0]'
              )}>
                <div className={cn(
                  'text-2xl font-bold font-display mb-0.5',
                  followUp.overdue_follow_ups > 0 ? 'text-[#d97706]' : 'text-[#4a5068]'
                )}>
                  {followUp.overdue_follow_ups}
                </div>
                <div className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Follow-ups Overdue
                </div>
              </div>
              <div className="rounded-xl p-4 border bg-[#eef1fe] border-[#c7d0fb]">
                <div className="text-2xl font-bold font-display text-[#3d5af1] mb-0.5">
                  {followUp.upcoming_action_plans}
                </div>
                <div className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Due in 3 Days
                </div>
              </div>
              <div className="rounded-xl p-4 border bg-[#f0f2f8] border-[#e2e6f0]">
                <div className="text-2xl font-bold font-display text-[#4a5068] mb-0.5">
                  {followUp.total_open}
                </div>
                <div className="text-[10px] text-[#6b7280] uppercase tracking-wider font-medium">
                  Total Open Deals
                </div>
              </div>
            </div>
            {followUp.overdue_action_plans + followUp.overdue_follow_ups === 0 ? (
              <div className="flex items-center gap-2 text-xs text-[#059669] bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg px-3 py-2">
                <CheckCircle size={13} />
                All caught up — no overdue items!
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#d97706] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2">
                <AlertTriangle size={13} />
                {followUp.overdue_action_plans + followUp.overdue_follow_ups} item{
                  followUp.overdue_action_plans + followUp.overdue_follow_ups !== 1 ? 's' : ''
                } need your attention
              </div>
            )}
          </Card>
        </div>

        {/* ── Stuck Deals + Open Deals ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stuckCount > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-[#d97706]" />
                <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">
                  Stuck Deals
                </span>
                <Badge variant="warning" size="sm">{stuckCount}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {(openDealsList.length > 0
                  ? openDealsList.filter(d => d.days_in_stage > 3)
                  : stuckDeals
                ).map(deal => (
                  'deal_id' in deal
                    ? (
                      <div key={deal.deal_id} className="flex items-center justify-between py-2 border-b border-[#f0f2f8] last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1d2e] truncate">{deal.deal_name}</p>
                          <p className="text-xs text-[#8b90a8]">{deal.stage_name} · {deal.days_in_stage}d</p>
                        </div>
                        <span className="text-xs font-semibold text-[#1a1d2e] flex-shrink-0">
                          {formatCurrency(deal.revenue, true)}
                        </span>
                      </div>
                    )
                    : <DealCard key={deal.id} deal={deal} compact />
                ))}
              </div>
            </Card>
          )}

          <Card className={cn('p-5', stuckCount === 0 && 'lg:col-span-2')}>
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
              Open Deals
            </div>
            <div className="flex flex-col gap-2">
              {(openDealsList.length > 0
                ? openDealsList.slice(0, 6)
                : openDeals.slice(0, 6)
              ).map(deal =>
                'deal_id' in deal ? (
                  <div key={deal.deal_id} className="flex items-center justify-between py-2 border-b border-[#f0f2f8] last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1d2e] truncate">{deal.deal_name}</p>
                      <p className="text-xs text-[#8b90a8]">{deal.stage_name} · {deal.days_in_stage}d in stage</p>
                    </div>
                    <span className="text-xs font-semibold text-[#1a1d2e] flex-shrink-0">
                      {formatCurrency(deal.revenue, true)}
                    </span>
                  </div>
                ) : (
                  <DealCard key={deal.id} deal={deal} compact />
                )
              )}
              {openDealsList.length === 0 && openDeals.length === 0 && (
                <p className="text-xs text-[#8b90a8]">No open deals.</p>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}