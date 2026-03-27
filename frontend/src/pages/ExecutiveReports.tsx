import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Plus, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge } from '../components/ui/index';
import { reportsAnalyticsApi } from '../api/analyticsClient';
import { formatCurrency, cn } from '../lib/utils';

const PALETTE = ['#4f6ef7', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];
const TABS = ['Pipeline', 'Quota Performance', 'Win/Loss', 'Sales Cycle', 'Service Performance', 'Growth'];

const TT_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12, color: '#1a1d2e' },
  itemStyle: { color: '#4a5068' },
  labelStyle: { color: '#1a1d2e', fontWeight: 600 },
};

function pesoTick(v: number) { return `₱${(v / 1_000_000).toFixed(1)}M`; }
function pesoFmt(v: number) { return formatCurrency(v, true); }

const PIPELINE_STAGE_ORDER = ['Inquiry', 'Prospecting', 'Discovery', 'Proposal Sent', 'Negotiation'];
const STAGE_COLORS: Record<string, string> = {
  Inquiry: '#6b7280', Prospecting: '#4f6ef7', Discovery: '#10b981',
  'Proposal Sent': '#8b5cf6', Negotiation: '#f59e0b',
};

function getCurrentQY() {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth() + 1) / 3) };
}

// ── Shared filter bar (year + quarter only — BD is page-level) ─────────────

