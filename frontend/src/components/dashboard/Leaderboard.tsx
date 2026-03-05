import { Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Avatar } from '../ui/index';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES = [
  { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },  // Gold
  { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },  // Silver
  { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },  // Bronze
];

export default function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => {
        const style = RANK_STYLES[i] ?? { bg: '#f4f6fb', color: '#8b90a8', border: '#e2e6f0' };
        return (
          <div key={entry.bd.id} className="flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm"
            style={{ background: style.bg, borderColor: style.border }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ color: style.color }}>
              {i < 3 ? <Trophy size={14} /> : entry.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#1a1d2e]">
                {entry.bd.first_name} {entry.bd.last_name}
              </div>
              <div className="text-[10px] text-[#8b90a8]">Win rate {entry.win_rate}%</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold font-display" style={{ color: style.color }}>
                {formatCurrency(entry.closed_revenue, true)}
              </div>
              <div className="text-[10px] text-[#8b90a8]">{entry.attainment_pct}% of quota</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
