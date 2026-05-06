'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { AccountWithOwner } from '@/lib/db/types';

export function AccountsTable({
  accounts,
  currentUserId,
}: {
  accounts: AccountWithOwner[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = accounts;
    if (filter === 'mine') {
      list = list.filter(a => a.owner_id === currentUserId);
    } else if (filter === 'corporate' || filter === 'sports') {
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

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: accounts.length },
    { id: 'mine', label: 'Mine', count: accounts.filter(a => a.owner_id === currentUserId).length },
    { id: 'corporate', label: 'Corporate', count: accounts.filter(a => a.vertical === 'corporate').length },
    { id: 'sports', label: 'Sports', count: accounts.filter(a => a.vertical === 'sports').length },
    { id: 'cold', label: 'Going cold', count: accounts.filter(a => {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      return !a.last_activity_at || new Date(a.last_activity_at).getTime() < fourteenDaysAgo;
    }).length },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-5">
        <FilterChips chips={chips} activeId={filter} onChange={setFilter} />
        <Input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="card-lit border border-border/40 rounded-md overflow-hidden">
        <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
          <div>Account</div>
          <div>Vertical</div>
          <div>Location</div>
          <div>Owner</div>
          <div className="text-right">Last activity</div>
          <div></div>
        </div>

        {filtered.map(a => (
          <Link
            key={a.id}
            href={`/accounts/${a.id}`}
            className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{a.name}</div>
              {a.tags.length > 0 && (
                <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                  {a.tags.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
            <div>
              <VerticalBadge vertical={a.vertical} />
            </div>
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
    </>
  );
}