interface PeriodFiltersProps {
  year: number; setYear: (y: number) => void;
  quarter: number; setQuarter: (q: number) => void;
}
function PeriodFilters({ year, setYear, quarter, setQuarter }: PeriodFiltersProps) {
  const years = [2026, 2025, 2024];
  return (
    <div className="flex items-center gap-3 flex-wrap mb-5">
      <div className="flex gap-1">
        {years.map(y => (
          <button key={y} onClick={() => setYear(y)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
              year === y ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]' : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]')}>
            {y}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(q => (
          <button key={q} onClick={() => setQuarter(q)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
              quarter === q ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]' : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]')}>
            Q{q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline Tab ────────────────────────────────────────────────────────────

function PipelineTab({ bdId, bds }: { bdId: string; bds: { id: string; full_name: string }[] }) {
  const { year: cy, quarter: cq } = getCurrentQY();
  const [year, setYear] = useState(cy);
  const [quarter, setQuarter] = useState(cq);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  // Reset stage filter when period/BD changes so stale selection doesn't confuse
  const prevKey = useRef(`${year}-${quarter}-${bdId}`);
  useEffect(() => {
    const key = `${year}-${quarter}-${bdId}`;
    if (key !== prevKey.current) { setActiveStage(null); prevKey.current = key; }
  }, [year, quarter, bdId]);

  const { data, isFetching } = useQuery({
    queryKey: ['exec-report-pipeline', year, quarter, bdId],
    queryFn: () => reportsAnalyticsApi.pipeline({ year, quarter, bd_id: bdId || undefined }).then(r => r.data),
  });

  const stageTotals = data?.stage_totals ?? [];
  const selectedStages = activeStage ? [activeStage] : PIPELINE_STAGE_ORDER;

  // Stacked bar: x = stage, stacks = services
  // Shape: [{ stage_name, SHAREDVIEW: 123, MEDIAWATCH: 456, … }]
  const allServiceNames = useMemo(() => {
    const names = new Set<string>();
    (data?.by_service ?? []).forEach(r => names.add(r.service_name));
    return Array.from(names).sort();
  }, [data?.by_service]);

  const serviceStackData = useMemo(() => {
    return PIPELINE_STAGE_ORDER.map(stage => {
      const row: Record<string, any> = { stage_name: stage };
      allServiceNames.forEach(svc => { row[svc] = 0; });
      (data?.by_service ?? [])
        .filter(r => r.stage_name === stage)
        .forEach(r => { row[r.service_name] = (row[r.service_name] ?? 0) + r.total_value; });
      return row;
    });
  }, [data?.by_service, allServiceNames]);

  // Stacked bar: x = stage, stacks = account types
  const allAccountTypes = useMemo(() => {
    const types = new Set<string>();
    (data?.by_account_type ?? []).forEach(r => types.add(r.account_type));
    return Array.from(types).sort();
  }, [data?.by_account_type]);

  const accountTypeStackData = useMemo(() => {
    return PIPELINE_STAGE_ORDER.map(stage => {
      const row: Record<string, any> = { stage_name: stage };
      allAccountTypes.forEach(t => { row[t] = 0; });
      (data?.by_account_type ?? [])
        .filter(r => r.stage_name === stage)
        .forEach(r => { row[r.account_type] = (row[r.account_type] ?? 0) + r.total_value; });
      return row;
    });
  }, [data?.by_account_type, allAccountTypes]);

  // Contributor bar
  const filteredByBd = (data?.by_bd ?? [])
    .filter(r => selectedStages.includes(r.stage_name))
    .reduce<Record<string, { name: string; value: number; deals: number }>>((acc, r) => {
      if (!acc[r.bd_id]) acc[r.bd_id] = { name: r.bd_name, value: 0, deals: 0 };
      acc[r.bd_id].value += r.total_value;
      acc[r.bd_id].deals += r.deal_count;
      return acc;
    }, {});
  const bdContributors = Object.values(filteredByBd).sort((a, b) => b.value - a.value);

  const leadSource = data?.lead_source ?? [];

  const totalFiltered = selectedStages.reduce((sum, s) => {
    const row = stageTotals.find(t => t.stage_name === s);
    return sum + (row?.total_value ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilters year={year} setYear={setYear} quarter={quarter} setQuarter={setQuarter} />

      {/* Stage filter pills */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-[#8b90a8] font-medium">Filter stage:</span>
        <button
          onClick={() => setActiveStage(null)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full border transition-all',
            activeStage === null
              ? 'bg-[#1a1d2e] border-[#1a1d2e] text-white'
              : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]',
          )}>
          All stages
        </button>
        {PIPELINE_STAGE_ORDER.map(s => {
          const row = stageTotals.find(t => t.stage_name === s);
          const active = activeStage === s;
          return (
            <button
              key={s}
              onClick={() => setActiveStage(active ? null : s)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5',
                active ? 'text-white border-transparent' : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]',
              )}
              style={active ? { background: STAGE_COLORS[s] } : {}}>
              <span style={{ color: active ? '#fff' : STAGE_COLORS[s] }}>●</span>
              {s}
              {/* Always show count + value badge even when zero */}
              <span
                className={cn('text-[10px] px-1.5 py-0.5 rounded-full', active ? 'bg-white/20' : 'bg-[#f0f2f8]')}
                style={{ color: active ? '#fff' : STAGE_COLORS[s] }}>
                {row ? row.deal_count : 0} · {formatCurrency(row?.total_value ?? 0, true)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Total amount */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[#1a1d2e]">
          {activeStage ?? 'Total pipeline'}:
        </span>
        <span className="text-sm font-bold text-[#4f6ef7]">{formatCurrency(totalFiltered)}</span>
        {isFetching && <span className="text-[10px] text-[#8b90a8]">updating…</span>}
      </div>

      {/* Charts 2×2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Services in pipeline — stacked bar by stage */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">
              Services in Pipeline
            </div>
            {allServiceNames.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {allServiceNames.map((svc, i) => (
                  <div key={svc} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-[11px] text-[#4a5068]">{svc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {allServiceNames.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceStackData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                  <XAxis dataKey="stage_name" tick={{ fill: '#8b90a8', fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b90a8', fontSize: 11 }}
                    axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                  <Tooltip
                    {...TT_STYLE}
                    cursor={{ fill: '#f4f6fb' }}
                    formatter={(v: number, name: string) => v > 0 ? [pesoFmt(v), name] : null}
                  />
                  {allServiceNames.map((svc, i) => (
                    <Bar key={svc} dataKey={svc} stackId="svc"
                      fill={PALETTE[i % PALETTE.length]}
                      radius={i === allServiceNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-[#8b90a8]">
              No open deals for this period
            </div>
          )}
        </Card>

        {/* Account type in pipeline — stacked bar by stage */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">
              Account Type in Pipeline
            </div>
            {allAccountTypes.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {allAccountTypes.map((t, i) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-[11px] text-[#4a5068]">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {allAccountTypes.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountTypeStackData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                  <XAxis dataKey="stage_name" tick={{ fill: '#8b90a8', fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b90a8', fontSize: 11 }}
                    axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                  <Tooltip
                    {...TT_STYLE}
                    cursor={{ fill: '#f4f6fb' }}
                    formatter={(v: number, name: string) => v > 0 ? [pesoFmt(v), name] : null}
                  />
                  {allAccountTypes.map((t, i) => (
                    <Bar key={t} dataKey={t} stackId="acct"
                      fill={PALETTE[i % PALETTE.length]}
                      radius={i === allAccountTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-[#8b90a8]">
              No open deals for this period
            </div>
          )}
        </Card>

        {/* Contributor in pipeline */}
        <Card className="p-5">
          <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
            Contributor in Pipeline
          </div>
          {bdContributors.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bdContributors} layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8b90a8', fontSize: 10 }}
                      axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#4a5068', fontSize: 11 }}
                      axisLine={false} tickLine={false} width={80} />
                    <Tooltip {...TT_STYLE} formatter={(v: number) => [pesoFmt(v), 'Pipeline']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {bdContributors.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 pt-3 border-t border-[#f0f2f8] flex flex-col gap-1.5">
                {bdContributors.map((b, i) => (
                  <div key={b.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full"
                        style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-[#4a5068]">{b.name}</span>
                      <span className="text-[#8b90a8]">{b.deals} deal{b.deals !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="font-semibold text-[#1a1d2e]">{pesoFmt(b.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-[#8b90a8]">
              No data for this period
            </div>
          )}
        </Card>

        {/* Lead source */}
        <Card className="p-5">
          <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">
            Lead Source Analytics
          </div>
          {leadSource.length > 0 ? (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leadSource} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                    <XAxis dataKey="lead_source" tick={{ fill: '#8b90a8', fontSize: 11 }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#8b90a8', fontSize: 11 }}
                      axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                    <Tooltip {...TT_STYLE} formatter={(v: number) => [pesoFmt(v), 'Pipeline Value']} />
                    <Bar dataKey="total_value" radius={[4, 4, 0, 0]}>
                      {leadSource.map((_: any, i: number) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 pt-3 border-t border-[#f0f2f8] flex flex-col gap-1.5">
                {leadSource.map((s: any, i: number) => (
                  <div key={s.lead_source} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full"
                        style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-[#4a5068]">{s.lead_source}</span>
                      <span className="text-[#8b90a8]">{s.deal_count} deals</span>
                    </div>
                    <span className="font-semibold text-[#1a1d2e]">{pesoFmt(s.total_value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-36 flex items-center justify-center text-xs text-[#8b90a8]">
              No data for this period
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

// ── Growth Tab ──────────────────────────────────────────────────────────────
// Each series is fully independent: its own year, granularity, and BD.
// useQuery is NOT called inside .map() — each series is a separate child
// component (GrowthSeriesRow) so hooks rules are respected.

interface GrowthSeriesCfg {
  id: number;
  year: number;
  granularity: 'month' | 'quarter' | 'year';
  bdId: string;
  color: string;
}

interface GrowthSeriesRowProps {
  cfg: GrowthSeriesCfg;
  idx: number;
  bds: { id: string; full_name: string }[];
  canRemove: boolean;
  onUpdate: (id: number, patch: Partial<GrowthSeriesCfg>) => void;
  onRemove: (id: number) => void;
  onData: (id: number, data: { period_label: string; period_order: number; revenue: number }[]) => void;
}

function GrowthSeriesRow({ cfg, idx, bds, canRemove, onUpdate, onRemove, onData }: GrowthSeriesRowProps) {
  const years = [2026, 2025, 2024, 2023];

  const { data } = useQuery({
    queryKey: ['growth', cfg.id, cfg.year, cfg.granularity, cfg.bdId],
    queryFn: () =>
      reportsAnalyticsApi
        .growth({ year: cfg.year, granularity: cfg.granularity, bd_id: cfg.bdId || undefined })
        .then(r => r.data),
  });

  // Bubble data up so the parent can build the merged chart dataset
  useEffect(() => {
    if (data?.series) onData(cfg.id, data.series);
  }, [data]);

  const bdName = cfg.bdId ? (bds.find(b => b.id === cfg.bdId)?.full_name ?? 'BD') : 'All BDs';
  const label = `${bdName} · ${cfg.year} · ${cfg.granularity.charAt(0).toUpperCase() + cfg.granularity.slice(1)}`;

  return (
    <div className="flex items-center gap-3 flex-wrap bg-white border border-[#e2e6f0] rounded-xl px-4 py-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      <span className="text-xs font-medium text-[#4a5068] w-16">Series {idx + 1}</span>

      {/* Year */}
      <div className="flex gap-1">
        {years.map(y => (
          <button key={y} onClick={() => onUpdate(cfg.id, { year: y })}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-lg border transition-all',
              cfg.year === y
                ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]',
            )}>
            {y}
          </button>
        ))}
      </div>

      {/* Granularity */}
      <div className="flex gap-1">
        {(['month', 'quarter', 'year'] as const).map(g => (
          <button key={g} onClick={() => onUpdate(cfg.id, { granularity: g })}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-lg border transition-all capitalize',
              cfg.granularity === g
                ? 'bg-[#eef1fe] border-[#a5b4fc] text-[#3d5af1]'
                : 'bg-transparent border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]',
            )}>
            {g}
          </button>
        ))}
      </div>

      {/* BD filter */}
      <select
        value={cfg.bdId}
        onChange={e => onUpdate(cfg.id, { bdId: e.target.value })}
        className="h-7 px-2 text-xs bg-white border border-[#e2e6f0] rounded-lg text-[#4a5068] focus:outline-none focus:border-[#4f6ef7]">
        <option value="">All BDs</option>
        {bds.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
      </select>

      <span className="text-[10px] text-[#8b90a8] ml-auto">{label}</span>

      {canRemove && (
        <button onClick={() => onRemove(cfg.id)}
          className="text-[#8b90a8] hover:text-[#e11d48] transition-colors ml-1">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

const DEFAULT_YEAR = getCurrentQY().year;
let _nextId = 2;

function GrowthTab({ bds }: { bds: { id: string; full_name: string }[] }) {
  const [series, setSeries] = useState<GrowthSeriesCfg[]>([
    { id: 1, year: DEFAULT_YEAR, granularity: 'quarter', bdId: '', color: PALETTE[0] },
  ]);

  // seriesData: id → resolved API rows
  const [seriesData, setSeriesData] = useState<
    Record<number, { period_label: string; period_order: number; revenue: number }[]>
  >({});

  function handleData(
    id: number,
    rows: { period_label: string; period_order: number; revenue: number }[],
  ) {
    setSeriesData(prev => ({ ...prev, [id]: rows }));
  }

  function addSeries() {
    const id = _nextId++;
    setSeries(prev => [
      ...prev,
      { id, year: DEFAULT_YEAR, granularity: 'quarter', bdId: '', color: PALETTE[prev.length % PALETTE.length] },
    ]);
  }

  function updateSeries(id: number, patch: Partial<GrowthSeriesCfg>) {
    setSeries(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function removeSeries(id: number) {
    setSeries(prev => prev.filter(s => s.id !== id));
    setSeriesData(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  // Merge all series into one chartData array keyed by period_label
  const chartData = useMemo(() => {
    const allPeriods = new Map<string, number>(); // label → period_order
    series.forEach(s => {
      (seriesData[s.id] ?? []).forEach(p => {
        if (!allPeriods.has(p.period_label)) allPeriods.set(p.period_label, p.period_order);
      });
    });
    return Array.from(allPeriods.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([period]) => {
        const row: Record<string, any> = { period };
        series.forEach(s => {
          const found = (seriesData[s.id] ?? []).find(p => p.period_label === period);
          row[`s${s.id}`] = found?.revenue ?? 0;
        });
        return row;
      });
  }, [series, seriesData]);

  return (
    <div className="flex flex-col gap-4">

      {/* Series config rows */}
      <div className="flex flex-col gap-3">
        {series.map((s, idx) => (
          <GrowthSeriesRow
            key={s.id}
            cfg={s}
            idx={idx}
            bds={bds}
            canRemove={series.length > 1}
            onUpdate={updateSeries}
            onRemove={removeSeries}
            onData={handleData}
          />
        ))}
        {series.length < 4 && (
          <button
            onClick={addSeries}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#4f6ef7] border border-dashed border-[#a5b4fc] rounded-xl hover:bg-[#eef1fe] transition-all w-fit">
            <Plus size={13} /> Add comparison series
          </button>
        )}
      </div>

      {/* Comparison line chart */}
      <Card className="p-5">
        <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-1">
          Revenue Growth Comparison
        </div>
        <div className="flex gap-4 mb-4 flex-wrap">
          {series.map(s => {
            const bdName = s.bdId ? (bds.find(b => b.id === s.bdId)?.full_name ?? 'BD') : 'All BDs';
            const label = `${bdName} · ${s.year} · ${s.granularity.charAt(0).toUpperCase() + s.granularity.slice(1)}`;
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className="w-8 h-0.5" style={{ background: s.color }} />
                <span className="text-[10px] text-[#8b90a8]">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 16, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
              <XAxis dataKey="period" tick={{ fill: '#8b90a8', fontSize: 10 }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false} tickLine={false} tickFormatter={pesoTick} />
              <Tooltip
                {...TT_STYLE}
                formatter={(v: number, k: string) => {
                  const s = series.find(s => `s${s.id}` === k);
                  if (!s) return [pesoFmt(v), k];
                  const bdName = s.bdId ? (bds.find(b => b.id === s.bdId)?.full_name ?? 'BD') : 'All BDs';
                  return [pesoFmt(v), `${bdName} · ${s.year} · ${s.granularity}`];
                }}
              />
              {series.map(s => (
                <Line key={s.id} type="monotone" dataKey={`s${s.id}`}
                  stroke={s.color} strokeWidth={2}
                  dot={{ r: 3, fill: s.color }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-series summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {series.map(s => {
          const rows = seriesData[s.id] ?? [];
          const total = rows.reduce((sum, p) => sum + p.revenue, 0);
          const peak = rows.reduce(
            (max, p) => (p.revenue > max.revenue ? p : max),
            { period_label: '—', revenue: 0 },
          );
          const bdName = s.bdId ? (bds.find(b => b.id === s.bdId)?.full_name ?? 'BD') : 'All BDs';
          const label = `${bdName} · ${s.year} · ${s.granularity.charAt(0).toUpperCase() + s.granularity.slice(1)}`;
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-xs font-medium text-[#4a5068] truncate">{label}</span>
              </div>
              <div className="text-xl font-bold font-display text-[#1a1d2e]">{pesoFmt(total)}</div>
              <div className="text-[10px] text-[#8b90a8] mt-1">total revenue</div>
              {peak.revenue > 0 && (
                <div className="mt-2 text-[10px] text-[#059669]">
                  Peak: {peak.period_label} · {pesoFmt(peak.revenue)}
                </div>
              )}
            </Card>
          );
        })}
      </div>

    </div>
  );
}

// ── Stub tab data (unchanged) ──────────────────────────────────────────────

const WIN_LOSS_DATA = [
  { name: 'Won', value: 1, color: '#059669' },
  { name: 'Lost', value: 1, color: '#e11d48' },
  { name: 'Active', value: 5, color: '#3d5af1' },
];
const SALES_CYCLE_DATA = [
  { stage: 'Inquiry', avg_days: 2.5 }, { stage: 'Prospecting', avg_days: 7 },
  { stage: 'Discovery', avg_days: 15 }, { stage: 'Proposal Sent', avg_days: 30 },
  { stage: 'Negotiation', avg_days: 45 },
];
const SERVICE_PERF = [
  { name: 'LOCOBUZZ', deals: 3, revenue: 1440000, win_rate: 50 },
  { name: 'MEDIAWATCH', deals: 3, revenue: 1568162, win_rate: 67 },
  { name: 'SHAREDVIEW', deals: 1, revenue: 0, win_rate: 0 },
  { name: 'REPORTS', deals: 1, revenue: 0, win_rate: 0 },
];
const QUOTA_DATA = [
  { name: 'Henne', quota: 7000000, actual: 1568162 },
  { name: 'Isten', quota: 7000000, actual: 390000 },
  { name: 'Brian', quota: 7000000, actual: 0 },
];

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) {
  if (percent < 0.08) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {value} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function ExecutiveReportsPage() {
  const [tab, setTab] = useState('Pipeline');

  // Page-level BD filter — shared across Pipeline and Growth tabs
  const [bdId, setBdId] = useState('');

  const { data: bds = [] } = useQuery({
    queryKey: ['exec-report-bds'],
    queryFn: () => reportsAnalyticsApi.bds().then(r => r.data),
    staleTime: Infinity,
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Executive Reports"
        subtitle="Analytics, performance insights, and growth sandbox"
        action={{ label: 'Export', onClick: () => alert('Export coming soon') }}
      />

      <div className="flex-1 overflow-y-auto">

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0 overflow-x-auto border-b border-[#e2e6f0]">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
                tab === t
                  ? 'text-[#3d5af1] border-[#3d5af1]'
                  : 'text-[#8b90a8] border-transparent hover:text-[#4a5068]',
              )}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* Page-level BD filter — visible on Pipeline and Growth */}
          {(tab === 'Pipeline' || tab === 'Growth') && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#8b90a8] font-medium">View:</span>
              <select
                value={bdId}
                onChange={e => setBdId(e.target.value)}
                className="h-8 px-3 text-xs bg-white border border-[#e2e6f0] rounded-lg text-[#4a5068] focus:outline-none focus:border-[#4f6ef7]">
                <option value="">All BDs</option>
                {bds.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
            </div>
          )}

          {tab === 'Pipeline' && <PipelineTab bdId={bdId} bds={bds} />}
          {tab === 'Growth' && <GrowthTab bds={bds} />}

          {/* ── Stub tabs (unchanged) ── */}

          {tab === 'Win/Loss' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deal Status Distribution</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={WIN_LOSS_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                        paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={renderPieLabel}>
                        {WIN_LOSS_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Legend formatter={v => <span style={{ color: '#6b7280', fontSize: 12 }}>{v}</span>} />
                      <Tooltip {...TT_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {tab === 'Sales Cycle' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Avg. Days per Stage</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SALES_CYCLE_DATA} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}d`} />
                      <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TT_STYLE} formatter={(v: number) => [`${v} days`, 'Avg. Duration']} />
                      <Bar dataKey="avg_days" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {tab === 'Service Performance' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Revenue by Service</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SERVICE_PERF} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                      <Tooltip {...TT_STYLE} formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {SERVICE_PERF.map((_, i) => <Cell key={i} fill={PALETTE[i]} fillOpacity={0.75} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {SERVICE_PERF.map((svc, i) => (
                  <Card key={svc.name} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i] }} />
                      <span className="text-xs font-bold font-display text-[#1a1d2e]">{svc.name}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Revenue</span><span className="text-[#4a5068] font-medium">{formatCurrency(svc.revenue, true)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-[#8b90a8]">Deals</span><span className="text-[#4a5068] font-medium">{svc.deals}</span></div>
                      <div className="flex justify-between text-xs items-center"><span className="text-[#8b90a8]">Win Rate</span>
                        <Badge variant={svc.win_rate > 50 ? 'success' : svc.win_rate > 0 ? 'warning' : 'neutral'} size="sm">{svc.win_rate}%</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === 'Quota Performance' && (
            <div className="flex flex-col gap-4">
              <Card className="p-5">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Quota vs Actual by BD Member · Q1 2026</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={QUOTA_DATA} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={pesoTick} />
                      <Tooltip {...TT_STYLE} formatter={(v: number) => [formatCurrency(v), '']} />
                      <Bar dataKey="quota" name="Quota" fill="#e6eaf5" stroke="#c8cfe8" strokeWidth={1} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#dce3fd" stroke="#3d5af1" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}