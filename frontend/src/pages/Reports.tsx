import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Loader2, AlertTriangle, Trophy, Filter, Users } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useAuthStore } from '../store/authStore';
import { reportsApi } from '../api/reports';
import {
  useReportData,
  useBDList,
  useGrowthComparisonPair,
  type GrowthComparisonSelection,
  type GrowthComparisonSnapshot,
} from '../hooks/useReports';
import { useReportingPeriods } from '../hooks/useReporting';
import { formatCurrency, cn } from '../lib/utils';
import type { PipelineStage } from '../types';

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

const ALL_TABS = ['Pipeline', 'Quota Performance', 'Win/Loss', 'Sales Cycle', 'Loss Analysis', 'Growth Table', 'Executive'];
const COLORS = ['#3d5af1', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#6366f1', '#ec4899'];
const QUARTERS = [1, 2, 3, 4];
const TT = {
  contentStyle: { background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' },
  itemStyle: { color: '#4a5068' },
  labelStyle: { color: '#1a1d2e', fontWeight: 600 },
};

interface BDOption {
  id: string;
  first_name: string;
  last_name: string;
}

function toggleMultiValue(values: number[], value: number) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort((a, b) => a - b);
}

function buildGrowthMetricChart(leftData?: GrowthComparisonSnapshot, rightData?: GrowthComparisonSnapshot) {
  return [
    { metric: 'Actual Revenue', left: leftData?.actual || 0, right: rightData?.actual || 0 },
    { metric: 'Pipeline', left: leftData?.pipelineValue || 0, right: rightData?.pipelineValue || 0 },
    { metric: 'Quota', left: leftData?.quota || 0, right: rightData?.quota || 0 },
    { metric: 'Lost Value', left: leftData?.lostValue || 0, right: rightData?.lostValue || 0 },
  ];
}

function buildServiceComparison(leftData?: GrowthComparisonSnapshot, rightData?: GrowthComparisonSnapshot) {
  const map = new Map<string, { metric: string; left: number; right: number }>();

  for (const item of leftData?.serviceRevenue || []) {
    map.set(item.name, { metric: item.name, left: item.value, right: 0 });
  }

  for (const item of rightData?.serviceRevenue || []) {
    const existing = map.get(item.name) || { metric: item.name, left: 0, right: 0 };
    existing.right = item.value;
    map.set(item.name, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => Math.max(b.left, b.right) - Math.max(a.left, a.right))
    .slice(0, 6);
}

function GrowthFilterBuilder({
  title,
  accent,
  config,
  onChange,
  availableYears,
}: {
  title: string;
  accent: string;
  config: GrowthComparisonSelection;
  onChange: (next: GrowthComparisonSelection) => void;
  availableYears: number[];
}) {
  const yearOptions = availableYears.length > 0 ? availableYears : config.years;
  const summary = `${config.years.length > 0 ? config.years.join(', ') : 'No years'} · ${config.quarters.length > 0 ? config.quarters.map((quarter) => `Q${quarter}`).join(', ') : 'All quarters'}`;
  const [yearsOpen, setYearsOpen] = useState(false);
  const selectedYearsLabel = config.years.length === 0
    ? 'Select years'
    : config.years.length <= 2
      ? config.years.join(', ')
      : `${config.years.length} years selected`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold font-display uppercase tracking-wider" style={{ color: accent }}>{title}</div>
          <div className="text-xs text-[#8b90a8] mt-1">Build the comparison window for this side.</div>
        </div>
        <Badge variant="neutral" size="sm">{summary}</Badge>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#8b90a8] mb-2">Years</div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setYearsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-xl border border-[#e2e6f0] bg-white px-3 py-2 text-sm text-[#1a1d2e] shadow-sm"
            >
              <span>{selectedYearsLabel}</span>
              <span className="text-xs text-[#8b90a8]">{yearsOpen ? 'Close' : 'Open'}</span>
            </button>
            {yearsOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-[#e2e6f0] bg-white p-2 shadow-lg">
                <div className="flex max-h-48 flex-col overflow-y-auto">
                  {yearOptions.map((year) => {
                    const active = config.years.includes(year);
                    return (
                      <label
                        key={year}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#1a1d2e] hover:bg-[#f8faff] cursor-pointer"
                      >
                        <span>{year}</span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => onChange({ ...config, years: toggleMultiValue(config.years, year) })}
                          className="h-4 w-4 accent-[#3d5af1]"
                          style={{ accentColor: accent }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="text-[11px] text-[#8b90a8] mt-2">Pick one or more real reporting years.</div>
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#8b90a8] mb-2">Quarters</div>
          <div className="flex flex-wrap gap-2">
            {QUARTERS.map((quarter) => {
              const active = config.quarters.includes(quarter);
              return (
              <button
                key={quarter}
                type="button"
                onClick={() => onChange({ ...config, quarters: toggleMultiValue(config.quarters, quarter) })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  active ? 'text-white shadow-sm' : 'border-[#e2e6f0] text-[#4a5068] bg-white hover:bg-[#f8faff]'
                )}
                style={active ? { backgroundColor: accent, borderColor: accent } : undefined}
              >
                {`Q${quarter}`}
              </button>
            )})}
          </div>
          <div className="text-[11px] text-[#8b90a8] mt-2">Leave all quarters off to compare the full year span.</div>
        </div>
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const TABS = ALL_TABS;

  const [tab, setTab] = useState('Pipeline');
  const [selectedBD, setSelectedBD] = useState<string>('');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [leftGrowthConfig, setLeftGrowthConfig] = useState<GrowthComparisonSelection>({
    years: [currentYear],
    quarters: [],
  });
  const [rightGrowthConfig, setRightGrowthConfig] = useState<GrowthComparisonSelection>({
    years: [currentYear],
    quarters: [],
  });

  const { data: reportingPeriods } = useReportingPeriods();
  const { data: bdList = [] } = useBDList();
  const availableYears = reportingPeriods?.years ?? [currentYear];

  useEffect(() => {
    const primaryYear = availableYears[0] ?? currentYear;
    const secondaryYear = availableYears[1] ?? availableYears[0] ?? currentYear;

    setLeftGrowthConfig((prev) => ({
      years: prev.years.filter((year) => availableYears.includes(year)).length > 0
        ? prev.years.filter((year) => availableYears.includes(year))
        : [primaryYear],
      quarters: prev.quarters,
    }));

    setRightGrowthConfig((prev) => ({
      years: prev.years.filter((year) => availableYears.includes(year)).length > 0
        ? prev.years.filter((year) => availableYears.includes(year))
        : [secondaryYear],
      quarters: prev.quarters,
    }));
  }, [availableYears, currentYear]);
  const { data, isLoading: loading, error: queryError, refetch } = useReportData(tab, selectedYear, selectedQuarter, selectedBD);
  const {
    data: growthComparisonData,
    isLoading: growthLoading,
    error: growthError,
    refetch: refetchGrowthComparison,
  } = useGrowthComparisonPair(leftGrowthConfig, rightGrowthConfig, selectedBD, tab === 'Growth Table');

  const leftGrowthData = growthComparisonData?.left;
  const rightGrowthData = growthComparisonData?.right;

  const error = queryError ? (queryError as any).response?.data?.detail || (queryError as any).response?.data?.error || (queryError as Error).message || `Failed to load ${tab} report` : null;
  const growthTableError = growthError
    ? (growthError as any).response?.data?.error || (growthError as Error).message || 'Failed to load growth comparison'
    : null;

  // Shim variables pointing to current tab's data
  const pipelineData = tab === 'Pipeline' ? data : null;
  const quotaData = tab === 'Quota Performance' ? data : null;
  const winRateData = tab === 'Win/Loss' ? data : null;
  const salesCycleData = tab === 'Sales Cycle' ? data : null;
  const lossData = tab === 'Loss Analysis' ? data : null;
  const execData = tab === 'Executive' ? data : null;

  const handleExport = async (reportType: string) => {
    try {
      const params: any = { year: selectedYear, quarter: selectedQuarter };
      if (selectedBD) params.bd_id = selectedBD;
      const res = await reportsApi.exportExcel(reportType, params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-Q${selectedQuarter}-${selectedYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Make sure the analytics service is running.');
    }
  };

  const reportTypeMap: Record<string, string> = {
    'Pipeline': 'pipeline',
    'Quota Performance': 'quota',
    'Win/Loss': 'win-rate',
    'Sales Cycle': 'sales-cycle',
    'Loss Analysis': 'loss-analysis',
  };

  const canExport = tab !== 'Executive';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Executive Reports"
        subtitle={`Analytics and performance insights · Q${selectedQuarter} ${selectedYear}`}
        action={canExport ? {
          label: 'Export Excel',
          onClick: () => handleExport(reportTypeMap[tab] || 'pipeline'),
        } : undefined}
      />
      <div className="flex-1 overflow-y-auto">
        {/* Global BD Filter + Tab Navigation */}
        <div className="px-6 pt-4 pb-0 border-b border-[#e2e6f0]">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-[#8b90a8]" />
              <span className="text-xs font-medium text-[#4a5068]">Filters:</span>
            </div>
            <select
              value={selectedYear}
              onChange={e => {
                const year = parseInt(e.target.value, 10);
                setSelectedYear(year);
              }}
              className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-[#3d5af1] focus:border-transparent"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-[#f4f6fb] border border-[#e2e6f0] rounded-xl p-1">
              {[1, 2, 3, 4].map(q => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs transition-all whitespace-nowrap',
                    selectedQuarter === q
                      ? 'bg-white text-[#3d5af1] border border-[#c7d0fb] shadow-sm'
                      : 'text-[#8b90a8] hover:text-[#4a5068]'
                  )}
                >
                  {`Q${q}`}
                </button>
              ))}
            </div>
            <select
              value={selectedBD}
              onChange={e => setSelectedBD(e.target.value)}
              className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-[#3d5af1] focus:border-transparent"
            >
              <option value="">All BDs</option>
              {bdList.map((bd: BDOption) => (
                <option key={bd.id} value={bd.id}>{bd.first_name} {bd.last_name}</option>
              ))}
            </select>
            {selectedBD && (
              <button
                onClick={() => setSelectedBD('')}
                className="text-xs text-[#3d5af1] hover:text-[#2d4ad1] font-medium"
              >
                Clear filter
              </button>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px', tab === t ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-[#8b90a8] border-transparent hover:text-[#4a5068]')}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">

          {loading && tab !== 'Growth Table' && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-[#8b90a8]">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading {tab} report...</span>
              </div>
            </div>
          )}

          {error && !loading && tab !== 'Growth Table' && (
            <Card className="p-8 text-center max-w-md mx-auto">
              <AlertTriangle size={24} className="text-[#d97706] mx-auto mb-3" />
              <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Failed to load report</div>
              <div className="text-xs text-[#8b90a8] mb-1">{error}</div>
              <div className="text-xs text-[#8b90a8]">Make sure the analytics service is running on port 8001.</div>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 text-xs font-medium bg-[#3d5af1] text-white rounded-lg hover:bg-[#2d4ad1] transition-colors"
              >
                Retry
              </button>
            </Card>
          )}

          {!loading && !error && tab === 'Growth Table' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Growth Comparison Workspace</div>
                    <div className="text-sm text-[#1a1d2e] mt-1">Compare two reporting windows side by side using either a year with selected quarters or a quarter across selected years.</div>
                    <div className="text-xs text-[#8b90a8] mt-2">This view pulls live BD analytics for quota attainment, service revenue, revenue by account, lead source performance, win/loss, and sales cycle analysis.</div>
                  </div>
                  {selectedBD ? (
                    <Badge variant="info" size="sm">Filtered to selected BD</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">All BD sales included</Badge>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <GrowthFilterBuilder
                  title="Left Side"
                  accent="#3d5af1"
                  config={leftGrowthConfig}
                  onChange={setLeftGrowthConfig}
                  availableYears={availableYears}
                />
                <GrowthFilterBuilder
                  title="Right Side"
                  accent="#0f9f8f"
                  config={rightGrowthConfig}
                  onChange={setRightGrowthConfig}
                  availableYears={availableYears}
                />
              </div>

              {growthLoading ? (
                <Card className="p-10">
                  <div className="flex items-center justify-center text-sm text-[#8b90a8]">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Loading comparison analytics...
                  </div>
                </Card>
              ) : growthTableError ? (
                <Card className="p-8 text-center max-w-md mx-auto">
                  <AlertTriangle size={24} className="text-[#d97706] mx-auto mb-3" />
                  <div className="text-sm font-semibold text-[#1a1d2e] mb-1">Failed to load growth comparison</div>
                  <div className="text-xs text-[#8b90a8] mb-1">{growthTableError}</div>
                  <div className="text-xs text-[#8b90a8]">Make sure the analytics service is running on port 8001.</div>
                  <button
                    onClick={() => refetchGrowthComparison()}
                    className="mt-4 px-4 py-2 text-xs font-medium bg-[#3d5af1] text-white rounded-lg hover:bg-[#2d4ad1] transition-colors"
                  >
                    Retry
                  </button>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Revenue Delta',
                        value: formatCurrency((leftGrowthData?.actual || 0) - (rightGrowthData?.actual || 0), true),
                        tone: (leftGrowthData?.actual || 0) >= (rightGrowthData?.actual || 0),
                        sub: `${leftGrowthData?.label || 'Left'} vs ${rightGrowthData?.label || 'Right'}`,
                      },
                      {
                        label: 'Attainment Gap',
                        value: `${((leftGrowthData?.attainmentPct || 0) - (rightGrowthData?.attainmentPct || 0)).toFixed(1)}%`,
                        tone: (leftGrowthData?.attainmentPct || 0) >= (rightGrowthData?.attainmentPct || 0),
                        sub: 'quota attainment',
                      },
                      {
                        label: 'Win Rate Gap',
                        value: `${((leftGrowthData?.winRate || 0) - (rightGrowthData?.winRate || 0)).toFixed(1)}%`,
                        tone: (leftGrowthData?.winRate || 0) >= (rightGrowthData?.winRate || 0),
                        sub: 'closed opportunities',
                      },
                      {
                        label: 'Cycle Speed Gap',
                        value: `${(((rightGrowthData?.avgSalesCycleDays || 0) - (leftGrowthData?.avgSalesCycleDays || 0))).toFixed(1)}d`,
                        tone: (leftGrowthData?.avgSalesCycleDays || 0) <= (rightGrowthData?.avgSalesCycleDays || 0),
                        sub: 'positive means left side is faster',
                      },
                    ].map((item) => (
                      <Card key={item.label} className="p-4">
                        <div className="text-xs text-[#8b90a8] mb-1">{item.label}</div>
                        <div className={cn('text-2xl font-bold font-display', item.tone ? 'text-[#10b981]' : 'text-[#e11d48]')}>{item.value}</div>
                        <div className="text-xs text-[#8b90a8] mt-1">{item.sub}</div>
                      </Card>
                    ))}
                  </div>

                  <Card className="p-5">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <div>
                        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Core Metric Comparison</div>
                        <div className="text-xs text-[#8b90a8] mt-1">Revenue, pipeline, quota, and lost value side by side.</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="info" size="sm">{leftGrowthData?.label || 'Left'}</Badge>
                        <Badge variant="success" size="sm">{rightGrowthData?.label || 'Right'}</Badge>
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={buildGrowthMetricChart(leftGrowthData, rightGrowthData)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                          <XAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                          <Tooltip {...TT} formatter={(value: number) => [formatCurrency(value), '']} />
                          <Legend />
                          <Bar dataKey="left" name={leftGrowthData?.label || 'Left'} fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="right" name={rightGrowthData?.label || 'Right'} fill="#c9f1eb" stroke="#0f9f8f" strokeWidth={1} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {[
                      { title: 'Left Snapshot', accent: '#3d5af1', data: leftGrowthData },
                      { title: 'Right Snapshot', accent: '#0f9f8f', data: rightGrowthData },
                    ].map((panel) => (
                      <Card key={panel.title} className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <div className="text-xs font-semibold font-display uppercase tracking-wider" style={{ color: panel.accent }}>{panel.title}</div>
                            <div className="text-lg font-bold font-display text-[#1a1d2e] mt-1">{panel.data?.label}</div>
                            <div className="text-xs text-[#8b90a8] mt-1">{panel.data?.periods.map((item) => `${item.year} Q${item.quarter}`).join(' · ')}</div>
                          </div>
                          <Badge variant="neutral" size="sm">{panel.data?.periods.length || 0} periods</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {[
                            { label: 'Quota Attainment', value: `${panel.data?.attainmentPct.toFixed(1) || '0.0'}%`, tone: 'text-[#3d5af1]' },
                            { label: 'Actual Revenue', value: formatCurrency(panel.data?.actual || 0, true), tone: 'text-[#10b981]' },
                            { label: 'Win/Loss', value: `${panel.data?.wins || 0} / ${panel.data?.losses || 0}`, tone: 'text-[#1a1d2e]' },
                            { label: 'Avg. Sales Cycle', value: panel.data?.avgSalesCycleDays ? `${panel.data.avgSalesCycleDays.toFixed(1)}d` : 'N/A', tone: 'text-[#d97706]' },
                          ].map((metric) => (
                            <div key={metric.label} className="rounded-xl border border-[#e2e6f0] bg-[#fafbfd] p-3">
                              <div className="text-[10px] uppercase tracking-wider text-[#8b90a8] mb-1">{metric.label}</div>
                              <div className={cn('text-lg font-bold font-display', metric.tone)}>{metric.value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Service Revenue</div>
                            <div className="h-56">
                              {(panel.data?.serviceRevenue.length || 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={panel.data?.serviceRevenue || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label={renderPieLabel} labelLine={false}>
                                      {(panel.data?.serviceRevenue || []).map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip {...TT} formatter={(value: number, name: string) => [formatCurrency(value), name]} />
                                  </PieChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No service revenue data</div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Revenue by Account</div>
                            <div className="h-56">
                              {(panel.data?.accountRevenue.length || 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={panel.data?.accountRevenue || []} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip {...TT} formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                                    <Bar dataKey="value" fill={`${panel.accent}33`} stroke={panel.accent} strokeWidth={1} radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No account mix data</div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Lead Source Performance</div>
                            <div className="h-56">
                              {(panel.data?.leadSourcePerformance.length || 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={panel.data?.leadSourcePerformance || []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                                    <XAxis dataKey="source" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                                    <Tooltip
                                      {...TT}
                                      formatter={(value: number, key: string, item: any) => {
                                        if (key === 'value') return [formatCurrency(value), 'Revenue'];
                                        return [`${item?.payload?.winRate?.toFixed(1) || 0}%`, 'Win Rate'];
                                      }}
                                    />
                                    <Bar dataKey="value" fill={`${panel.accent}33`} stroke={panel.accent} strokeWidth={1} radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No lead source data</div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1.5 mt-2">
                              {(panel.data?.leadSourcePerformance || []).map((item) => (
                                <div key={item.source} className="flex items-center justify-between gap-2 text-xs border-b border-[#f0f2f8] py-1.5">
                                  <span className="text-[#4a5068]">{item.source}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#8b90a8]">{item.deals} deals</span>
                                    <Badge variant={item.winRate >= 50 ? 'success' : item.winRate > 0 ? 'warning' : 'neutral'} size="sm">{item.winRate.toFixed(1)}%</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Win/Loss Mix</div>
                              <div className="h-52">
                                {(panel.data?.wins || 0) + (panel.data?.losses || 0) > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={[
                                          { name: 'Won', value: panel.data?.wins || 0 },
                                          { name: 'Lost', value: panel.data?.losses || 0 },
                                        ]}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={76}
                                        label={renderPieLabel}
                                        labelLine={false}
                                      >
                                        <Cell fill="#10b981" />
                                        <Cell fill="#e11d48" />
                                      </Pie>
                                      <Tooltip {...TT} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No closed deals in this slice</div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-3">Sales Cycle Analysis</div>
                              <div className="h-52">
                                {(panel.data?.stageCycle.length || 0) > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={panel.data?.stageCycle || []} layout="vertical" margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}d`} />
                                      <YAxis type="category" dataKey="stage" width={100} tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                      <Tooltip {...TT} formatter={(value: number) => [`${value.toFixed(1)} days`, 'Avg. cycle']} />
                                      <Bar dataKey="avgDays" fill={`${panel.accent}33`} stroke={panel.accent} strokeWidth={1} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No stage cycle data</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Card className="p-5">
                    <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Service Revenue Comparison</div>
                    <div className="h-72">
                      {buildServiceComparison(leftGrowthData, rightGrowthData).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={buildServiceComparison(leftGrowthData, rightGrowthData)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                            <XAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(Number(value), true)} />
                            <Tooltip {...TT} formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                            <Legend />
                            <Bar dataKey="left" name={leftGrowthData?.label || 'Left'} fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="right" name={rightGrowthData?.label || 'Right'} fill="#c9f1eb" stroke="#0f9f8f" strokeWidth={1} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No comparable service revenue data</div>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* ── Pipeline Tab ── */}
          {!loading && !error && tab === 'Pipeline' && pipelineData && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Pipeline', value: formatCurrency(pipelineData.total_pipeline_value || 0, true) },
                  { label: 'Active Deals', value: String(pipelineData.total_deals || 0) },
                  { label: 'Services', value: String((pipelineData.by_service || []).length) },
                  { label: 'Period', value: pipelineData.period },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-2xl font-bold font-display text-[#1a1d2e]">{m.value}</div>
                  </Card>
                ))}
              </div>

              {/* Pipeline by Stage bar chart */}
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline Value by Stage</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineData.stages || []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="stage_name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), 'Value']} />
                      <Bar dataKey="total_value" radius={[4, 4, 0, 0]}>
                        {(pipelineData.stages || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length] + '40'} stroke={COLORS[i % COLORS.length]} strokeWidth={1} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Services Pie Chart */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">By Service</div>
                  {(pipelineData.by_service || []).length > 0 ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pipelineData.by_service} dataKey="total_value" nameKey="service_name" cx="50%" cy="50%" outerRadius={80} label={renderPieLabel} labelLine={false}>
                              {(pipelineData.by_service || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TT} formatter={(val: number, name: string) => [formatCurrency(val), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2">
                        {(pipelineData.by_service || []).map((s: any, i: number) => (
                          <div key={s.service_name} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-[10px] text-[#4a5068]">{s.service_name}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-[#1a1d2e]">{formatCurrency(s.total_value, true)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-xs text-[#8b90a8]">No data</div>
                  )}
                </Card>

                {/* Account Type */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">By Account Type</div>
                  <div className="flex flex-col gap-2">
                    {(pipelineData.by_account_type || []).length > 0 ? (pipelineData.by_account_type || []).map((item: any, i: number) => (
                      <div key={item.account_type} className="flex items-center justify-between gap-2 py-2 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{item.account_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8b90a8]">{item.deal_count} deals</span>
                          <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.total_value, true)}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-xs text-[#8b90a8]">No data</div>
                    )}
                  </div>
                </Card>

                {/* Lead Source + Contributors */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Lead Source</div>
                  <div className="flex flex-col gap-2">
                    {(pipelineData.by_lead_source || []).length > 0 ? (pipelineData.by_lead_source || []).map((item: any, i: number) => (
                      <div key={item.lead_source} className="flex items-center justify-between gap-2 py-2 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{item.lead_source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8b90a8]">{item.deal_count} deals</span>
                          <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.total_value, true)}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-xs text-[#8b90a8]">No data</div>
                    )}
                  </div>

                  {/* Contributors / BD */}
                  {!selectedBD && (pipelineData.by_bd || []).length > 0 && (
                    <>
                      <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mt-5 mb-3">Contributors</div>
                      <div className="flex flex-col gap-2">
                        {(pipelineData.by_bd || []).map((bd: any) => (
                          <div key={bd.bd_id} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="text-xs text-[#4a5068]">{bd.bd_name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="neutral" size="sm">{bd.deal_count}</Badge>
                              <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(bd.total_value, true)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ── Quota Performance Tab ── */}
          {!loading && !error && tab === 'Quota Performance' && quotaData && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: selectedBD ? 'BD Quota' : 'Team Quota', value: formatCurrency(quotaData.team_quota || 0, true) },
                  { label: selectedBD ? 'BD Actual' : 'Team Actual', value: formatCurrency(quotaData.team_actual || 0, true) },
                  { label: 'Attainment', value: `${quotaData.team_attainment_pct || 0}%` },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-2xl font-bold font-display text-[#1a1d2e]">{m.value}</div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Quota vs Actual by BD Member · {quotaData.period}</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quotaData.members || []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), '']} />
                      <Bar dataKey="quota" name="Quota" fill="#e6eaf5" stroke="#c8cfe8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {(quotaData.members || []).map((member: any, i: number) => (
                  <Card key={member.name || i} className="p-4">
                    <div className="text-xs font-bold text-[#1a1d2e] mb-2">{member.name}</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Actual</span><span className="font-medium text-[#4a5068]">{formatCurrency(member.actual || 0, true)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Quota</span><span className="font-medium text-[#4a5068]">{formatCurrency(member.quota || 0, true)}</span></div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-[#8b90a8]">Attainment</span>
                        <Badge variant={member.attainment_pct >= 80 ? 'success' : member.attainment_pct >= 30 ? 'warning' : 'danger'} size="sm">{member.attainment_pct?.toFixed(1) || 0}%</Badge>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-[#8b90a8]">Status</span>
                        <Badge variant={member.status === 'Exceeded' ? 'success' : member.status === 'On Track' ? 'warning' : 'danger'} size="sm">{member.status}</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ── Win/Loss Tab ── */}
          {!loading && !error && tab === 'Win/Loss' && winRateData && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Overall Win Rate</div>
                  <div className="text-2xl font-bold font-display text-[#1a1d2e]">{winRateData.overall_win_rate || 0}%</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Period</div>
                  <div className="text-2xl font-bold font-display text-[#1a1d2e]">{winRateData.period}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Sources</div>
                  <div className="text-2xl font-bold font-display text-[#1a1d2e]">{(winRateData.by_lead_source || []).length}</div>
                </Card>
              </div>

              {/* Service & Industry Pie Charts (NEW) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Service Win/Loss Distribution Pie */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Status by Service</div>
                  {(winRateData.by_service || []).length > 0 ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(winRateData.by_service || []).map((s: any) => ({ name: s.service, value: s.won + s.lost }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={renderPieLabel}
                              labelLine={false}
                            >
                              {(winRateData.by_service || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TT} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2">
                        {(winRateData.by_service || []).map((s: any, i: number) => (
                          <div key={s.service} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-[10px] text-[#4a5068]">{s.service}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#10b981]">{s.won}W</span>
                              <span className="text-[10px] text-[#e11d48]">{s.lost}L</span>
                              <Badge variant={s.win_rate > 50 ? 'success' : 'warning'} size="sm">{s.win_rate}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-52 text-xs text-[#8b90a8]">No data</div>
                  )}
                </Card>

                {/* Account/Industry Win/Loss Distribution Pie */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Status by Industry</div>
                  {(winRateData.by_industry || []).length > 0 ? (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(winRateData.by_industry || []).map((s: any) => ({ name: s.industry, value: s.won + s.lost }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={renderPieLabel}
                              labelLine={false}
                            >
                              {(winRateData.by_industry || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TT} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2">
                        {(winRateData.by_industry || []).map((s: any, i: number) => (
                          <div key={s.industry} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-[10px] text-[#4a5068]">{s.industry}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#10b981]">{s.won}W</span>
                              <span className="text-[10px] text-[#e11d48]">{s.lost}L</span>
                              <Badge variant={s.win_rate > 50 ? 'success' : 'warning'} size="sm">{s.win_rate}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-52 text-xs text-[#8b90a8]">No data</div>
                  )}
                </Card>
              </div>

              {/* Existing breakdown lists */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* By Lead Source */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">By Lead Source</div>
                  <div className="flex flex-col gap-2">
                    {(winRateData.by_lead_source || []).map((item: any, i: number) => (
                      <div key={item.source} className="flex items-center justify-between gap-2 py-2 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{item.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8b90a8]">{item.won + item.lost} deals</span>
                          <Badge variant={item.win_rate > 50 ? 'success' : item.win_rate > 0 ? 'warning' : 'neutral'} size="sm">{item.win_rate}%</Badge>
                        </div>
                      </div>
                    ))}
                    {(winRateData.by_lead_source || []).length === 0 && (
                      <div className="text-center py-4 text-xs text-[#8b90a8]">No data</div>
                    )}
                  </div>
                </Card>

                {/* By Service */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">By Service</div>
                  <div className="flex flex-col gap-2">
                    {(winRateData.by_service || []).map((item: any, i: number) => (
                      <div key={item.service} className="flex items-center justify-between gap-2 py-2 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{item.service}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8b90a8]">{item.won}/{item.won + item.lost}</span>
                          <Badge variant={item.win_rate > 50 ? 'success' : item.win_rate > 0 ? 'warning' : 'neutral'} size="sm">{item.win_rate}%</Badge>
                        </div>
                      </div>
                    ))}
                    {(winRateData.by_service || []).length === 0 && (
                      <div className="text-center py-4 text-xs text-[#8b90a8]">No data</div>
                    )}
                  </div>
                </Card>

                {/* By Industry */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">By Industry</div>
                  <div className="flex flex-col gap-2">
                    {(winRateData.by_industry || []).map((item: any, i: number) => (
                      <div key={item.industry} className="flex items-center justify-between gap-2 py-2 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{item.industry}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#8b90a8]">{item.won}/{item.won + item.lost}</span>
                          <Badge variant={item.win_rate > 50 ? 'success' : item.win_rate > 0 ? 'warning' : 'neutral'} size="sm">{item.win_rate}%</Badge>
                        </div>
                      </div>
                    ))}
                    {(winRateData.by_industry || []).length === 0 && (
                      <div className="text-center py-4 text-xs text-[#8b90a8]">No data</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── Sales Cycle Tab ── */}
          {!loading && !error && tab === 'Sales Cycle' && salesCycleData && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Avg. Days per Stage</div>
                <div className="h-64">
                  {(salesCycleData.by_stage || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesCycleData.by_stage} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
                        <YAxis type="category" dataKey="stage_name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} formatter={(val: number) => [`${Number(val).toFixed(1)} days`, 'Avg. Duration']} />
                        <Bar dataKey="avg_days" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-[#8b90a8]">No sales cycle data available</div>
                  )}
                </div>
              </Card>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Avg. Sales Cycle', value: salesCycleData.avg_total_cycle_days ? `${Number(salesCycleData.avg_total_cycle_days).toFixed(0)} days` : 'N/A', sub: 'closed deals' },
                  { label: 'Longest Cycle', value: salesCycleData.max_cycle_days ? `${salesCycleData.max_cycle_days} days` : 'N/A', sub: 'single deal' },
                  { label: 'Sample Size', value: String(salesCycleData.sample_size || 0), sub: 'completed deals' },
                ].map(m => (
                  <Card key={m.label} className="p-4">
                    <div className="text-xs text-[#8b90a8] mb-1">{m.label}</div>
                    <div className="text-lg font-bold font-display text-[#1a1d2e]">{m.value}</div>
                    <div className="text-xs text-[#8b90a8] mt-0.5">{m.sub}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ── Loss Analysis Tab ── */}
          {!loading && !error && tab === 'Loss Analysis' && lossData && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Total Lost Deals</div>
                  <div className="text-2xl font-bold font-display text-[#e11d48]">{lossData.total_lost_deals || 0}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Total Lost Value</div>
                  <div className="text-2xl font-bold font-display text-[#e11d48]">{formatCurrency(lossData.total_lost_value || 0, true)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Period</div>
                  <div className="text-2xl font-bold font-display text-[#1a1d2e]">{lossData.period}</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Losses by Stage</div>
                  {(lossData.by_stage || []).length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={lossData.by_stage} dataKey="lost_count" nameKey="lost_from_stage" cx="50%" cy="50%" outerRadius={90} label={renderPieLabel} labelLine={false}>
                            {(lossData.by_stage || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip {...TT} formatter={(val: number, name: string) => [val, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-xs text-[#8b90a8]">No lost deals this quarter</div>
                  )}
                  <div className="flex flex-col gap-2 mt-3">
                    {(lossData.by_stage || []).map((s: any, i: number) => (
                      <div key={s.lost_from_stage || i} className="flex items-center justify-between py-1.5 border-b border-[#f0f2f8]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-[#4a5068]">{s.lost_from_stage || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#8b90a8]">{s.lost_count} deals</span>
                          <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(s.lost_value || 0, true)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Lost Deals</div>
                  <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto">
                    {(lossData.deals || []).length > 0 ? (lossData.deals || []).map((deal: any) => (
                      <div key={deal.deal_id} className="p-3 bg-[#f4f6fb] rounded-xl border border-[#e2e6f0]">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[#1a1d2e] truncate">{deal.deal_name}</div>
                            <div className="text-[10px] text-[#8b90a8]">{deal.bd_name} · Lost from {deal.lost_from_stage || 'Unknown'}</div>
                          </div>
                          <span className="text-xs font-bold text-[#e11d48] flex-shrink-0">{formatCurrency(deal.final_proposed_value || 0, true)}</span>
                        </div>
                        {deal.last_remarks && (
                          <div className="text-[10px] text-[#8b90a8] mt-1 italic line-clamp-2">{deal.last_remarks}</div>
                        )}
                      </div>
                    )) : (
                      <div className="text-center py-8 text-xs text-[#8b90a8]">No lost deals this quarter</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── Executive Report Tab ── */}
          {!loading && !error && tab === 'Executive' && execData && (
            <div className="flex flex-col gap-4">
              {/* Team KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Team Revenue</div>
                  <div className="text-2xl font-bold font-display text-[#10b981]">{formatCurrency(execData.team?.total_revenue || 0, true)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Team Quota</div>
                  <div className="text-2xl font-bold font-display text-[#4f6ef7]">{formatCurrency(execData.team?.total_quota || 0, true)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Sales Forecast</div>
                  <div className="text-2xl font-bold font-display text-[#8b5cf6]">{formatCurrency(execData.team?.sales_forecast || 0, true)}</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-xs text-[#8b90a8] mb-1">Attainment</div>
                  <div className="text-2xl font-bold font-display text-[#f59e0b]">{execData.team?.attainment_pct || 0}%</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pipeline by stage */}
                <Card className="p-5 lg:col-span-2">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Team Pipeline by Stage</div>
                  <div className="h-64">
                    {(execData.pipeline_by_stage || []).filter((s: any) => !['Closed Won', 'Closed Lost'].includes(s.stage_name)).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(execData.pipeline_by_stage || []).filter((s: any) => !['Closed Won', 'Closed Lost'].includes(s.stage_name))}
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                            tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                          <YAxis type="category" dataKey="stage_name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                          <Tooltip {...TT} formatter={(val: number) => [formatCurrency(val), 'Value']} />
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
                    <Badge variant="warning" size="sm">{(execData.stuck_deals || []).length}</Badge>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[230px] overflow-y-auto">
                    {(execData.stuck_deals || []).map((deal: any) => (
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
                    {(execData.stuck_deals || []).length === 0 && (
                      <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals</div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Leaderboard */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={14} className="text-[#d97706]" />
                  <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · Q{selectedQuarter} {selectedYear}</span>
                </div>
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
                    <div className="col-span-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">#</div>
                    <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Member</div>
                    <div className="col-span-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">Revenue</div>
                    <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Attainment</div>
                    <div className="col-span-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">Win Rate</div>
                    <div className="col-span-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">Rank</div>
                  </div>

                  {(execData.leaderboard || []).map((entry: any, index: number) => {
                    const rankColors = ['#f59e0b', '#8b90a8', '#cd7f32'];
                    const attPct = entry.attainment_pct || 0;
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
                        <div className="col-span-2 flex items-center">
                          <span className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(entry.revenue || 0, true)}</span>
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
                          <Badge variant={entry.win_rate && entry.win_rate > 50 ? 'success' : 'neutral'} size="sm">
                            {entry.win_rate || 0}%
                          </Badge>
                        </div>
                        <div className="col-span-1 flex items-center">
                          <span className="text-xs font-medium text-[#8b90a8]">#{entry.rank || index + 1}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By Account Type */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue by Account Type</div>
                  {(execData.by_account_type || []).length > 0 ? (
                    <>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={execData.by_account_type} dataKey="revenue" nameKey="account_type" cx="50%" cy="50%" outerRadius={70} label={renderPieLabel} labelLine={false}>
                              {(execData.by_account_type || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TT} formatter={(val: number, name: string) => [formatCurrency(val), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2 mt-2">
                        {(execData.by_account_type || []).map((item: any, i: number) => (
                          <div key={item.account_type} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#f0f2f8]">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-xs text-[#4a5068]">{item.account_type}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue || 0, true)}</span>
                              <Badge variant="neutral" size="sm">{item.deal_count} deals</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-xs text-[#8b90a8]">No data this quarter</div>
                  )}
                </Card>

                {/* By Service */}
                <Card className="p-5">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue by Service</div>
                  {(execData.by_service || []).length > 0 ? (
                    <>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={execData.by_service} dataKey="revenue" nameKey="service_name" cx="50%" cy="50%" outerRadius={70} label={renderPieLabel} labelLine={false}>
                              {(execData.by_service || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TT} formatter={(val: number, name: string) => [formatCurrency(val), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2 mt-2">
                        {(execData.by_service || []).map((item: any, i: number) => (
                          <div key={item.service_name} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#f0f2f8]">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-xs text-[#4a5068]">{item.service_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue || 0, true)}</span>
                              <Badge variant="neutral" size="sm">{item.deal_count} deals</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-xs text-[#8b90a8]">No data this quarter</div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !data && (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm text-[#8b90a8]">No data loaded yet</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
