import { ArrowRight } from 'lucide-react';
import type { DealAuditLog, PipelineStage } from '../../types';
import { formatDate } from '../../lib/utils';

interface DealHistoryProps {
  logs: DealAuditLog[];
}

const STAGE_COLORS: Partial<Record<PipelineStage, string>> = {
  Inquiry: '#64748b', Prospecting: '#3b82f6', Discovery: '#8b5cf6',
  'Proposal Sent': '#f59e0b', Negotiation: '#f97316', 'Closed Won': '#10b981', 'Closed Lost': '#e11d48',
};
const stageColor = (stage: PipelineStage) => STAGE_COLORS[stage] ?? '#8b90a8';

export default function DealHistory({ logs }: DealHistoryProps) {
  if (logs.length === 0) {
    return <div className="text-xs text-[#8b90a8] py-4 text-center">No stage history yet</div>;
  }

  return (
    <div className="flex flex-col gap-0">
      {logs.map((log, i) => (
        <div key={log.id} className="flex items-start gap-3 pb-4 relative">
          {/* Timeline line */}
          {i < logs.length - 1 && (
            <div className="absolute left-[7px] top-5 bottom-0 w-px bg-[#e2e6f0]" />
          )}

          {/* Dot */}
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white flex-shrink-0 mt-0.5 shadow-sm z-10"
            style={{ background: stageColor(log.stage), boxShadow: `0 0 0 3px ${stageColor(log.stage)}20` }} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-[#1a1d2e]">{log.stage}</span>
              {log.days_in_stage != null && (
                <span className="text-[10px] text-[#8b90a8]">· {log.days_in_stage}d</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] text-[#8b90a8]">{formatDate(log.entered_at)}</span>
              {log.exited_at && (
                <>
                  <ArrowRight size={9} className="text-[#c8cfe8]" />
                  <span className="text-[10px] text-[#8b90a8]">{formatDate(log.exited_at)}</span>
                </>
              )}
            </div>
            {log.notes && <p className="text-[10px] text-[#6b7280] mt-1 italic">{log.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
