import { formatCurrency } from '../../lib/utils';

interface QuotaGaugeProps {
  actual: number;
  quota: number;
  forecast?: number;
  label?: string;
}

export default function QuotaGauge({ actual, quota, forecast, label = 'Quota Attainment' }: QuotaGaugeProps) {
  const pct      = quota > 0 ? Math.min((actual / quota) * 100, 100) : 0;
  const fPct     = quota > 0 && forecast ? Math.min(((actual + forecast) / quota) * 100, 100) : 0;
  const color    = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#e11d48';

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-xs font-semibold text-[#4a5068] uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold font-display" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>

      {/* Track */}
      <div className="h-3 bg-[#f0f2f8] rounded-full overflow-hidden relative">
        {/* Forecast bar (behind actual) */}
        {fPct > pct && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{ width: `${fPct}%`, background: `${color}30` }}
          />
        )}
        {/* Actual bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      <div className="flex justify-between mt-2 text-[10px] text-[#8b90a8]">
        <span>{formatCurrency(actual, true)} actual</span>
        <span>{formatCurrency(quota, true)} quota</span>
      </div>

      {forecast && forecast > 0 && (
        <div className="mt-1 text-[10px]" style={{ color }}>
          +{formatCurrency(forecast, true)} forecast → {fPct.toFixed(1)}% projected
        </div>
      )}
    </div>
  );
}
