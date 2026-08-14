'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The pieces every list page's filter sheet is built from - accounts, map and
 * contacts. They lived inside accounts-table until contacts needed the same
 * shape; three copies of a pill is how three pages quietly stop matching.
 */

export type FilterOption = { value: string; label: string; count: number };

export function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-sidebar-accent/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}

/**
 * A labelled set of options with counts. A zero-count option is disabled
 * rather than hidden, so "no barbers in DFW yet" reads as an empty bucket
 * instead of a missing one - which is the difference between a fact and a
 * suspected bug.
 */
export function OptionGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-border/30 py-3 last:border-0">
      <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={o.count === 0 && o.value !== value}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-35',
              o.value === value
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/40 text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            <span className="ml-1.5 font-mono text-[10px] opacity-70">{o.count.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The bar button that opens the sheet, carrying how many filters are on. */
export function FilterButton({
  activeCount,
  onClick,
  label = 'Filters',
}: {
  activeCount: number;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors',
        activeCount > 0
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/40 text-muted-foreground hover:text-foreground',
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {label}
      {activeCount > 0 && (
        <span className="rounded-full bg-primary/25 px-1.5 font-mono text-[10px] normal-case tracking-normal">
          {activeCount}
        </span>
      )}
    </button>
  );
}

/** Footer: confirm with the resulting count, plus Clear when anything is on. */
export function SheetActions({
  count,
  noun,
  activeCount,
  onDone,
  onClear,
}: {
  count: number;
  noun: string;
  activeCount: number;
  onDone: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <button
        type="button"
        onClick={onDone}
        className="flex-1 rounded-md bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
      >
        Show {count.toLocaleString()} {noun}
        {count === 1 ? '' : 's'}
      </button>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-border/40 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
