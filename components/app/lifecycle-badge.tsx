import type { ContactLifecycle } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const config: Record<ContactLifecycle, { label: string; color: string }> = {
  new:           { label: 'New',           color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  working:       { label: 'Working',       color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  engaged:       { label: 'Engaged',       color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  customer:      { label: 'Customer',      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  disqualified:  { label: 'Disqualified',  color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export function LifecycleBadge({ stage, className }: { stage: ContactLifecycle; className?: string }) {
  const cfg = config[stage] || config.new;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-[0.1em] font-medium',
      cfg.color,
      className
    )}>
      {cfg.label}
    </span>
  );
}
