import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, Briefcase, AlertTriangle, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { MetricCard, Card, Badge, ProgressBar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { dashboardApi } from '../api/dashboard';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types';

const STAGE_COLORS: Record<string, string> = {
  'Inquiry': '#4a4f6b',
  'Prospecting': '#4f6ef7',
  'Discovery': '#10b981',
  'Proposal Sent': '#8b5cf6',
  'Negotiation': '#f59e0b',
};

interface BDData {
  quarter: number;
  year: number;
  bdId: string;
  metrics: {
    dealsClosed: number;
    closedRevenue: number;
    openPipeline: { count: number; value: number };
    quotaAttainment: number;
    salesForecast: number;
    salesVariance: number;
    monthlyExcessDeficit: number;
    quarterlyExcessDeficit: number;
    pipelineByStage: { stage: string; count: number; value: number }[];
    openDeals: {
      id: string;
      dealName: string;
      revenue: number;
      startDate: string | null;
      stage: string;
      client: { id: string; name: string; accountType: string };
    }[];
  };
}

export default function BDDashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<BDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [selectedQ, setSelectedQ] = useState(currentQuarter);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const quarters = [
    { label: `Q1 ${currentYear}`, q: 1, y: currentYear },
    { label: `Q4 ${currentYear - 1}`, q: 4, y: currentYear - 1 },
    { label: `Q3 ${currentYear - 1}`, q: 3, y: currentYear - 1 },
    { label: `Q2 ${currentYear - 1}`, q: 2, y: currentYear - 1 },
  ];

  useEffect(() => {
    setLoading(true);
    setError(null);
    dashboardApi
      .bd({ year: selectedYear, quarter: selectedQ, bdId: user?.id })
      .then((res) => {
        setData(res.data as BDData);
      })
      .catch((err) => {
        console.error('BD dashboard failed:', err);
        setError(err.response?.data?.error || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, [selectedQ, selectedYear, user?.id]);

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

  const { metrics } = data;
  const attainmentPct = Math.min(metrics.quotaAttainment, 100);
  const qExcessDeficit = metrics.quarterlyExcessDeficit;
  const isAhead = qExcessDeficit >= 0;

  const openStages = metrics.pipelineByStage.filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage));

  // Stuck deals = deals that have been open long enough (open deals with old start dates)
  // We'll highlight deals in early stages with high revenue as important
  const stuckDeals = metrics.openDeals.filter(d => {
    if (!d.startDate) return false;
    const daysSinceStart = Math.floor((Date.now() - new Date(d.startDate).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceStart > 14;
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`${user?.firstName}'s Dashboard`}
        subtitle={`Q${data.quarter} ${data.year} · ${getQuarterRange(data.quarter, data.year)}`}
        action={{ label: 'New Deal', to: '/deals/new' }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quarter selector */}
        <div className="flex items-center gap-2 mb-6">
          {quarters.map(q => (
            <button
              key={q.label}
              onClick={() => { setSelectedQ(q.q); setSelectedYear(q.y); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                q.q === selectedQ && q.y === selectedYear
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
              <div className="text-xs font-medium text-[#4a5068] uppercase tracking-wider mb-2 font-display">Quota Attainment · Q{data.quarter} {data.year}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold font-display text-[#1a1d2e]">{metrics.quotaAttainment.toFixed(1)}%</span>
                <div>
                  <div className="text-sm text-[#4a5068]">{formatCurrency(metrics.closedRevenue, true)} closed</div>
                  <div className="text-xs text-[#8b90a8]">of target quota</div>
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
            label="Deals Closed"
            value={metrics.dealsClosed}
            sub="this quarter"
            accent="#10b981"
            icon={<Target size={16} />}
            delay={0}
          />
          <MetricCard
            label="Open Pipeline"
            value={metrics.openPipeline.count}
            sub={formatCurrency(metrics.openPipeline.value, true)}
            accent="#4f6ef7"
            icon={<Briefcase size={16} />}
            delay={50}
          />
          <MetricCard
            label="Sales Forecast"
            value={formatCurrency(metrics.salesForecast, true)}
            sub="closed + weighted"
            accent="#8b5cf6"
            icon={<TrendingUp size={16} />}
            delay={100}
          />
          <MetricCard
            label="Sales Variance"
            value={formatCurrency(Math.abs(metrics.salesVariance), true)}
            sub={metrics.salesVariance <= 0 ? 'above quota' : 'below quota'}
            accent={metrics.salesVariance <= 0 ? '#10b981' : '#f43f5e'}
            icon={metrics.salesVariance > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            delay={150}
          />
          <MetricCard
            label="Monthly +/-"
            value={`${metrics.monthlyExcessDeficit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(metrics.monthlyExcessDeficit), true)}`}
            sub="month-to-date"
            accent={metrics.monthlyExcessDeficit >= 0 ? '#10b981' : '#f43f5e'}
            delay={200}
          />
          <MetricCard
            label="Q Excess/Deficit"
            value={`${qExcessDeficit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(qExcessDeficit), true)}`}
            sub="quarter-to-date"
            accent={isAhead ? '#10b981' : '#f43f5e'}
            delay={250}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Open deals list */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Open Deals</div>
            <div className="flex flex-col gap-2">
              {metrics.openDeals.length > 0 ? metrics.openDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between gap-3 p-3 bg-[#f4f6fb] rounded-xl border border-[#e2e6f0]">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#1a1d2e] truncate">{deal.dealName}</div>
                    <div className="text-[10px] text-[#8b90a8]">{deal.client.name} · {deal.client.accountType}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StagePill stage={deal.stage as PipelineStage} size="sm" />
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
                <div key={stage.stage} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage.stage] || '#6b7280' }} />
                    <span className="text-xs text-[#4a5068] truncate">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(stage.value, true)}</span>
                    <span className="text-[10px] text-[#8b90a8] w-4 text-right">{stage.count}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No open pipeline</div>
              )}
            </div>
          </Card>
        </div>

        {/* Stuck deals */}
        {stuckDeals.length > 0 && (
          <Card className="p-5 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Aging Deals</span>
              <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {stuckDeals.map(deal => {
                const days = deal.startDate ? Math.floor((Date.now() - new Date(deal.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                return (
                  <div key={deal.id} className="flex items-center justify-between gap-3 p-3 bg-[#fffbeb] rounded-xl border border-[#fde68a]">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#1a1d2e] truncate">{deal.dealName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <StagePill stage={deal.stage as PipelineStage} size="sm" />
                        <span className="text-[10px] text-[#8b90a8]">{deal.client.name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-[#d97706]">{days}d</div>
                      <div className="text-[10px] text-[#8b90a8]">{formatCurrency(deal.revenue, true)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function getQuarterRange(quarter: number, year: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  return `${months[startMonth]} 1 – ${months[endMonth]} ${new Date(year, endMonth + 1, 0).getDate()}`;
}
