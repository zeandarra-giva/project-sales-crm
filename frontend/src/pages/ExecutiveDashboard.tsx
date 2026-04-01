import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { Trophy, AlertTriangle, TrendingUp, Loader2, Download } from 'lucide-react';
import { downloadXlsx, pesoStr, pctStr } from '../lib/exportXlsx';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useExecutiveDashboard } from '../hooks/useDashboard';
import { useReportingPeriods } from '../hooks/useReporting';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types';

const COLORS = ['#4f6ef7', '#10b981', '#f59e0b', '#8b5cf6', '#e11d48', '#0891b2'];

export interface ExecData {
  team?: {
    total_revenue: number;
    total_quota: number;
    sales_forecast: number;
    attainment_pct: number;
  };
  leaderboard: {
    bd_id: string;
    first_name: string;
    last_name: string;
    revenue: number;
    quota: number;
    attainment_pct: number;
    win_rate?: number;
    rank?: number;
  }[];
  stuck_deals: {
    deal_id: string;
    deal_name: string;
    stage_name: string;
    first_name: string;
    last_name: string;
    days_in_stage: number;
  }[];
  pipeline_by_stage: { stage_name: string; deal_count: number; total_value: number }[];
  by_account_type: { account_type: string; deal_count: number; revenue: number }[];
  by_service: { service_name: string; deal_count: number; revenue: number }[];
}

