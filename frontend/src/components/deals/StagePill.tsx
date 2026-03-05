import { AlertTriangle } from 'lucide-react';
import type { PipelineStage } from '../../types/index';
import { cn, getStageClass } from '../../lib/utils';

interface StagePillProps {
  stage: PipelineStage;
  daysInStage?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StagePill({ stage, daysInStage, size = 'md', className }: StagePillProps) {
  const isStuck = daysInStage !== undefined && daysInStage > 3 && !['Closed Won', 'Closed Lost'].includes(stage);
  const stageClass = getStageClass(stage);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs',
      stageClass,
      isStuck && 'border-[#fcd34d]',
      className
    )}>
      {isStuck && <AlertTriangle size={10} className="text-[#d97706]" />}
      {stage}
      {daysInStage !== undefined && !['Closed Won', 'Closed Lost'].includes(stage) && (
        <span className={cn('text-[10px] opacity-70', isStuck && 'text-[#d97706] opacity-100')}>
          {daysInStage}d
        </span>
      )}
    </span>
  );
}
