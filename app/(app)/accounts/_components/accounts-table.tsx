'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { AccountWithOwner } from '@/lib/db/types';
import { VERTICALS } from '@/lib/verticals';

export function AccountsTable({
  accounts,
  currentUserId,
}: {
  accounts: AccountWithOwner[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const PAGE_SIZE = 150;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = accounts;
    if (filter === 'mine') {
      list = list.filter(a => a.owner_id === currentUserId);
    } else if (VERTICALS.some(v => v.value === filter)) {
      list = list.filter(a => a.vertical === filter);
    } else if (filter === 'cold') {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      list = list.filter(a => !a.last_activity_at || new Date(a.last_activity_at).getTime() < fourteenDaysAgo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.industry?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [accounts, filter, search, currentUserId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: accounts.length },
    { id: 'mine', label: 'Mine', count: accounts.filter(a => a.owner_id === currentUserId).length },
    ...VERTICALS.map(v => ({
      id: v.value,
      label: v.label,
      count: accounts.filter(a => a.vertical === v.value).length,
    })),
    { id: 'cold', label: 'Going cold', count: accounts.filter(a => {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      return !a.last_activity_at || new Date(a.last_activity_at).getTime() < fourteenDaysAgo;
    }).length },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-5">
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <FilterChips chips={chips} activeId={filter} onChange={setFilter} />
        </div>
        <Input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="md:max-w-xs"
        />
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block card-lit border border-border/40 rounded-md overflow-hidden">
        <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
          <div>Account</div>
          <div>Vertical</div>
          <div>Location</div>
          <div>Owner</div>
          <div className="text-right">Last activity</div>
          <div></div>
        </div>
        {visible.map(a => (
          <Link key={a.id} href={`/accounts/${a.id}`}
            className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group min-h-[44px]"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{a.name}</div>
              {a.tags.length > 0 && (
                <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                  {a.tags.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
            <div><VerticalBadge vertical={a.vertical} /></div>
            <div className="text-sm text-muted-foreground truncate">
              {[a.city, a.state].filter(Boolean).join(', ') || '—'}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              {a.owner ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                    {initials(a.owner.full_name, a.owner.email)}
                  </div>
                  <span className="text-sm truncate">
                    {a.owner.full_name || a.owner.email.split('@')[0]}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground italic">unassigned</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-right tabular-nums">
              {formatRelative(a.last_activity_at)}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No accounts match these filters.
          </div>
        )}
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-2">
        {visible.map(a => (
          <Link key={a.id} href={`/accounts/${a.id}`}
            className="card-lit border border-border/40 rounded-md p-4 block min-h-[88px] active:bg-primary/5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight truncate">{a.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <VerticalBadge vertical={a.vertical} />
                  {[a.city, a.state].filter(Boolean).length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {[a.city, a.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {a.owner ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[9px] font-medium flex items-center justify-center shrink-0">
                      {initials(a.owner.full_name, a.owner.email)}
                    </div>
                    <span className="text-muted-foreground truncate">
                      {a.owner.full_name || a.owner.email.split('@')[0]}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">unassigned</span>
                )}
              </div>
              <span className="text-muted-foreground/70 tabular-nums">
                {formatRelative(a.last_activity_at)}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="card-lit border border-border/40 rounded-md px-5 py-12 text-center text-sm text-muted-foreground">
            No accounts match these filters.
          </div>
        )}
      </div>

      {filtered.length > visibleCount && (
        <div className="flex items-center justify-center gap-3 py-4">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Showing {visibleCount.toLocaleString()} of {filtered.length.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => setVisibleCount(n => n + 400)}
            className="text-[11px] uppercase tracking-[0.15em] px-4 py-2 rounded-md border border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            Show more
          </button>
        </div>
      )}
    </>
  );
}
