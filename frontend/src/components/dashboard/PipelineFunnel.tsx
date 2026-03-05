import { formatCurrency } from '../../lib/utils';
import type { PipelineStageMetric } from '../../types';

interface PipelineFunnelProps {
  stages: PipelineStageMetric[];
}

const STAGE_COLORS: Record<string, string> = {
  'Inquiry':       '#6b7280',
  'Prospecting':   '#3d5af1',
  'Discovery':     '#059669',
  'Proposal Sent': '#7c3aed',
  'Negotiation':   '#d97706',
  'Closed Won':    '#059669',
  'Closed Lost':   '#e11d48',
};

export default function PipelineFunnel({ stages }: PipelineFunnelProps) {
  const max = Math.max(...stages.map(s => s.total_value), 1);

  return (
    <div className="flex flex-col gap-2">
      {stages.map(stage => {
        const pct   = (stage.total_value / max) * 100;
        const color = STAGE_COLORS[stage.stage] ?? '#8b90a8';
        return (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className="w-24 text-[10px] text-[#8b90a8] text-right flex-shrink-0">{stage.stage}</div>
            <div className="flex-1 h-6 bg-[#f0f2f8] rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                style={{ width: `${Math.max(pct, 4)}%`, background: `${color}25`, borderLeft: `3px solid ${color}` }}
              >
                <span className="text-[10px] font-medium truncate" style={{ color }}>
                  {stage.deal_count} deal{stage.deal_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="w-20 text-[10px] text-[#4a5068] font-medium text-right flex-shrink-0">
              {formatCurrency(stage.total_value, true)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
