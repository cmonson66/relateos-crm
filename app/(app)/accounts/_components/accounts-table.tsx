'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { bulkAssignAccounts } from '../actions';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { AccountWithOwner } from '@/lib/db/types';
import { VERTICALS } from '@/lib/verticals';
import { CryptoScoreBadge } from '@/components/app/crypto-score-badge';

type SortKey = 'recent' | 'crypto' | 'city' | 'name';

export function AccountsTable({
  accounts,
  currentUserId,
  reps = [],
  canAssign = false,
}: {
  accounts: AccountWithOwner[];
  currentUserId: string;
  reps?: { profile_id: string; first_name: string }[];
  canAssign?: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [repChoice, setRepChoice] = useState('');
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [isAssigning, startAssign] = useTransition();

  const hasCrypto = accounts.some(a => a.crypto_score !== null && a.crypto_score !== undefined);

  const PAGE_SIZE = 150;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = accounts;
    if (filter === 'mine') {
      list = list.filter(a => a.owner_id === currentUserId);
    } else if (VERTICALS.some(v => v.value === filter)) {
      list = list.filter(a => a.vertical === filter);
    } else if (filter === 'crypto') {
      list = list.filter(a => (a.crypto_score ?? 0) >= 70);
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
    if (sort === 'crypto') {
      // nulls last -- an unscored account isn't a zero-density account
      list = [...list].sort((a, b) => {
        const av = a.crypto_score ?? -1;
        const bv = b.crypto_score ?? -1;
        return bv - av;
      });
    } else if (sort === 'city') {
      list = [...list].sort(
        (a, b) => (a.city ?? '\uffff').localeCompare(b.city ?? '\uffff') || a.name.localeCompare(b.name)
      );
    } else if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [accounts, filter, search, currentUserId, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    // A changed view means a changed meaning of "selected" — start clean
    setSelected(new Set());
    setAllMatching(false);
  }, [filter, search, sort]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const selectedCount = allMatching ? filtered.length : selected.size;
  const allVisibleSelected =
    visible.length > 0 && visible.every(a => allMatching || selected.has(a.id));

  const toggleOne = (id: string) => {
    setAllMatching(false);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
      setAllMatching(false);
    } else {
      setSelected(new Set(visible.map(a => a.id)));
    }
  };

  const applyAssign = () => {
    if (!repChoice || selectedCount === 0) return;
    const ids = allMatching ? filtered.map(a => a.id) : [...selected];
    const repName = reps.find(r => r.profile_id === repChoice)?.first_name ?? 'rep';
    setAssignMsg(null);
    startAssign(async () => {
      try {
        const res = await bulkAssignAccounts(ids, repChoice);
        setAssignMsg(
          `Assigned ${res.accountsUpdated.toLocaleString()} accounts (+${res.contactsUpdated.toLocaleString()} contacts) to ${repName}`
        );
        setSelected(new Set());
        setAllMatching(false);
      } catch (err) {
        setAssignMsg(err instanceof Error ? err.message : 'Assignment failed');
      }
    });
  };

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: accounts.length },
    { id: 'mine', label: 'Mine', count: accounts.filter(a => a.owner_id === currentUserId).length },
    ...VERTICALS.map(v => ({
      id: v.value,
      label: v.label,
      count: accounts.filter(a => a.vertical === v.value).length,
    })),
    ...(hasCrypto
      ? [{
          id: 'crypto',
          label: 'Crypto 70+',
          count: accounts.filter(a => (a.crypto_score ?? 0) >= 70).length,
        }]
      : []),
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
        <div className="flex items-center gap-2">
          {(
            <div className="inline-flex rounded-md border border-border/40 overflow-hidden shrink-0">
              {([
                ['recent', 'Recent'],
                ['city', 'City'],
                ['name', 'Name'],
                ...(hasCrypto ? ([['crypto', 'Density']] as [SortKey, string][]) : []),
              ] as [SortKey, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                  className={`text-[11px] uppercase tracking-[0.15em] px-2.5 py-2 border-r border-border/40 last:border-r-0 transition-colors ${
                    sort === id
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="md:max-w-xs"
          />
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block card-lit border border-border/40 rounded-md overflow-hidden">
        <div className={`grid ${canAssign ? 'grid-cols-[28px_2.2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr_40px]' : 'grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr_40px]'} items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30`}>
          {canAssign && (
            <button
              type="button"
              aria-label="Select visible"
              onClick={toggleVisible}
              className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors ${
                allVisibleSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60 hover:border-primary/60'
              }`}
            >
              {allVisibleSelected && <Check className="h-3 w-3" />}
            </button>
          )}
          <div>Account</div>
          <div>Vertical</div>
          <div>Location</div>
          <div>Owner</div>
          <div>Crypto</div>
          <div className="text-right">Last activity</div>
          <div></div>
        </div>
        {visible.map(a => (
          <Link key={a.id} href={`/accounts/${a.id}`}
            className={`grid ${canAssign ? 'grid-cols-[28px_2.2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr_40px]' : 'grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.7fr_0.6fr_40px]'} items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group min-h-[44px]`}
          >
            {canAssign && (
              <button
                type="button"
                aria-label={`Select ${a.name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleOne(a.id);
                }}
                className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-colors ${
                  allMatching || selected.has(a.id)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border/60 hover:border-primary/60'
                }`}
              >
                {(allMatching || selected.has(a.id)) && <Check className="h-3 w-3" />}
              </button>
            )}
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
            <div>
              <CryptoScoreBadge score={a.crypto_score} atmCount={a.crypto_atm_count} />
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
              <div className="flex items-center gap-2 mt-1 shrink-0">
                {canAssign && (
                  <button
                    type="button"
                    aria-label={`Select ${a.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleOne(a.id);
                    }}
                    className={`w-[20px] h-[20px] rounded border flex items-center justify-center transition-colors ${
                      allMatching || selected.has(a.id)
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border/60'
                    }`}
                  >
                    {(allMatching || selected.has(a.id)) && <Check className="h-3.5 w-3.5" />}
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </div>
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
              <div className="flex items-center gap-3 shrink-0">
                <CryptoScoreBadge score={a.crypto_score} atmCount={a.crypto_atm_count} compact />
                <span className="text-muted-foreground/70 tabular-nums">
                  {formatRelative(a.last_activity_at)}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="card-lit border border-border/40 rounded-md px-5 py-12 text-center text-sm text-muted-foreground">
            No accounts match these filters.
          </div>
        )}
      </div>

      {canAssign && !allMatching && allVisibleSelected && filtered.length > visible.length && (
        <div className="flex items-center justify-center py-3">
          <button
            type="button"
            onClick={() => setAllMatching(true)}
            className="text-[11px] uppercase tracking-[0.15em] px-4 py-2 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
          >
            Select all {filtered.length.toLocaleString()} matching
          </button>
        </div>
      )}

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

      {canAssign && (selectedCount > 0 || assignMsg) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl">
          <div className="card-lit border border-primary/40 rounded-lg px-4 py-3 bg-background/95 backdrop-blur flex items-center gap-3 flex-wrap shadow-2xl">
            {selectedCount > 0 ? (
              <>
                <span className="text-sm font-medium tabular-nums shrink-0">
                  {selectedCount.toLocaleString()} selected
                </span>
                <select
                  value={repChoice}
                  onChange={e => setRepChoice(e.target.value)}
                  className="flex-1 min-w-[130px] bg-background border border-border/60 rounded-md px-2 py-2 text-sm"
                >
                  <option value="">Assign to…</option>
                  {reps.map(r => (
                    <option key={r.profile_id} value={r.profile_id}>{r.first_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!repChoice || isAssigning}
                  onClick={applyAssign}
                  className="text-[11px] uppercase tracking-[0.15em] px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-opacity shrink-0"
                >
                  {isAssigning ? 'Assigning…' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelected(new Set()); setAllMatching(false); setAssignMsg(null); }}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-primary flex-1">{assignMsg}</span>
                <button
                  type="button"
                  onClick={() => setAssignMsg(null)}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
