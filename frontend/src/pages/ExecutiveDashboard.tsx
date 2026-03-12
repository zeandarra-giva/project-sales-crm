import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Trophy, AlertTriangle, Download, FileText, Image } from 'lucide-react';
import html2canvas from 'html2canvas';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { useExecutiveDashboard } from '../hooks/useDashboard';
import { formatCurrency, cn } from '../lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────
const START_YEAR = 2024;
const QS = [1, 2, 3, 4];
function getYearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= START_YEAR; y--) years.push(y);
  return years;
}

const PIE_COLORS = ['#5b3fa6', '#7c5cbf', '#a07ad4', '#c4a0e8', '#e0ccf8', '#3d2878'];
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

// ── Export helpers ────────────────────────────────────────────────────────────
function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportPNG(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

// ── Export dropdown (CSV + PNG) ───────────────────────────────────────────────
function ExportMenu({ onCSV, onPNG }: { onCSV: () => void; onPNG: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  }

  const menu = open ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="bg-white border border-[#e2e6f0] rounded-xl shadow-xl overflow-hidden"
    >
      <button
        onClick={() => { onCSV(); setOpen(false); }}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-[#4a5068] hover:bg-[#f4f6fb] transition-colors whitespace-nowrap"
      >
        <FileText size={11} className="text-[#8b90a8]" /> Export CSV
      </button>
      <div className="h-px bg-[#f0f2f8]" />
      <button
        onClick={() => { onPNG(); setOpen(false); }}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-[#4a5068] hover:bg-[#f4f6fb] transition-colors whitespace-nowrap"
      >
        <Image size={11} className="text-[#8b90a8]" /> Export PNG
      </button>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg text-[#8b90a8] hover:text-[#5b3fa6] hover:bg-[#f0ebfe] transition-colors flex-shrink-0"
        title="Export"
      >
        <Download size={12} />
      </button>
      {open ? createPortal(menu, document.body) : null}
    </>
  );
}

// ── Shared Pie Card ───────────────────────────────────────────────────────────
function PieCard({
  title,
  filename,
  data,
  nameKey,
  valueKey = 'revenue',
  countKey = 'count',
  colorOffset = 0,
}: {
  title: string;
  filename: string;
  data: Record<string, any>[];
  nameKey: string;
  valueKey?: string;
  countKey?: string;
  colorOffset?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const totalRevenue = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  const totalCount = data.reduce((s, d) => s + Number(d[countKey] ?? 0), 0);

  function handleCSV() {
    const headers = ['Category', 'Revenue (PHP)', 'Revenue %', 'Deal Count', 'Count %'];
    const rows = data.map(d => {
      const rev = Number(d[valueKey] ?? 0);
      const cnt = Number(d[countKey] ?? 0);
      const revPct = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : '0.0';
      const cntPct = totalCount > 0 ? ((cnt / totalCount) * 100).toFixed(1) : '0.0';
      return [String(d[nameKey]), rev, `${revPct}%`, cnt, `${cntPct}%`];
    });
    rows.push(['TOTAL', totalRevenue, '100.0%', totalCount, '100.0%']);
    exportCSV(filename, headers, rows);
  }

  function handlePNG() {
    if (cardRef.current) exportPNG(cardRef.current, filename.replace('.csv', '.png'));
  }

  if (data.length === 0) return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-center py-8 text-xs text-[#8b90a8]">No closed deals this period</div>
    </Card>
  );

  const chartData = data.map((d, i) => ({
    name: d[nameKey],
    value: Number(d[valueKey] ?? 0),
    count: Number(d[countKey] ?? 0),
    color: PIE_COLORS[(i + colorOffset) % PIE_COLORS.length],
  }));

  return (
    <div ref={cardRef}>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">{title}</span>
          <ExportMenu onCSV={handleCSV} onPNG={handlePNG} />
        </div>

        <div className="flex gap-5 items-center max-w-sm">
          <div className="relative w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%" cy="50%"
                  innerRadius={36} outerRadius={62}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 11 }}
                  formatter={(val: number) => [formatCurrency(val), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-[#1a1d2e] font-display leading-none">{totalCount}</span>
              <span className="text-[9px] text-[#8b90a8] mt-0.5">deals</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            {chartData.map((item) => {
              const revPct = totalRevenue > 0 ? Math.round((item.value / totalRevenue) * 100) : 0;
              return (
                <div key={item.name} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: item.color }} />
                  {/* name + revenue */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#4a5068]">
                      {typeof item.name === 'string'
                        ? item.name.charAt(0).toUpperCase() + item.name.slice(1).toLowerCase()
                        : item.name}
                    </div>
                    <div className="text-[10px] font-semibold text-[#1a1d2e] mt-0.5">
                      {formatCurrency(item.value, true)}
                    </div>
                  </div>
                  {/* % + count — pinned right, no gap */}
                  <div className="text-right flex-shrink-0 pl-2">
                    <div className="text-[10px] text-[#8b90a8] font-medium leading-tight">{revPct}%</div>
                    <div className="text-[9px] text-[#b0b6cc] leading-tight mt-0.5">{item.count} deals</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Industry Table ────────────────────────────────────────────────────────────
function IndustryTable({ data, filename }: { data: any[]; filename: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const totalRev = data.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const totalCnt = data.reduce((s, d) => s + Number(d.count ?? 0), 0);

  function handleCSV() {
    const headers = ['Industry', 'Revenue (PHP)', 'Revenue %', 'Deal Count', 'Count %'];
    const rows = data.map(d => {
      const rev = Number(d.revenue ?? 0);
      const cnt = Number(d.count ?? 0);
      const revPct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : '0.0';
      const cntPct = totalCnt > 0 ? ((cnt / totalCnt) * 100).toFixed(1) : '0.0';
      return [String(d.industry), rev, `${revPct}%`, cnt, `${cntPct}%`];
    });
    rows.push(['TOTAL', totalRev, '100.0%', totalCnt, '100.0%']);
    exportCSV(filename, headers, rows);
  }

  function handlePNG() {
    if (cardRef.current) exportPNG(cardRef.current, filename.replace('.csv', '.png'));
  }

  return (
    <div ref={cardRef}>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">Industry Breakdown</span>
          <ExportMenu onCSV={handleCSV} onPNG={handlePNG} />
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
            {data.map((row) => (
              <tr key={row.industry} className="border-b border-[#f0f2f8] hover:bg-[#fafbff]">
                <td className="py-2 text-[#4a5068]">{row.industry}</td>
                <td className="py-2 text-right font-semibold text-[#1a1d2e]">
                  {Number(row.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 text-right text-[#8b90a8]">{row.count}</td>
              </tr>
            ))}
            {data.length > 0 ? (
              <tr className="font-bold border-t border-[#e2e6f0]">
                <td className="py-2 text-[#1a1d2e]">Total</td>
                <td className="py-2 text-right text-[#5b3fa6]">
                  {totalRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 text-right text-[#1a1d2e]">{totalCnt}</td>
              </tr>
            ) : (
              <tr><td colSpan={3} className="py-6 text-center text-[#8b90a8]">No data this period</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);

  const pipelineCardRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useExecutiveDashboard(year, quarter);

  const team = data?.team;
  const leaderboard = data?.leaderboard ?? [];
  const stuckDeals = data?.stuck_deals ?? [];
  const pipelineByStage = data?.pipeline_by_stage ?? [];
  const byAccountType = data?.by_account_type ?? [];
  const byService = data?.by_service ?? [];
  const byBD = data?.by_b_d ?? [];
  const byLeadSource = data?.by_lead_source ?? [];
  const byIndustry = data?.by_industry ?? [];

  const periodLabel = `Q${quarter} ${year}`;

  const stageData = pipelineByStage.map(row => ({
    stage: row.stage_name ?? row.stage_id,
    total_value: Number((row._sum as any)?.revenue ?? 0),
    count: (row._count as any)?.id ?? 0,
  }));

  function pipelineCSV() {
    const totalVal = stageData.reduce((s, d) => s + d.total_value, 0);
    const totalCnt = stageData.reduce((s, d) => s + d.count, 0);
    exportCSV(`pipeline-by-stage-${periodLabel}.csv`,
      ['Stage', 'Total Value (PHP)', 'Value %', 'Deal Count', 'Count %'],
      [
        ...stageData.map(d => [
          d.stage,
          d.total_value,
          totalVal > 0 ? `${((d.total_value / totalVal) * 100).toFixed(1)}%` : '0.0%',
          d.count,
          totalCnt > 0 ? `${((d.count / totalCnt) * 100).toFixed(1)}%` : '0.0%',
        ]),
        ['TOTAL', totalVal, '100.0%', totalCnt, '100.0%'],
      ]
    );
  }

  function pipelinePNG() {
    if (pipelineCardRef.current) exportPNG(pipelineCardRef.current, `pipeline-by-stage-${periodLabel}.png`);
  }

  const exportAll = useCallback(() => {
    const pct = (n: number, total: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%';
    const h = ['Category', 'Revenue (PHP)', 'Revenue %', 'Deal Count', 'Count %'];

    const run = (rows: any[], nameF: (d: any) => string, revF: (d: any) => number, cntF: (d: any) => number, file: string) => {
      const tRev = rows.reduce((s, d) => s + revF(d), 0);
      const tCnt = rows.reduce((s, d) => s + cntF(d), 0);
      exportCSV(file, h, [
        ...rows.map(d => [nameF(d), revF(d), pct(revF(d), tRev), cntF(d), pct(cntF(d), tCnt)]),
        ['TOTAL', tRev, '100.0%', tCnt, '100.0%'],
      ]);
    };

    run(byBD, (d: any) => d.bd_name, (d: any) => Number(d.revenue), (d: any) => Number(d.count), `by-bd-${periodLabel}.csv`);
    run(byService, (d: any) => d.service, (d: any) => Number(d.revenue), (d: any) => Number(d.count), `by-service-${periodLabel}.csv`);
    run(byLeadSource, (d: any) => d.source, (d: any) => Number(d.revenue), (d: any) => Number(d.count), `by-lead-source-${periodLabel}.csv`);
    run(byAccountType, (d: any) => d.account_type, (d: any) => Number(d.revenue), (d: any) => Number(d.count), `by-client-type-${periodLabel}.csv`);
    run(byIndustry, (d: any) => d.industry, (d: any) => Number(d.revenue), (d: any) => Number(d.count), `industry-breakdown-${periodLabel}.csv`);
    pipelineCSV();
  }, [byBD, byService, byLeadSource, byAccountType, byIndustry, stageData, periodLabel]);

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

        {/* ── Filters + Export ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8b90a8]">Year</span>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="h-8 bg-white border border-[#e2e6f0] rounded-lg px-2.5 pr-7 text-xs text-[#1a1d2e] focus:outline-none focus:border-[#c4a0e8] focus:ring-2 focus:ring-[#c4a0e820] transition-all shadow-sm appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b90a8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                {getYearOptions().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#8b90a8]">Quarter</span>
              {QS.map(q => (
                <button key={q} onClick={() => setQuarter(q)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    q === quarter
                      ? 'bg-[#f0ebfe] border-[#c4a0e8] text-[#5b3fa6]'
                      : 'bg-white border-[#e2e6f0] text-[#8b90a8] hover:text-[#4a5068]'
                  )}>Q{q}</button>
              ))}
            </div>
          </div>
          <button onClick={exportAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1d2e] text-white hover:bg-[#2d3148] transition-colors">
            <Download size={12} /> Export All CSVs
          </button>
        </div>

        {/* ── Team KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <MetricCard label="Team Actual" value={formatCurrency(team?.total_revenue ?? 0, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(team?.total_quota ?? 0, true)} sub="this quarter" accent="#5b3fa6" delay={50} />
          <MetricCard label="Sales Forecast" value={formatCurrency(team?.sales_forecast ?? 0, true)} sub="Won + Negotiation" accent="#a07ad4" delay={100} />
          <MetricCard label="Attainment" value={`${(team?.attainment_pct ?? 0).toFixed(1)}%`} sub="of quarterly quota" accent="#f59e0b" delay={150} />
        </div>

        {/* ── Pipeline + Stuck Deals ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div ref={pipelineCardRef} className="lg:col-span-2">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">
                  Pipeline by Stage
                </div>
                <ExportMenu onCSV={pipelineCSV} onPNG={pipelinePNG} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₱${(v / 1_000_000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number, name: string) =>
                        [name === 'total_value' ? formatCurrency(val) : val,
                        name === 'total_value' ? 'Total Value' : 'Deals']}
                    />
                    <Bar dataKey="total_value" name="total_value" fill="#a07ad430" stroke="#7c5cbf" strokeWidth={1} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
              <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-52">
              {stuckDeals.map((deal: any) => (
                <div key={deal.id} className="p-3 bg-[#fffbf0] border border-[#f5d97820] rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-[#1a1d2e] leading-tight">{deal.deal_name}</span>
                    <span className="text-xs text-[#d97706] font-bold flex-shrink-0">
                      {deal.days_in_stage ?? deal.days_in_current_stage}d
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StagePill stage={deal.stage?.name ?? deal.stage} size="sm" />
                    <span className="text-xs text-[#8b90a8]">{deal.bd?.first_name}</span>
                  </div>
                </div>
              ))}
              {stuckDeals.length === 0 && (
                <div className="text-center py-8 text-xs text-[#8b90a8]">No stuck deals 🎉</div>
              )}
            </div>
          </Card>
        </div>

        {/* ── BD Leaderboard ── */}
        <Card className="p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">
              BD Leaderboard · {periodLabel}
            </span>
          </div>
          <div>
            <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
              {['#', 'Member', 'Closed Rev.', 'Attainment', 'Win Rate'].map((h, i) => (
                <div key={h}
                  className={`${i === 0 ? 'col-span-1' : i === 1 ? 'col-span-3' : i === 4 ? 'col-span-2' : 'col-span-3'} text-[10px] text-[#8b90a8] uppercase tracking-wider font-medium`}>
                  {h}
                </div>
              ))}
            </div>
            {leaderboard.map((entry, idx) => (
              <div key={entry.bd.id}
                className="grid grid-cols-12 gap-4 py-3 border-b border-[#f0f2f8] hover:bg-[#fafbfd] transition-colors">
                <div className="col-span-1 flex items-center">
                  <span className="text-sm font-bold font-display" style={{ color: RANK_COLORS[idx] || '#4a4f6b' }}>
                    {idx + 1}
                  </span>
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <Avatar name={`${entry.bd.first_name} ${entry.bd.last_name}`} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d2e] truncate">{entry.bd.first_name}</div>
                    <div className="text-[10px] text-[#8b90a8]">{entry.bd.role}</div>
                  </div>
                </div>
                <div className="col-span-3 flex items-center">
                  <span className="text-sm font-bold font-display text-[#1a1d2e]">
                    {formatCurrency(entry.revenue, true)}
                  </span>
                </div>
                <div className="col-span-3 flex flex-col justify-center gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#4a5068]">{entry.attainment_pct.toFixed(1)}%</span>
                    <span className="text-[#8b90a8]">{formatCurrency(entry.quota, true)}</span>
                  </div>
                  <ProgressBar
                    value={entry.attainment_pct}
                    color={entry.attainment_pct > 50 ? '#10b981' : entry.attainment_pct > 20 ? '#f59e0b' : '#f43f5e'}
                  />
                </div>
                <div className="col-span-2 flex items-center">
                  <Badge
                    variant={entry.win_rate > 50 ? 'success' : entry.win_rate > 20 ? 'warning' : 'danger'}
                    size="sm"
                  >
                    {entry.win_rate}%
                  </Badge>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-xs text-[#8b90a8]">No data for this period</div>
            )}
          </div>
        </Card>

        {/* ── Closed Won Breakdown ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">
            Closed Won Breakdown · {periodLabel}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <PieCard title="By BD Rep" filename={`by-bd-${periodLabel}.csv`} data={byBD} nameKey="bd_name" colorOffset={0} />
          <PieCard title="By Client Type" filename={`by-client-type-${periodLabel}.csv`} data={byAccountType.filter((d: any) => d.count > 0)} nameKey="account_type" colorOffset={2} />
          <IndustryTable data={byIndustry} filename={`industry-breakdown-${periodLabel}.csv`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PieCard title="By Service Type" filename={`by-service-${periodLabel}.csv`} data={byService} nameKey="service" colorOffset={1} />
          <PieCard title="By Lead Source" filename={`by-lead-source-${periodLabel}.csv`} data={byLeadSource} nameKey="source" colorOffset={3} />
        </div>

      </div>
    </div>
  );
}