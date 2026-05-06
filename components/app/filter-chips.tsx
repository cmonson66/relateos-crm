'use client';

import { cn } from '@/lib/utils';

export type FilterChip = {
  id: string;
  label: string;
  count?: number;
};

export function FilterChips({
  chips,
  activeId,
  onChange,
}: {
  chips: FilterChip[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map(chip => {
        const active = chip.id === activeId;
        return (
          <button
            key={chip.id}
            onClick={() => onChange(chip.id)}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border text-xs uppercase tracking-[0.12em] transition-all',
              active
                ? 'bg-primary text-primary-foreground border-primary glow-stripe-soft font-medium'
                : 'bg-card/50 text-muted-foreground border-border/40 hover:bg-card hover:text-foreground hover:border-border/70'
            )}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span className={cn(
                'font-mono text-[10px] px-1.5 rounded',
                active ? 'bg-primary-foreground/15' : 'bg-muted-foreground/10'
              )}>
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
