'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchAccounts } from '../../actions';

export function AccountFinder({ date }: { date?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (val: string) => {
    setQ(val);
    if (val.trim().length < 2) { setResults([]); return; }
    startTransition(async () => setResults(await searchAccounts(val)));
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="rounded-2xl border border-border/40 bg-sidebar/60 p-5">
        <h1 className="text-lg font-extrabold">+ Appointment</h1>
        <div className="mb-4 text-xs text-muted-foreground">
          {date ? `Booking on ${date} — ` : ''}which account?
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => run(e.target.value)}
            placeholder="Start typing the shop name…"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>
        <div className="mt-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/appointments/new?account=${r.id}${date ? `&date=${date}` : ''}`)}
              className="mb-1.5 block w-full rounded-xl border border-border/40 bg-background/40 px-3.5 py-2.5 text-left text-sm hover:border-amber-500/50"
            >
              <span className="font-bold">{r.name}</span>
              {r.city && <span className="ml-2 text-xs text-muted-foreground">{r.city}</span>}
            </button>
          ))}
          {q.trim().length >= 2 && results.length === 0 && !pending && (
            <div className="px-1 py-2 text-xs text-muted-foreground">Nothing matched — reps only see their own accounts.</div>
          )}
        </div>
      </div>
    </div>
  );
}
