import { useState } from 'react';
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
import { useReportData, useBDList } from '../hooks/useReports';
import { useCreateGrowthEntry, useGrowthEntries, useReportingPeriods } from '../hooks/useReporting';
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
  const [growthQuarter, setGrowthQuarter] = useState<number | null>(null);
  const [compareYear, setCompareYear] = useState(currentYear - 1);
  const [compareQuarter, setCompareQuarter] = useState<number | null>(null);
  const [compareFilter, setCompareFilter] = useState('');
  const [growthForm, setGrowthForm] = useState({
    label: '',
    year: currentYear,
    quarter: '',
    revenue: '',
    notes: '',
  });

  const { data: reportingPeriods } = useReportingPeriods();
  const { data: bdList = [] } = useBDList();
  const availableYears = reportingPeriods?.years ?? [currentYear];
  const { data, isLoading: loading, error: queryError, refetch } = useReportData(tab, selectedYear, selectedQuarter, selectedBD);
  const { data: growthData, isLoading: growthLoading, error: growthError } = useGrowthEntries({
    year: selectedYear,
    quarter: growthQuarter,
    compareYear,
    compareQuarter,
  });
  const createGrowthEntry = useCreateGrowthEntry();

  const error = queryError ? (queryError as any).response?.data?.detail || (queryError as any).response?.data?.error || (queryError as Error).message || `Failed to load ${tab} report` : null;
  const growthTableError = growthError
    ? (growthError as any).response?.data?.error || (growthError as Error).message || 'Failed to load growth table'
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
                setGrowthForm(prev => ({ ...prev, year }));
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-5 lg:col-span-1">
                  <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Add Growth Data</div>
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createGrowthEntry.mutate({
                        label: growthForm.label.trim(),
                        year: growthForm.year,
                        quarter: growthForm.quarter ? parseInt(growthForm.quarter, 10) : null,
                        revenue: Number(growthForm.revenue),
                        notes: growthForm.notes.trim() || undefined,
                      }, {
                        onSuccess: () => {
                          setGrowthForm((prev) => ({ ...prev, label: '', quarter: '', revenue: '', notes: '' }));
                        },
                      });
                    }}
                  >
                    <input
                      value={growthForm.label}
                      onChange={(e) => setGrowthForm(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="Data label (e.g. Team Revenue)"
                      className="px-3 py-2 text-sm border border-[#e2e6f0] rounded-lg"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={growthForm.year}
                        onChange={(e) => setGrowthForm(prev => ({ ...prev, year: parseInt(e.target.value, 10) }))}
                        className="px-3 py-2 text-sm border border-[#e2e6f0] rounded-lg bg-white"
                      >
                        {availableYears.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <select
                        value={growthForm.quarter}
                        onChange={(e) => setGrowthForm(prev => ({ ...prev, quarter: e.target.value }))}
                        className="px-3 py-2 text-sm border border-[#e2e6f0] rounded-lg bg-white"
                      >
                        <option value="">All Quarters</option>
                        {[1, 2, 3, 4].map((quarter) => (
                          <option key={quarter} value={quarter}>{`Q${quarter}`}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={growthForm.revenue}
                      onChange={(e) => setGrowthForm(prev => ({ ...prev, revenue: e.target.value }))}
                      placeholder="Revenue"
                      className="px-3 py-2 text-sm border border-[#e2e6f0] rounded-lg"
                      required
                    />
                    <textarea
                      value={growthForm.notes}
                      onChange={(e) => setGrowthForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      rows={3}
                      className="px-3 py-2 text-sm border border-[#e2e6f0] rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={createGrowthEntry.isPending}
                      className="px-4 py-2 text-sm font-medium bg-[#3d5af1] text-white rounded-lg hover:bg-[#2d4ad1] transition-colors disabled:opacity-60"
                    >
                      {createGrowthEntry.isPending ? 'Saving...' : 'Add Row'}
                    </button>
                  </form>
                </Card>

                <Card className="p-5 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div>
                      <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Growth Comparison</div>
                      <div className="text-xs text-[#8b90a8] mt-1">Side-by-side revenue sandbox by year and optional quarter.</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={growthQuarter ?? ''}
                        onChange={(e) => setGrowthQuarter(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white"
                      >
                        <option value="">All Quarters</option>
                        {[1, 2, 3, 4].map((quarter) => (
                          <option key={quarter} value={quarter}>{`Q${quarter}`}</option>
                        ))}
                      </select>
                      <select
                        value={compareYear}
                        onChange={(e) => setCompareYear(parseInt(e.target.value, 10))}
                        className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white"
                      >
                        {availableYears.map((year) => (
                          <option key={year} value={year}>{`Compare to ${year}`}</option>
                        ))}
                      </select>
                      <select
                        value={compareQuarter ?? ''}
                        onChange={(e) => setCompareQuarter(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white"
                      >
                        <option value="">All Quarters</option>
                        {[1, 2, 3, 4].map((quarter) => (
                          <option key={quarter} value={quarter}>{`Q${quarter}`}</option>
                        ))}
                      </select>
                      <input
                        value={compareFilter}
                        onChange={(e) => setCompareFilter(e.target.value)}
                        placeholder="Filter labels"
                        className="px-3 py-1.5 text-xs border border-[#e2e6f0] rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  {growthLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-[#8b90a8]">
                      <Loader2 size={18} className="animate-spin mr-2" />
                      Loading growth table...
                    </div>
                  ) : growthTableError ? (
                    <div className="text-center py-10 text-sm text-[#8b90a8]">{growthTableError}</div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {(growthData?.comparison ?? [])
                        .filter(item => item.label.toLowerCase().includes(compareFilter.toLowerCase()))
                        .map((item) => (
                          <div key={item.label} className="rounded-xl border border-[#e2e6f0] p-4 bg-[#fafbfd]">
                            <div className="text-sm font-semibold text-[#1a1d2e] mb-3">{item.label}</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg bg-white border border-[#e2e6f0] p-3">
                                <div className="text-[10px] uppercase tracking-wider text-[#8b90a8] mb-1">
                                  {`${selectedYear}${growthQuarter ? ` · Q${growthQuarter}` : ''}`}
                                </div>
                                <div className="text-lg font-bold font-display text-[#1a1d2e]">{formatCurrency(item.leftRevenue, true)}</div>
                              </div>
                              <div className="rounded-lg bg-white border border-[#e2e6f0] p-3">
                                <div className="text-[10px] uppercase tracking-wider text-[#8b90a8] mb-1">
                                  {`${compareYear}${compareQuarter ? ` · Q${compareQuarter}` : ''}`}
                                </div>
                                <div className="text-lg font-bold font-display text-[#1a1d2e]">{formatCurrency(item.rightRevenue, true)}</div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="text-[#8b90a8]">Delta</span>
                              <span className={cn('font-semibold', item.delta >= 0 ? 'text-[#10b981]' : 'text-[#e11d48]')}>
                                {`${item.delta >= 0 ? '+' : ''}${formatCurrency(item.delta, true)}`}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span className="text-[#8b90a8]">Growth</span>
                              <span className={cn('font-semibold', (item.growthPct ?? 0) >= 0 ? 'text-[#10b981]' : 'text-[#e11d48]')}>
                                {item.growthPct === null ? 'N/A' : `${item.growthPct >= 0 ? '+' : ''}${item.growthPct.toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        ))}
                      {(growthData?.comparison ?? []).filter(item => item.label.toLowerCase().includes(compareFilter.toLowerCase())).length === 0 && (
                        <div className="xl:col-span-2 text-center py-16 text-sm text-[#8b90a8]">
                          No growth rows match the current filters.
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>

              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Saved Growth Rows</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-[#8b90a8] border-b border-[#e2e6f0]">
                        <th className="py-2 pr-4">Label</th>
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2 pr-4">Revenue</th>
                        <th className="py-2 pr-4">Owner</th>
                        <th className="py-2 pr-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(growthData?.entries ?? []).map((entry) => (
                        <tr key={entry.id} className="border-b border-[#f0f2f8]">
                          <td className="py-3 pr-4 font-medium text-[#1a1d2e]">{entry.label}</td>
                          <td className="py-3 pr-4 text-[#4a5068]">{`${entry.year}${entry.quarter ? ` · Q${entry.quarter}` : ''}`}</td>
                          <td className="py-3 pr-4 text-[#1a1d2e] font-semibold">{formatCurrency(entry.revenue, true)}</td>
                          <td className="py-3 pr-4 text-[#4a5068]">{`${entry.owner.firstName} ${entry.owner.lastName}`}</td>
                          <td className="py-3 pr-4 text-[#8b90a8]">{entry.notes || '—'}</td>
                        </tr>
                      ))}
                      {(growthData?.entries ?? []).length === 0 && (
                        <tr>
                          <td className="py-8 text-center text-[#8b90a8]" colSpan={5}>No rows saved for this year filter yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
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
