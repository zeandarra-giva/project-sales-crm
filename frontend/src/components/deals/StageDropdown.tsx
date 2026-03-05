import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { PIPELINE_STAGES } from '../../mockData';
import type { PipelineStage } from '../../types';
import { cn } from '../../lib/utils';

interface StageDropdownProps {
  current: PipelineStage;
  onChange: (stage: PipelineStage, probability: number) => void;
  disabled?: boolean;
}

export default function StageDropdown({ current, onChange, disabled }: StageDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentStage = PIPELINE_STAGES.find(s => s.name === current);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
          'bg-white border-[#e2e6f0] text-[#1a1d2e] hover:border-[#c7d0fb] disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: currentStage?.color }} />
        {current}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-[#e2e6f0] rounded-xl shadow-lg min-w-[200px] overflow-hidden animate-fade-in">
          {PIPELINE_STAGES.map(stage => (
            <button
              key={stage.id}
              type="button"
              onClick={() => { onChange(stage.name, stage.probability); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left transition-colors hover:bg-[#f4f6fb]',
                current === stage.name && 'bg-[#eef1fe] text-[#3d5af1]'
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
              <span className="flex-1">{stage.name}</span>
              <span className="text-[10px] text-[#8b90a8]">{stage.probability}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
