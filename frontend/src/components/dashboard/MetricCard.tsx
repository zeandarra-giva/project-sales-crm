import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '../ui/index';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;       // positive = up, negative = down, 0 = flat
  icon?: ReactNode;
  color?: string;
  className?: string;
}

export default function MetricCard({ label, value, sub, trend, icon, color = '#3d5af1', className }: MetricCardProps) {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend == null ? '' : trend > 0 ? '#059669' : trend < 0 ? '#e11d48' : '#8b90a8';

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-[#8b90a8] font-medium">{label}</span>
        {icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, color }}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold font-display" style={{ color: '#1a1d2e' }}>{value}</div>
      {(sub || trend != null) && (
        <div className="flex items-center gap-1.5 mt-1">
          {TrendIcon && <TrendIcon size={11} style={{ color: trendColor }} />}
          {sub && <span className="text-xs" style={{ color: trend != null ? trendColor : '#8b90a8' }}>{sub}</span>}
        </div>
      )}
    </Card>
  );
}
