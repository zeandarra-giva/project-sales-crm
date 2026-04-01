import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import {
  Target, TrendingUp, TrendingDown, Briefcase, AlertTriangle, Loader2,
  Users, Layers, PhoneCall, Calendar,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { MetricCard, Card, Badge, ProgressBar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { useBDDashboard } from '../hooks/useDashboard';
import { useReportingPeriods } from '../hooks/useReporting';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types';

const STAGE_COLORS: Record<string, string> = {
  'Inquiry': '#4a4f6b',
  'Prospecting': '#4f6ef7',
  'Discovery': '#10b981',
  'Proposal Sent': '#8b5cf6',
  'Negotiation': '#f59e0b',
};

const PIE_COLORS = ['#3d5af1', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#6366f1', '#ec4899'];

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

const TT = {
  contentStyle: { background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' },
  itemStyle: { color: '#4a5068' },
  labelStyle: { color: '#1a1d2e', fontWeight: 600 },
};

export interface AnalyticsBDData {
  total_revenue: number;
  quota: number;
  monthly_quota: number;
  open_pipeline: number;
  attainment_pct: number;
  sales_forecast: number;
  variance: number;
  monthly_variance: number;
  excess_deficit: string;
  monthly_excess_deficit: string;
  revenue_by_month: { month: number; month_name: string; revenue: number; quota: number }[];
  pipeline_by_stage: { stage_name: string; deal_count: number; total_value: number }[];
  open_deals: { deal_id: string; deal_name: string; stage_name: string; revenue: number; days_in_stage: number; client_name?: string; account_type?: string }[];
  service_revenue: { service_name: string; revenue: number; deal_count: number }[];
  account_type_pipeline: { account_type: string; deal_count: number; total_value: number }[];
  lead_source: { lead_source: string; total_deals: number; won_deals: number; won_revenue: number }[];
  follow_up: { total_open: number; overdue_action_plans: number; overdue_follow_ups: number; upcoming_action_plans: number };
}

export default function BDDashboard() {
  const { user } = useAuthStore();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [selectedQ, setSelectedQ] = useState<number | 'ALL'>(currentQuarter);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: reportingPeriods } = useReportingPeriods();
  const availableYears = reportingPeriods?.years ?? [currentYear];

  const { data, isLoading: loading, error: queryError } = useBDDashboard(selectedQ, selectedYear, user?.id);
  const error = queryError ? (queryError as any).response?.data?.detail || (queryError as any).response?.data?.error || (queryError as Error).message || 'Failed to load dashboard' : null;

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title={`${user?.firstName}'s Dashboard`} subtitle={`Q${currentQuarter} ${currentYear}`} action={{ label: 'New Deal', to: '/deals/new' }} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[#8b90a8]">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full">
        <Header title={`${user?.firstName}'s Dashboard`} subtitle={`Q${currentQuarter} ${currentYear}`} action={{ label: 'New Deal', to: '/deals/new' }} />
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <AlertTriangle size={24} className="text-[#d97706] mx-auto mb-3" />
            <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Failed to load dashboard</div>
            <div className="text-xs text-[#8b90a8]">{error || 'No data available'}</div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-xs font-medium bg-[#3d5af1] text-white rounded-lg hover:bg-[#2d4ad1] transition-colors"
            >
              Retry
            </button>
          </Card>
        </div>
      </div>
    );
  }

  const attainmentPct = Math.min(data.attainment_pct || 0, 100);
  const variance = data.variance || 0;
  const isAhead = variance >= 0;
  const openStages = (data.pipeline_by_stage || []).filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage_name));
  const totalServiceRevenue = (data.service_revenue || []).reduce((sum, s) => sum + s.revenue, 0);
  const revenueVsQuotaData = (data.revenue_by_month || []).map((entry) => ({
    ...entry,
    deficit: Math.max((entry.quota || 0) - (entry.revenue || 0), 0),
    excess: Math.max((entry.revenue || 0) - (entry.quota || 0), 0),
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${user?.firstName}'s Dashboard`}
        subtitle={`${getQuarterLabel(selectedQ)} ${selectedYear} · ${getQuarterRange(selectedQ, selectedYear)}`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quarter selector */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e2e6f0] bg-white text-[#1a1d2e]"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {(['ALL', 1, 2, 3, 4] as const).map((quarter) => (
            <button
              key={quarter}
              onClick={() => setSelectedQ(quarter)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                quarter === selectedQ
                  ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                  : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
              )}
            >
              {quarter === 'ALL' ? 'All' : `Q${quarter}`}
            </button>
          ))}
        </div>

        {/* Quota Attainment Hero — Revenue as main text, quota as sub-label */}
        <Card className="p-6 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4f6ef708] to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-medium text-[#4a5068] uppercase tracking-wider mb-2 font-display">Quota Attainment · {getQuarterLabel(selectedQ)} {selectedYear}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold font-display text-[#1a1d2e]">{formatCurrency(data.total_revenue || 0, true)}</span>
                <div>
                  <div className="text-sm text-[#4a5068]">of {formatCurrency(data.quota || 0, true)} quota</div>
                  <div className="text-xs text-[#8b90a8]">{(data.attainment_pct || 0).toFixed(1)}% attainment</div>
                </div>
              </div>
              <ProgressBar
                value={attainmentPct}
                className="mt-4 h-2 w-72"
                color={attainmentPct >= 100 ? '#10b981' : attainmentPct >= 50 ? '#f59e0b' : '#4f6ef7'}
              />
              <div className="flex items-center gap-2 mt-2">
                {isAhead ? <TrendingUp size={12} className="text-[#10b981]" /> : <TrendingDown size={12} className="text-[#f43f5e]" />}
                <span className={cn('text-xs font-medium', isAhead ? 'text-[#10b981]' : 'text-[#f43f5e]')}>
                  {formatCurrency(Math.abs(variance), true)} {data.excess_deficit || (isAhead ? 'Excess' : 'Deficit')}
                </span>
              </div>
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
                    <RadialBar dataKey="value" background={{ fill: '#f0f2f8' }} cornerRadius={4} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#1a1d2e" fontSize={20} fontFamily="Syne" fontWeight="bold">
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
            label="Open Pipeline"
            value={formatCurrency(data.open_pipeline || 0, true)}
            sub={`${(data.pipeline_by_stage || []).reduce((sum, s) => sum + s.deal_count, 0)} deals`}
            accent="#4f6ef7"
            icon={<Briefcase size={16} />}
            delay={0}
          />
          <MetricCard
            label="Sales Forecast"
            value={formatCurrency(data.sales_forecast || 0, true)}
            sub="closed + negotiation"
            accent="#8b5cf6"
            icon={<TrendingUp size={16} />}
            delay={50}
          />
          <MetricCard
            label={selectedQ === 'ALL' ? 'Annual Variance' : 'Monthly Variance'}
            value={`${((selectedQ === 'ALL' ? data.variance : data.monthly_variance) || 0) >= 0 ? '+' : ''}${formatCurrency(selectedQ === 'ALL' ? data.variance || 0 : data.monthly_variance || 0, true)}`}
            sub={selectedQ === 'ALL' ? (data.excess_deficit || 'YTD') : (data.monthly_excess_deficit || 'MTD')}
            accent={(selectedQ === 'ALL' ? data.variance || 0 : data.monthly_variance || 0) >= 0 ? '#10b981' : '#f43f5e'}
            icon={(selectedQ === 'ALL' ? data.variance || 0 : data.monthly_variance || 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            delay={100}
          />
          {/* Lead Source card */}
          <MetricCard
            label="Lead Sources"
            value={String((data.lead_source || []).length)}
            sub={`${(data.lead_source || []).reduce((sum, s) => sum + s.total_deals, 0)} total deals`}
            accent="#059669"
            icon={<Layers size={16} />}
            delay={150}
          />
          {/* Follow-up card */}
          <MetricCard
            label="Follow-ups"
            value={String((data.follow_up?.overdue_action_plans || 0) + (data.follow_up?.overdue_follow_ups || 0))}
            sub={`overdue · ${data.follow_up?.upcoming_action_plans || 0} upcoming`}
            accent={(data.follow_up?.overdue_action_plans || 0) + (data.follow_up?.overdue_follow_ups || 0) > 0 ? '#f43f5e' : '#10b981'}
            icon={<PhoneCall size={16} />}
            delay={200}
          />
          {/* Account Type count */}
          <MetricCard
            label="Account Types"
            value={String((data.account_type_pipeline || []).length)}
            sub={`${(data.account_type_pipeline || []).reduce((sum, a) => sum + a.deal_count, 0)} open deals`}
            accent="#d97706"
            icon={<Users size={16} />}
            delay={250}
          />
        </div>

        {/* Revenue vs Quota BAR GRAPH + Service Revenue Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Revenue vs Quota bar chart */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">{selectedQ === 'ALL' ? 'Revenue vs Quota (Year)' : 'Revenue vs Quota (Monthly)'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8]">Revenue</div>
                <div className="mt-1 text-sm font-semibold text-[#0F172A]">{formatCurrency(data.total_revenue || 0, true)}</div>
              </div>
              <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8]">Quota</div>
                <div className="mt-1 text-sm font-semibold text-[#0F172A]">{formatCurrency(data.quota || 0, true)}</div>
              </div>
              <div className={cn(
                'rounded-[8px] border px-3 py-2',
                (data.variance || 0) >= 0
                  ? 'border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.06)]'
                  : 'border-[rgba(244,63,94,0.18)] bg-[rgba(244,63,94,0.06)]'
              )}>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8]">
                  {(data.variance || 0) >= 0 ? 'Excess' : 'Deficit'}
                </div>
                <div className={cn(
                  'mt-1 text-sm font-semibold',
                  (data.variance || 0) >= 0 ? 'text-[#059669]' : 'text-[#E11D48]'
                )}>
                  {formatCurrency(Math.abs(data.variance || 0), true)}
                </div>
              </div>
            </div>
            <div className="h-64">
              {revenueVsQuotaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueVsQuotaData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="month_name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), '']} />
                    <Bar dataKey="quota" name="Quota" fill="#e6eaf5" stroke="#c8cfe8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="deficit" name="Deficit" fill="#fee2e2" stroke="#f43f5e" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No monthly data available</div>
              )}
            </div>
          </Card>

          {/* Service Revenue Pie Chart */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Service Revenue (Closed Won)</div>
            <div className="h-64">
              {(data.service_revenue || []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.service_revenue}
                      dataKey="revenue"
                      nameKey="service_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={renderPieLabel}
                      labelLine={false}
                    >
                      {(data.service_revenue || []).map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TT} formatter={(val: number, name: string) => [formatCurrency(val), name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No closed revenue data</div>
              )}
            </div>
            {/* Service leaderboard */}
            {(data.service_revenue || []).length > 0 && (
              <div className="flex flex-col gap-1.5 mt-3 border-t border-[#f0f2f8] pt-3">
                {data.service_revenue.map((s, i) => (
                  <div key={s.service_name} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-[#4a5068]">{s.service_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(s.revenue, true)}</span>
                      <span className="text-[10px] text-[#8b90a8]">
                        {totalServiceRevenue > 0 ? ((s.revenue / totalServiceRevenue) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Account Type Pipeline + Lead Source */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Account Type on Open Pipeline */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Open Pipeline by Account Type</div>
            <div className="flex flex-col gap-2">
              {(data.account_type_pipeline || []).length > 0 ? data.account_type_pipeline.map((at, i) => (
                <div key={at.account_type} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-[#4a5068]">{at.account_type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(at.total_value, true)}</span>
                    <Badge variant="neutral" size="sm">{at.deal_count} deals</Badge>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No open pipeline data</div>
              )}
            </div>
          </Card>

          {/* Lead Source */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Lead Source Performance</div>
            <div className="flex flex-col gap-2">
              {(data.lead_source || []).length > 0 ? data.lead_source.map((ls, i) => (
                <div key={ls.lead_source} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-[#4a5068]">{ls.lead_source}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#8b90a8]">{ls.total_deals} deals</span>
                    <span className="text-xs font-semibold text-[#10b981]">{ls.won_deals} won</span>
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(ls.won_revenue, true)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No lead source data</div>
              )}
            </div>
          </Card>
        </div>

        {/* Follow-up Detail Card */}
        {data.follow_up && (
          <Card className="p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-[#3d5af1]" />
              <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Follow-up Status</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-[#f4f6fb] rounded-xl text-center">
                <div className="text-lg font-bold font-display text-[#1a1d2e]">{data.follow_up.total_open}</div>
                <div className="text-[10px] text-[#8b90a8]">Total Open</div>
              </div>
              <div className={cn('p-3 rounded-xl text-center', data.follow_up.overdue_action_plans > 0 ? 'bg-[#fef2f2]' : 'bg-[#f4f6fb]')}>
                <div className={cn('text-lg font-bold font-display', data.follow_up.overdue_action_plans > 0 ? 'text-[#e11d48]' : 'text-[#1a1d2e]')}>
                  {data.follow_up.overdue_action_plans}
                </div>
                <div className="text-[10px] text-[#8b90a8]">Overdue Actions</div>
              </div>
              <div className={cn('p-3 rounded-xl text-center', data.follow_up.overdue_follow_ups > 0 ? 'bg-[#fef2f2]' : 'bg-[#f4f6fb]')}>
                <div className={cn('text-lg font-bold font-display', data.follow_up.overdue_follow_ups > 0 ? 'text-[#e11d48]' : 'text-[#1a1d2e]')}>
                  {data.follow_up.overdue_follow_ups}
                </div>
                <div className="text-[10px] text-[#8b90a8]">Overdue Follow-ups</div>
              </div>
              <div className="p-3 bg-[#f0fdf4] rounded-xl text-center">
                <div className="text-lg font-bold font-display text-[#059669]">{data.follow_up.upcoming_action_plans}</div>
                <div className="text-[10px] text-[#8b90a8]">Upcoming Actions</div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Open deals list */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Open Deals</div>
            <div className="flex flex-col gap-2">
              {(data.open_deals || []).length > 0 ? data.open_deals.map(deal => (
                <div key={deal.deal_id} className="flex items-center justify-between gap-3 p-3 bg-[#f4f6fb] rounded-xl border border-[#e2e6f0]">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#1a1d2e] truncate">{deal.deal_name}</div>
                    <div className="text-[10px] text-[#8b90a8]">
                      {deal.client_name || 'Unknown'}{deal.account_type ? ` · ${deal.account_type}` : ''}
                      {deal.days_in_stage > 0 && <span className="ml-2 text-[#d97706]">· {deal.days_in_stage}d in stage</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StagePill stage={deal.stage_name as PipelineStage} size="sm" />
                    <span className="text-xs font-bold text-[#1a1d2e]">{formatCurrency(deal.revenue, true)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-xs text-[#8b90a8]">No open deals</div>
              )}
            </div>
          </Card>

          {/* Pipeline stage breakdown */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="flex flex-col gap-2">
              {openStages.length > 0 ? openStages.map(stage => (
                <div key={stage.stage_name} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage.stage_name] || '#6b7280' }} />
                    <span className="text-xs text-[#4a5068] truncate">{stage.stage_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(stage.total_value, true)}</span>
                    <span className="text-[10px] text-[#8b90a8] w-4 text-right">{stage.deal_count}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No open pipeline</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getQuarterLabel(quarter: number | 'ALL'): string {
  return quarter === 'ALL' ? 'All Quarters' : `Q${quarter}`;
}

function getQuarterRange(quarter: number | 'ALL', year: number): string {
  if (quarter === 'ALL') return 'Jan 1 – Dec 31';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  return `${months[startMonth]} 1 – ${months[endMonth]} ${new Date(year, endMonth + 1, 0).getDate()}`;
}
