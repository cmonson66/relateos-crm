import type { Vertical } from '@/lib/db/types';
import { cn } from '@/lib/utils';

const verticalConfig: Record<Vertical, { label: string; color: string }> = {
  corporate:     { label: 'Corporate',     color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  sports:        { label: 'Sports',        color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  public_safety: { label: 'Public Safety', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  military:      { label: 'Military',      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  education:     { label: 'Education',     color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  other:         { label: 'Other',         color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

export function VerticalBadge({ vertical, className }: { vertical: Vertical; className?: string }) {
  const cfg = verticalConfig[vertical] || verticalConfig.other;
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
