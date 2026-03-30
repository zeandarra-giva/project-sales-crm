import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { Trophy, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { dashboardApi } from '../api/dashboard';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types';

const COLORS = ['#4f6ef7', '#10b981', '#f59e0b', '#8b5cf6', '#e11d48', '#0891b2'];

interface ExecData {
  quarter: number;
  year: number;
  metrics: {
    teamActual: number;
    teamQuota: number;
    teamForecast: number;
    attainment: number;
    pipelineByStage: { stage: string; count: number; value: number }[];
    stuckDeals: { id: string; dealName: string; stage: string; bdName: string; daysStuck: number }[];
    leaderboard: { bdId: string; name: string; closedRevenue: number; dealCount: number; quota: number; attainment: number }[];
    dealsByAccountType: { accountType: string; count: number; revenue: number }[];
    servicePerformance: { service: string; dealCount: number; revenue: number }[];
  };
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState<ExecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  useEffect(() => {
    setLoading(true);
    setError(null);
    dashboardApi
      .executive({ year: currentYear, quarter: currentQuarter })
      .then((res) => {
        setData(res.data as ExecData);
      })
      .catch((err) => {
        console.error('Executive dashboard failed:', err);
        setError(err.response?.data?.error || 'Failed to load executive dashboard');
      })
      .finally(() => setLoading(false));
  }, [currentYear, currentQuarter]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Executive Dashboard" subtitle={`Team-wide performance · Q${currentQuarter} ${currentYear}`} />
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
        <Header title="Executive Dashboard" subtitle={`Team-wide performance · Q${currentQuarter} ${currentYear}`} />
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
  const stageData = metrics.pipelineByStage.filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage));

  return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle={`Team-wide performance · Q${data.quarter} ${data.year}`} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Team metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Team Actual" value={formatCurrency(metrics.teamActual, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(metrics.teamQuota, true)} sub={`Q${data.quarter} ${data.year}`} accent="#4f6ef7" delay={50} />
          <MetricCard label="Team Forecast" value={formatCurrency(metrics.teamForecast, true)} sub="Won + Weighted Pipeline" accent="#8b5cf6" delay={100} />
          <MetricCard label="Attainment" value={`${metrics.attainment}%`} sub="of quarterly quota" accent="#f59e0b" delay={150} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Pipeline by stage */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="h-64">
              {stageData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' }}
                      formatter={(val: number) => [formatCurrency(val), 'Value']}
                    />
                    <Bar dataKey="value" fill="#4f6ef730" stroke="#4f6ef7" strokeWidth={1} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No open pipeline data</div>
              )}
            </div>
          </Card>

          {/* Stuck deals */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
              <Badge variant="warning" size="sm">{metrics.stuckDeals.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {metrics.stuckDeals.map(deal => (
                <div key={deal.id} className="p-3 bg-[#f4f6fb] border border-[#d9770620] rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{deal.dealName}</span>
                    <span className="text-xs text-[#d97706] font-bold">{deal.daysStuck}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StagePill stage={deal.stage as PipelineStage} size="sm" />
                    <span className="text-xs text-[#8b90a8]">{deal.bdName}</span>
                  </div>
                </div>
              ))}
              {metrics.stuckDeals.length === 0 && (
                <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals</div>
              )}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · Q{data.quarter} {data.year}</span>
          </div>
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
              <div className="col-span-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">#</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Member</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Closed Rev.</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Attainment</div>
              <div className="col-span-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">Deals</div>
            </div>

            {metrics.leaderboard.map((entry, index) => {
              const rankColors = ['#f59e0b', '#8b90a8', '#cd7f32'];
              const attPct = Math.round(entry.attainment * 10) / 10;
              return (
                <div key={entry.bdId} className="grid grid-cols-12 gap-4 py-3 border-b border-[#f0f2f8] hover:bg-[#fafbfd] transition-colors">
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-bold font-display" style={{ color: rankColors[index] || '#4a4f6b' }}>
                      {index + 1}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Avatar name={entry.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d2e] truncate">{entry.name}</div>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(entry.closedRevenue, true)}</span>
                  </div>
                  <div className="col-span-3 flex flex-col justify-center gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4a5068]">{attPct}%</span>
                      <span className="text-[#8b90a8]">{formatCurrency(entry.quota, true)}</span>
                    </div>
                    <ProgressBar
                      value={Math.min(attPct, 100)}
                      color={attPct > 50 ? '#10b981' : attPct > 20 ? '#f59e0b' : '#f43f5e'}
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant={entry.dealCount > 0 ? 'success' : 'neutral'} size="sm">
                      {entry.dealCount} won
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deals by account type */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deals by Account Type · Q{data.quarter}</div>
            <div className="flex flex-col gap-2">
              {metrics.dealsByAccountType.length > 0 ? metrics.dealsByAccountType.map((item, i) => (
                <div key={item.accountType} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-[#4a5068]">{item.accountType}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue, true)}</span>
                    <Badge variant="neutral" size="sm">{item.count} deals</Badge>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No closed deals this quarter</div>
              )}
            </div>
          </Card>

          {/* Service performance */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Service Performance</div>
            <div className="flex flex-col gap-2">
              {metrics.servicePerformance.length > 0 ? metrics.servicePerformance.map(svc => (
                <div key={svc.service} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d2e]">{svc.service}</div>
                    <div className="text-[10px] text-[#8b90a8]">{svc.dealCount} deals</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold text-[#1a1d2e]">{formatCurrency(svc.revenue, true)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-xs text-[#8b90a8]">No service data this quarter</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