export default function ExecutiveDashboard() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'ALL'>(currentQuarter);
  const { data: reportingPeriods } = useReportingPeriods();
  const availableYears = reportingPeriods?.years ?? [currentYear];

  const { data, isLoading: loading, error: queryError } = useExecutiveDashboard(selectedQuarter, selectedYear);
  const error = queryError ? (queryError as any).response?.data?.detail || (queryError as any).response?.data?.error || (queryError as Error).message || 'Failed to load executive dashboard' : null;

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

  const stageData = (data.pipeline_by_stage || []).filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage_name));

  const handleExport = () => {
    const periodLabel = selectedQuarter === 'ALL' ? `${selectedYear}-All` : `${selectedYear}-Q${selectedQuarter}`;
    downloadXlsx(`Executive-Dashboard-${periodLabel}`, [
      {
        name: 'Team Summary',
        rows: [{
          'Period': periodLabel,
          'Team Revenue': pesoStr(data.team?.total_revenue),
          'Team Quota': pesoStr(data.team?.total_quota),
          'Sales Forecast': pesoStr(data.team?.sales_forecast),
          'Attainment %': pctStr(data.team?.attainment_pct),
        }],
      },
      {
        name: 'Leaderboard',
        rows: (data.leaderboard || []).map((bd, i) => ({
          'Rank': bd.rank ?? i + 1,
          'Name': `${bd.first_name} ${bd.last_name}`,
          'Revenue': pesoStr(bd.revenue),
          'Quota': pesoStr(bd.quota),
          'Attainment %': pctStr(bd.attainment_pct),
          'Win Rate %': bd.win_rate != null ? pctStr(bd.win_rate) : '—',
        })),
      },
      {
        name: 'Pipeline by Stage',
        rows: (data.pipeline_by_stage || []).map(s => ({
          'Stage': s.stage_name,
          'Deals': s.deal_count,
          'Total Value': pesoStr(s.total_value),
        })),
      },
      {
        name: 'By Account Type',
        rows: (data.by_account_type || []).map(a => ({
          'Account Type': a.account_type,
          'Deals': a.deal_count,
          'Revenue': pesoStr(a.revenue),
        })),
      },
      {
        name: 'By Service',
        rows: (data.by_service || []).map(s => ({
          'Service': s.service_name,
          'Deals': s.deal_count,
          'Revenue': pesoStr(s.revenue),
        })),
      },
      {
        name: 'Stuck Deals',
        rows: (data.stuck_deals || []).map(d => ({
          'Deal': d.deal_name,
          'Stage': d.stage_name,
          'Owner': `${d.first_name} ${d.last_name}`,
          'Days in Stage': d.days_in_stage,
        })),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle={`Team-wide performance · ${selectedQuarter === 'ALL' ? 'All Quarters' : `Q${selectedQuarter}`} ${selectedYear}`} />

      <div className="flex-1 overflow-y-auto p-6">
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
              onClick={() => setSelectedQuarter(quarter)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                quarter === selectedQuarter
                  ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                  : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
              )}
            >
              {quarter === 'ALL' ? 'All' : `Q${quarter}`}
            </button>
          ))}
          <button
            onClick={handleExport}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#e2e6f0] bg-white text-[#4a5068] hover:border-[#3d5af1] hover:text-[#3d5af1] transition-all"
          >
            <Download size={12} /> Export XLSX
          </button>
        </div>
        {/* Team metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Team Actual" value={formatCurrency(data.team?.total_revenue || 0, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(data.team?.total_quota || 0, true)} sub={`${selectedQuarter === 'ALL' ? 'All Quarters' : `Q${selectedQuarter}`} ${selectedYear}`} accent="#4f6ef7" delay={50} />
          <MetricCard label="Team Forecast" value={formatCurrency(data.team?.sales_forecast || 0, true)} sub={selectedQuarter === 'ALL' ? 'annual won + live negotiation' : 'Won + Weighted Pipeline'} accent="#8b5cf6" delay={100} />
          <MetricCard label="Attainment" value={`${data.team?.attainment_pct || 0}%`} sub={selectedQuarter === 'ALL' ? 'of annual quota' : 'of quarterly quota'} accent="#f59e0b" delay={150} />
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
                    <YAxis type="category" dataKey="stage_name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' }}
                      formatter={(val: number) => [formatCurrency(val), 'Value']}
                    />
                    <Bar dataKey="total_value" fill="#4f6ef730" stroke="#4f6ef7" strokeWidth={1} radius={[0, 4, 4, 0]} />
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
              <Badge variant="warning" size="sm">{(data.stuck_deals || []).length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {(data.stuck_deals || []).map(deal => (
                <div key={deal.deal_id} className="p-3 bg-[#f4f6fb] border border-[#d9770620] rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{deal.deal_name}</span>
                    <span className="text-xs text-[#d97706] font-bold">{deal.days_in_stage}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StagePill stage={deal.stage_name as PipelineStage} size="sm" />
                    <span className="text-xs text-[#8b90a8]">{deal.first_name} {deal.last_name}</span>
                  </div>
                </div>
              ))}
              {(data.stuck_deals || []).length === 0 && (
                <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals</div>
              )}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · {selectedQuarter === 'ALL' ? 'All Quarters' : `Q${selectedQuarter}`} {selectedYear}</span>
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

            {(data.leaderboard || []).map((entry, index) => {
              const rankColors = ['#f59e0b', '#8b90a8', '#cd7f32'];
              const attPct = Math.round((entry.attainment_pct || 0) * 10) / 10;
              return (
                <div key={entry.bd_id} className="grid grid-cols-12 gap-4 py-3 border-b border-[#f0f2f8] hover:bg-[#fafbfd] transition-colors">
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-bold font-display" style={{ color: rankColors[index] || '#4a4f6b' }}>
                      {entry.rank || index + 1}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Avatar name={`${entry.first_name} ${entry.last_name}`} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d2e] truncate">{entry.first_name} {entry.last_name}</div>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(entry.revenue, true)}</span>
                  </div>
                  <div className="col-span-3 flex flex-col justify-center gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#4a5068]">{attPct}%</span>
                      <span className="text-[#8b90a8]">{formatCurrency(entry.quota || 0, true)}</span>
                    </div>
                    <ProgressBar
                      value={Math.min(attPct, 100)}
                      color={attPct > 50 ? '#10b981' : attPct > 20 ? '#f59e0b' : '#f43f5e'}
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <Badge variant={(entry.win_rate || 0) > 50 ? 'success' : 'neutral'} size="sm">
                      {entry.win_rate || 0}% win
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
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deals by Account Type · {selectedQuarter === 'ALL' ? 'Year' : `Q${selectedQuarter}`}</div>
            <div className="flex flex-col gap-2">
              {(data.by_account_type || []).length > 0 ? data.by_account_type.map((item, i) => (
                <div key={item.account_type} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-[#4a5068]">{item.account_type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue, true)}</span>
                    <Badge variant="neutral" size="sm">{item.deal_count} deals</Badge>
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
              {(data.by_service || []).length > 0 ? data.by_service.map(svc => (
                <div key={svc.service_name} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d2e]">{svc.service_name}</div>
                    <div className="text-[10px] text-[#8b90a8]">{svc.deal_count} deals</div>
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
