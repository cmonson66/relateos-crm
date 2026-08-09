'use client';

// Search-as-you-type account picker. Replaces the 28,000-option dropdown
// that PostgREST silently capped at the first thousand rows (the "can't
// scroll past the A's" bug). RLS scopes results: reps only find their book.

import { useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { searchAccounts } from '@/app/(app)/appointments/actions';

export type AccountRef = { id: string; name: string };

export function AccountCombobox({
  value,
  onChange,
}: {
  value: AccountRef | null;
  onChange: (v: AccountRef | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  const run = (val: string) => {
    setQ(val);
    setOpen(true);
    const mine = ++seq.current;
    if (val.trim().length < 2) { setResults([]); return; }
    startTransition(async () => {
      const rows = await searchAccounts(val);
      if (seq.current === mine) setResults(rows);
    });
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-background/40 px-3 py-2">
        <span className="truncate text-sm font-semibold">{value.name}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setQ(''); setResults([]); }}
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
          title="Clear account"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => run(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Type the account name…"
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border/40 bg-sidebar shadow-xl">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onChange({ id: r.id, name: r.name }); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-sidebar-accent/60"
            >
              <span className="font-semibold">{r.name}</span>
              {r.city && <span className="ml-2 text-xs text-muted-foreground">{r.city}</span>}
            </button>
          ))}
          {results.length === 0 && !pending && (
            <div className={cn('px-3 py-2 text-xs text-muted-foreground')}>No matches in your accounts.</div>
          )}
          {pending && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
        </div>
      )}
    </div>
  );
}
