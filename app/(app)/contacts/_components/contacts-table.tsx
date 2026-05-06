'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { LifecycleBadge } from '@/components/app/lifecycle-badge';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { ContactWithRefs } from '@/lib/db/types';

export function ContactsTable({
  contacts,
  currentUserId,
}: {
  contacts: ContactWithRefs[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = contacts;
    if (filter === 'mine') {
      list = list.filter(c => c.owner_id === currentUserId);
    } else if (filter === 'engaged') {
      list = list.filter(c => c.lifecycle_stage === 'engaged' || c.lifecycle_stage === 'working');
    } else if (filter === 'cold') {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      list = list.filter(c => !c.last_activity_at || new Date(c.last_activity_at).getTime() < fourteenDaysAgo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        (c.last_name?.toLowerCase().includes(q)) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.title?.toLowerCase().includes(q)) ||
        (c.account?.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contacts, filter, search, currentUserId]);

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: contacts.length },
    { id: 'mine', label: 'Mine', count: contacts.filter(c => c.owner_id === currentUserId).length },
    { id: 'engaged', label: 'Working / Engaged', count: contacts.filter(c => c.lifecycle_stage === 'engaged' || c.lifecycle_stage === 'working').length },
    { id: 'cold', label: 'Going cold', count: contacts.filter(c => {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      return !c.last_activity_at || new Date(c.last_activity_at).getTime() < fourteenDaysAgo;
    }).length },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-5">
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <FilterChips chips={chips} activeId={filter} onChange={setFilter} />
        </div>
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="md:max-w-xs" />
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block card-lit border border-border/40 rounded-md overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
          <div>Contact</div>
          <div>Account</div>
          <div>Stage</div>
          <div>Owner</div>
          <div>Email</div>
          <div className="text-right">Last activity</div>
          <div></div>
        </div>
        {filtered.map(c => (
          <Link key={c.id} href={`/contacts/${c.id}`}
            className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_40px] items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group min-h-[44px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                {initials(`${c.first_name} ${c.last_name || ''}`, c.email || undefined)}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.title || '—'}</div>
              </div>
            </div>
            <div className="min-w-0">
              {c.account ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm">{c.account.name}</span>
                  <VerticalBadge vertical={c.account.vertical} />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">no account</span>
              )}
            </div>
            <div><LifecycleBadge stage={c.lifecycle_stage} /></div>
            <div className="flex items-center gap-2 min-w-0">
              {c.owner ? (
                <span className="text-sm truncate">
                  {c.owner.full_name || c.owner.email.split('@')[0]}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground italic">—</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">{c.email || '—'}</div>
            <div className="text-xs text-muted-foreground text-right tabular-nums">
              {formatRelative(c.last_activity_at)}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No contacts match these filters.
          </div>
        )}
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-2">
        {filtered.map(c => (
          <Link key={c.id} href={`/contacts/${c.id}`}
            className="card-lit border border-border/40 rounded-md p-4 block active:bg-primary/5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                {initials(`${c.first_name} ${c.last_name || ''}`, c.email || undefined)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-medium leading-tight truncate">{c.first_name} {c.last_name}</div>
                    {c.title && <div className="text-[11px] text-muted-foreground truncate">{c.title}</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <LifecycleBadge stage={c.lifecycle_stage} />
                  {c.account && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {c.account.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{c.email || ''}</span>
                  <span className="tabular-nums shrink-0">{formatRelative(c.last_activity_at)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="card-lit border border-border/40 rounded-md px-5 py-12 text-center text-sm text-muted-foreground">
            No contacts match these filters.
          </div>
        )}
      </div>
    </>
  );
}
