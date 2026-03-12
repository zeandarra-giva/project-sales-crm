import { useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Trophy, AlertTriangle, Download } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useExecutiveDashboard } from '../hooks/useDashboard';
import { formatCurrency, cn } from '../lib/utils';

const YEARS = [2026, 2025, 2024];
const QS = [1, 2, 3, 4];
const COLORS = ['#3d5af1', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

function PieCard({ title, data, valueKey = 'revenue', labelKey, colorOffset = 0, onExport }: {
  title: string;
  data: any[];
  valueKey?: string;
  labelKey: string;
  colorOffset?: number;
  onExport?: () => void;
}) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  if (data.length === 0) return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">{title}</div>
      </div>
      <div className="text-center py-8 text-xs text-[#8b90a8]">No closed deals this period</div>
    </Card>
  );

  const chartData = data.map((d, i) => ({
    name: d[labelKey],
    value: Number(d[valueKey] ?? 0),
    count: d.count ?? 0,
    color: COLORS[(i + colorOffset) % COLORS.length],
  }));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">{title}</div>
        {onExport && (
          <button onClick={onExport} className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-colors" title="Export CSV">
            <Download size={12} />
          </button>
        )}
      </div>
      <div className="flex gap-4 items-center">
        <div className="w-36 h-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={34} outerRadius={60}
                dataKey="value" paddingAngle={2}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 11 }}
                formatter={(val: number) => [formatCurrency(val, true), 'Revenue']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {chartData.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-[#4a5068] truncate capitalize">{item.name?.toLowerCase?.() ?? item.name}</span>
                    <span className="text-[10px] text-[#8b90a8] flex-shrink-0">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold text-[#1a1d2e]">{formatCurrency(item.value, true)}</span>
                    <span className="text-[9px] text-[#c8cfe8]">{item.count} deals</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function IndustryTable({ data, onExport }: { data: any[]; onExport?: () => void }) {
  const total = data.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Industry Breakdown</div>
        {onExport && (
          <button onClick={onExport} className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#3d5af1] hover:bg-[#eef1fe] transition-colors" title="Export CSV">
            <Download size={12} />
          </button>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#e2e6f0]">
            <th className="text-left text-[10px] text-[#8b90a8] uppercase tracking-wider pb-2 font-medium">Industry</th>
            <th className="text-right text-[10px] text-[#8b90a8] uppercase tracking-wider pb-2 font-medium">Contract Value</th>
            <th className="text-right text-[10px] text-[#8b90a8] uppercase tracking-wider pb-2 font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.industry} className="border-b border-[#f0f2f8] hover:bg-[#fafbff]">
              <td className="py-2 text-[#4a5068]">{row.industry}</td>
              <td className="py-2 text-right font-semibold text-[#1a1d2e]">{Number(row.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 text-right text-[#8b90a8]">{row.count}</td>
            </tr>
          ))}
          {data.length > 0 && (
            <tr className="font-bold">
              <td className="py-2 text-[#1a1d2e]">Total</td>
              <td className="py-2 text-right text-[#1a1d2e]">{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              <td className="py-2 text-right text-[#1a1d2e]">{data.reduce((s, d) => s + d.count, 0)}</td>
            </tr>
          )}
          {data.length === 0 && (
            <tr><td colSpan={3} className="py-6 text-center text-[#8b90a8]">No data this period</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExecutiveDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);

  const { data, isLoading } = useExecutiveDashboard(year, quarter);

  const team = data?.team;
  const leaderboard = data?.leaderboard ?? [];
  const stuckDeals = data?.stuck_deals ?? [];
  const pipelineByStage = data?.pipeline_by_stage ?? [];
  const byAccountType = data?.by_account_type ?? [];
  const byService = data?.by_service ?? [];
  const byBD = (data as any)?.by_b_d ?? (data as any)?.by_bd ?? [];
  const byLeadSource = (data as any)?.by_lead_source ?? [];
  const byIndustry = (data as any)?.by_industry ?? [];

  const stageData = pipelineByStage.map(row => ({
    stage: (row as any).stage_name ?? row.stage_id,
    total_value: Number((row._sum as any)?.revenue ?? 0),
    count: (row._count as any)?.id ?? 0,
  }));

  const periodLabel = `Q${quarter} ${year}`;

  const exportAll = useCallback(() => {
    exportCSV(`closed-won-by-bd-${periodLabel}.csv`,
      ['BD Name', 'Deals Won', 'Contract Value'],
      byBD.map((d: any) => [d.bd_name, d.count, d.revenue])
    );
    exportCSV(`closed-won-by-service-${periodLabel}.csv`,
      ['Service', 'Deals Won', 'Contract Value'],
      byService.map((d: any) => [d.service, d.count, d.revenue])
    );
    exportCSV(`closed-won-by-lead-source-${periodLabel}.csv`,
      ['Lead Source', 'Deals Won', 'Contract Value'],
      byLeadSource.map((d: any) => [d.source, d.count, d.revenue])
    );
    exportCSV(`closed-won-by-account-type-${periodLabel}.csv`,
      ['Account Type', 'Deals Won', 'Contract Value'],
      byAccountType.map((d: any) => [d.account_type, d.count, d.revenue])
    );
    exportCSV(`industry-breakdown-${periodLabel}.csv`,
      ['Industry', 'Count', 'Contract Value'],
      byIndustry.map((d: any) => [d.industry, d.count, d.revenue])
    );
  }, [byBD, byService, byLeadSource, byAccountType, byIndustry, periodLabel]);

  if (isLoading) return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle="Loading…" />
      <div className="flex-1 flex items-center justify-center text-sm text-[#8b90a8]">Loading dashboard…</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle={`Team-wide performance · ${periodLabel}`} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters + Export */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Year */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#8b90a8] mr-1">Year</span>
              {YEARS.map(y => (
                <button key={y} onClick={() => setYear(y)} className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  y === year ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]' : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                )}>{y}</button>
              ))}
            </div>
            {/* Quarter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#8b90a8] mr-1">Quarter</span>
              {QS.map(q => (
                <button key={q} onClick={() => setQuarter(q)} className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  q === quarter ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]' : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                )}>Q{q}</button>
              ))}
            </div>
          </div>
          <button onClick={exportAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1d2e] text-white hover:bg-[#2d3148] transition-colors">
            <Download size={12} /> Export All CSVs
          </button>
        </div>

        {/* Team metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Team Actual" value={formatCurrency(team?.total_revenue ?? 0, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(team?.total_quota ?? 0, true)} sub="this quarter" accent="#4f6ef7" delay={50} />
          <MetricCard label="Team Forecast" value={formatCurrency(team?.sales_forecast ?? 0, true)} sub="Won + Negotiation" accent="#8b5cf6" delay={100} />
          <MetricCard label="Attainment" value={`${(team?.attainment_pct ?? 0).toFixed(1)}%`} sub="of quarterly quota" accent="#f59e0b" delay={150} />
        </div>

        {/* Pipeline + Stuck */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, name: string) => [name === 'total_value' ? formatCurrency(val) : val, name === 'total_value' ? 'Total Value' : 'Count']} />
                  <Bar dataKey="total_value" fill="#4f6ef730" stroke="#4f6ef7" strokeWidth={1} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
              <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-48">
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
              {stuckDeals.length === 0 && <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals 🎉</div>}
            </div>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · {periodLabel}</span>
          </div>
          <div className="flex flex-col gap-0">
            <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
              {['#', 'Member', 'Closed Rev.', 'Attainment', 'Win Rate'].map((h, i) => (
                <div key={h} className={`${i === 0 ? 'col-span-1' : i === 1 ? 'col-span-3' : i === 4 ? 'col-span-2' : 'col-span-3'} text-[10px] text-[#8b90a8] uppercase tracking-wider`}>{h}</div>
              ))}
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
                      <div className="text-[10px] text-[#8b90a8]">{entry.bd.role}</div>
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
                    <Badge variant={entry.win_rate > 50 ? 'success' : entry.win_rate > 20 ? 'warning' : 'danger'} size="sm">{entry.win_rate}%</Badge>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && <div className="text-center py-8 text-xs text-[#8b90a8]">No data for this period</div>}
          </div>
        </Card>

        {/* Closed Won Breakdown — 4 pie charts */}
        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">
          Closed Won Breakdown · {periodLabel}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PieCard title="By BD Rep" data={byBD} labelKey="bd_name" colorOffset={0}
            onExport={() => exportCSV(`by-bd-${periodLabel}.csv`, ['BD Name', 'Deals', 'Revenue'], byBD.map((d: any) => [d.bd_name, d.count, d.revenue]))} />
          <PieCard title="By Service" data={byService} labelKey="service" colorOffset={2}
            onExport={() => exportCSV(`by-service-${periodLabel}.csv`, ['Service', 'Deals', 'Revenue'], byService.map((d: any) => [d.service, d.count, d.revenue]))} />
          <PieCard title="By Lead Source" data={byLeadSource} labelKey="source" colorOffset={4}
            onExport={() => exportCSV(`by-lead-source-${periodLabel}.csv`, ['Source', 'Deals', 'Revenue'], byLeadSource.map((d: any) => [d.source, d.count, d.revenue]))} />
          <PieCard title="By Client Type" data={byAccountType.filter((d: any) => d.count > 0)} labelKey="account_type" colorOffset={6}
            onExport={() => exportCSV(`by-client-type-${periodLabel}.csv`, ['Type', 'Deals', 'Revenue'], byAccountType.map((d: any) => [d.account_type, d.count, d.revenue]))} />
        </div>

        {/* Industry breakdown table */}
        <IndustryTable data={byIndustry}
          onExport={() => exportCSV(`industry-breakdown-${periodLabel}.csv`, ['Industry', 'Count', 'Revenue'], byIndustry.map((d: any) => [d.industry, d.count, d.revenue]))} />
      </div>
    </div>
  );
}