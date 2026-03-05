import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell, Treemap,
} from 'recharts';
import { Trophy, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, Badge, MetricCard, ProgressBar, Avatar } from '../components/ui/index';
import StagePill from '../components/deals/StagePill';
import { MOCK_DEALS, MOCK_BDS, LEADERBOARD_DATA, PIPELINE_BY_STAGE } from '../mockData';
import { formatCurrency, cn } from '../lib/utils';

const ACCOUNT_TYPE_DATA = [
  { type: 'Enterprise', count: 2, revenue: 2588162, color: '#4f6ef7' },
  { type: 'Corporate', count: 1, revenue: 0, color: '#10b981' },
  { type: 'SMB', count: 1, revenue: 0, color: '#f59e0b' },
  { type: 'Government', count: 0, revenue: 0, color: '#8b5cf6' },
];

const SERVICE_DATA = [
  { name: 'MEDIAWATCH', count: 2, revenue: 1348162, win_rate: 67 },
  { name: 'LOCOBUZZ', count: 2, revenue: 1440000, win_rate: 50 },
  { name: 'SHAREDVIEW', count: 1, revenue: 0, win_rate: 0 },
  { name: 'REPORTS', count: 1, revenue: 0, win_rate: 0 },
];

export default function ExecutiveDashboard() {
  const allDeals = MOCK_DEALS;
  const stuckDeals = allDeals.filter(d => (d.days_in_stage || 0) > 3 && !d.is_closed);
  const teamActual = 1958162;
  const teamQuota = 22590000;
  const teamForecast = teamActual + 3240000;

  const stageData = PIPELINE_BY_STAGE.filter(s => !['Closed Won', 'Closed Lost'].includes(s.stage)).map(s => ({
    ...s,
    fill: '#4f6ef7',
  }));

  return (
    <div className="flex flex-col h-full">
      <Header title="Executive Dashboard" subtitle="Team-wide performance · Q1 2026" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Team metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Team Actual" value={formatCurrency(teamActual, true)} sub="Closed Won" accent="#10b981" delay={0} />
          <MetricCard label="Team Quota" value={formatCurrency(teamQuota, true)} sub="₱22.59M annual" accent="#4f6ef7" delay={50} />
          <MetricCard label="Team Forecast" value={formatCurrency(teamForecast, true)} sub="Won + Negotiation" accent="#8b5cf6" delay={100} />
          <MetricCard label="Attainment" value={`${((teamActual / teamQuota) * 100).toFixed(1)}%`} sub="of annual quota" accent="#f59e0b" delay={150} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Pipeline funnel */}
          <Card className="p-5 lg:col-span-2">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Pipeline by Stage</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4a4f6b', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${(v / 1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: '#8b90a8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e6f0', borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, name: string) => [name === 'total_value' ? formatCurrency(val) : val, name === 'total_value' ? 'Total Value' : 'Count']}
                  />
                  <Bar dataKey="total_value" fill="#4f6ef730" stroke="#4f6ef7" strokeWidth={1} radius={[0, 4, 4, 0]} name="total_value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Stuck deals */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#d97706]" />
              <span className="text-xs font-semibold font-display text-[#d97706] uppercase tracking-wider">Stuck Deals</span>
              <Badge variant="warning" size="sm">{stuckDeals.length}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {stuckDeals.map(deal => (
                <div key={deal.id} className="p-3 bg-[#f4f6fb] border border-[#d9770620] rounded-xl">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{deal.deal_name}</span>
                    <span className="text-xs text-[#d97706] font-bold">{deal.days_in_stage}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StagePill stage={deal.stage} size="sm" />
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

        {/* Leaderboard */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-[#d97706]" />
            <span className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider">BD Leaderboard · Q1 2026</span>
          </div>
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#e2e6f0]">
              <div className="col-span-1 text-[10px] text-[#8b90a8] uppercase tracking-wider">#</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Member</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Closed Rev.</div>
              <div className="col-span-3 text-[10px] text-[#8b90a8] uppercase tracking-wider">Attainment</div>
              <div className="col-span-2 text-[10px] text-[#8b90a8] uppercase tracking-wider">Win Rate</div>
            </div>

            {LEADERBOARD_DATA.map((entry) => {
              const rankColors = ['#f59e0b', '#8b90a8', '#cd7f32'];
              return (
                <div key={entry.bd.id} className="grid grid-cols-12 gap-4 py-3 border-b border-[#f0f2f8] hover:bg-[#fafbfd] transition-colors">
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-bold font-display" style={{ color: rankColors[entry.rank - 1] || '#4a4f6b' }}>
                      {entry.rank}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Avatar name={`${entry.bd.first_name} ${entry.bd.last_name}`} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a1d2e] truncate">{entry.bd.first_name}</div>
                      <div className="text-[10px] text-[#8b90a8] truncate">{entry.bd.role}</div>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm font-bold font-display text-[#1a1d2e]">{formatCurrency(entry.closed_revenue, true)}</span>
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
                    <Badge variant={entry.win_rate > 50 ? 'success' : entry.win_rate > 20 ? 'warning' : 'danger'} size="sm">
                      {entry.win_rate}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Closed by account type */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Deals by Account Type · Q1</div>
            <div className="flex flex-col gap-2">
              {ACCOUNT_TYPE_DATA.map(item => (
                <div key={item.type} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-[#4a5068]">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#1a1d2e]">{formatCurrency(item.revenue, true)}</span>
                    <Badge variant="neutral" size="sm">{item.count} deals</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Service performance */}
          <Card className="p-5">
            <div className="text-xs font-semibold font-display text-[#4a5068] uppercase tracking-wider mb-4">Service Performance</div>
            <div className="flex flex-col gap-2">
              {SERVICE_DATA.map(svc => (
                <div key={svc.name} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0f2f8]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1a1d2e]">{svc.name}</div>
                    <div className="text-[10px] text-[#8b90a8]">{svc.count} deals</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-bold text-[#1a1d2e]">{formatCurrency(svc.revenue, true)}</span>
                    <Badge variant={svc.win_rate > 50 ? 'success' : svc.win_rate > 0 ? 'warning' : 'neutral'} size="sm">
                      {svc.win_rate}% win
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
