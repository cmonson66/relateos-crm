'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { bulkAssignAccounts, bulkDeleteAccounts } from '../actions';
import { bulkSetCampaignEligibility } from '../campaign-actions';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { RegionSwitcher } from '@/components/app/region-switcher';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SlidersHorizontal, X } from 'lucide-react';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { AccountWithOwner } from '@/lib/db/types';
import { VERTICALS } from '@/lib/verticals';
import { CryptoScoreBadge } from '@/components/app/crypto-score-badge';

type SortKey = 'recent' | 'crypto' | 'city' | 'name';

type Opt = { value: string; label: string; count: number };

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
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

/** A labelled list of options with counts. Zero-count options are disabled
 *  rather than hidden, so the absence of a vertical in a region is visible
 *  rather than mysterious. */
function OptionGroup({
  title, options, value, onChange,
}: { title: string; options: Opt[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="border-b border-border/30 py-3 last:border-0">
      <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            disabled={o.count === 0 && o.value !== value}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-35 ${
              o.value === value
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
            <span className="ml-1.5 font-mono text-[10px] opacity-70">{o.count.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AccountsTable({
  accounts,
  currentUserId,
  reps = [],
  canAssign = false,
  regions = [],
  activeRegionId = null,
}: {
  accounts: (AccountWithOwner & { crypto_native?: boolean | null })[];
  currentUserId: string;
  reps?: { profile_id: string; first_name: string; can_send?: boolean }[];
  canAssign?: boolean;
  /** Corporate only. A rep or manager is fenced to one region by RLS. */
  regions?: { id: string; code: string; name: string }[];
  activeRegionId?: string | null;
}) {
  // Vertical and focus used to share ONE state, so picking Barber cleared
  // "Mine" and vice versa - the reason they had to live on one chip rail of
  // twenty-eight. They are separate dimensions now and combine freely.
  const [vertical, setVertical] = useState('all');
  const [focus, setFocus] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  // Date.now() during render is impure and the purity rule rightly flags it.
  // A lazy initializer runs once per mount, which is also more correct: the
  // cutoff should not drift while someone is reading the list.
  const [coldCutoff] = useState(() => Date.now() - 14 * 86400000);
  // Band is its own dimension - it COMBINES with the category chips
  // (Hot + Med Spa, Warm + Pool/Landscape, etc.)
  const [bandFilter, setBandFilter] = useState<'HOT' | 'WARM' | 'COOL' | null>(null);
  // Owner is a third dimension - combines with band and category
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [isDeleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [repChoice, setRepChoice] = useState('');
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [isAssigning, startAssign] = useTransition();
  const [isCampaigning, startCampaign] = useTransition();

  const hasCrypto = accounts.some(a => a.crypto_score !== null && a.crypto_score !== undefined);

  const PAGE_SIZE = 150;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = accounts;
    if (bandFilter) {
      list = list.filter(a => a.tags.includes(bandFilter));
    }
    if (ownerFilter) {
      list = ownerFilter === 'unassigned'
        ? list.filter(a => !a.owner_id)
        : list.filter(a => a.owner_id === ownerFilter);
    }
    if (vertical !== 'all') {
      list = list.filter(a => a.vertical === vertical);
    }
    if (focus === 'mine') {
      list = list.filter(a => a.owner_id === currentUserId);
    } else if (focus === 'hold') {
      list = list.filter(a => a.tags.includes('HOLD'));
    } else if (focus === 'crypto-native-flag') {
      list = list.filter(a => a.crypto_native);
    } else if (focus === 'crypto') {
      list = list.filter(a => (a.crypto_score ?? 0) >= 70);
    } else if (focus === 'cold') {
      list = list.filter(a => !a.last_activity_at || new Date(a.last_activity_at).getTime() < coldCutoff);
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
    if (sort === 'recent') {
      // Server now returns id order (keyset fetch) — recency sorts here
      list = [...list].sort((a, b) => {
        const av = a.last_activity_at ?? a.created_at ?? '';
        const bv = b.last_activity_at ?? b.created_at ?? '';
        return bv.localeCompare(av);
      });
    } else if (sort === 'crypto') {
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
  }, [accounts, vertical, focus, bandFilter, ownerFilter, search, currentUserId, sort, coldCutoff]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    // A changed view means a changed meaning of "selected" — start clean
    setSelected(new Set());
    setAllMatching(false);
  }, [vertical, focus, bandFilter, ownerFilter, search, sort]);

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

  const applyDelete = () => {
    const ids = allMatching ? filtered.map(a => a.id) : [...selected];
    if (ids.length === 0) return;
    const who = ownerFilter
      ? ` owned by ${reps.find(r => r.profile_id === ownerFilter)?.first_name ?? (ownerFilter === 'unassigned' ? 'nobody' : 'this rep')}`
      : '';
    if (!confirm(
      `Delete ${ids.length.toLocaleString()} account${ids.length === 1 ? '' : 's'}${who}?\n\n` +
      `Their contacts, activities and deals go too. This cannot be undone.`
    )) return;
    setAssignMsg(null);
    setDeleting(true);
    startAssign(async () => {
      try {
        const res = await bulkDeleteAccounts(ids);
        setAssignMsg(`Deleted ${res.accountsDeleted.toLocaleString()} accounts (+${res.contactsDeleted.toLocaleString()} contacts)`);
        setSelected(new Set());
        setAllMatching(false);
      } catch (err) {
        setAssignMsg(err instanceof Error ? err.message : 'Delete failed');
      } finally {
        setDeleting(false);
      }
    });
  };

  const applyCampaign = (include: boolean) => {
    if (selectedCount === 0) return;
    const ids = allMatching ? filtered.map(a => a.id) : [...selected];
    setAssignMsg(null);
    startCampaign(async () => {
      const res = await bulkSetCampaignEligibility({ accountIds: ids, include });
      if (!res.ok) { setAssignMsg(res.message); return; }
      // Say what did NOT happen too - a silent partial is worse than a number.
      const skipped: string[] = [];
      if (res.noLead) skipped.push(`${res.noLead} not linked to the lead pool`);
      if (res.noEmail) skipped.push(`${res.noEmail} with no email`);
      setAssignMsg(
        `${include ? 'Added' : 'Removed'} ${res.changed.toLocaleString()} shops` +
          (skipped.length ? ` · skipped ${skipped.join(', ')}` : '')
      );
      setSelected(new Set());
      setAllMatching(false);
    });
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

  // Count bases: each dimension's counts reflect the OTHER dimension's pick
  const bandBase = useMemo(
    () => (bandFilter ? accounts.filter(a => a.tags.includes(bandFilter)) : accounts),
    [accounts, bandFilter]
  );
  const categoryBase = useMemo(() => {
    let list = accounts;
    if (vertical !== 'all') list = list.filter(a => a.vertical === vertical);
    if (focus === 'mine') list = list.filter(a => a.owner_id === currentUserId);
    else if (focus === 'crypto-native-flag') list = list.filter(a => a.crypto_native);
    else if (focus === 'hold') list = list.filter(a => a.tags.includes('HOLD'));
    else if (focus === 'crypto') list = list.filter(a => (a.crypto_score ?? 0) >= 70);
    else if (focus === 'cold') {
      list = list.filter(a => !a.last_activity_at || new Date(a.last_activity_at).getTime() < coldCutoff);
    }
    return list;
  }, [accounts, vertical, focus, currentUserId, coldCutoff]);

  const bandChips: FilterChip[] = (['HOT', 'WARM', 'COOL'] as const).map(b => ({
    id: b,
    label: b.charAt(0) + b.slice(1).toLowerCase(),
    count: categoryBase.filter(a => a.tags.includes(b)).length,
  }));

  // Was a single rail of ~28 chips: All, Mine, Crypto Native, On hold, all
  // 23 verticals, Crypto 70+ and Going cold. Split into two dropdowns the
  // filter sheet owns, counted against everything else that is active.
  const verticalOptions = VERTICALS.map(v => ({
    value: v.value,
    label: v.label,
    count: bandBase.filter(a => a.vertical === v.value).length,
  }));

  const focusOptions = [
    { value: 'all', label: 'Everything', count: accounts.length },
    { value: 'mine', label: 'Mine', count: accounts.filter(a => a.owner_id === currentUserId).length },
    { value: 'crypto-native-flag', label: 'Crypto native', count: bandBase.filter(a => a.crypto_native).length },
    ...(accounts.some(a => a.tags.includes('HOLD'))
      ? [{ value: 'hold', label: 'On compliance hold', count: bandBase.filter(a => a.tags.includes('HOLD')).length }]
      : []),
    ...(hasCrypto
      ? [{ value: 'crypto', label: 'Crypto density 70+', count: accounts.filter(a => (a.crypto_score ?? 0) >= 70).length }]
      : []),
    {
      value: 'cold',
      label: 'Going cold',
      count: accounts.filter(
        a => !a.last_activity_at || new Date(a.last_activity_at).getTime() < coldCutoff
      ).length,
    },
  ];

  const ownerOptions = [
    { value: 'all', label: 'Anyone', count: accounts.length },
    ...reps.map(r => ({
      value: r.profile_id,
      label: r.first_name,
      count: accounts.filter(a => a.owner_id === r.profile_id).length,
    })),
    { value: 'unassigned', label: 'Unassigned', count: accounts.filter(a => !a.owner_id).length },
  ];

  const activeCount =
    (vertical !== 'all' ? 1 : 0) +
    (focus !== 'all' ? 1 : 0) +
    (ownerFilter ? 1 : 0) +
    (sort !== 'recent' ? 1 : 0);

  const clearAll = () => {
    setVertical('all');
    setFocus('all');
    setOwnerFilter(null);
    setSort('recent');
  };

  const label = (opts: { value: string; label: string }[], v: string) =>
    opts.find(o => o.value === v)?.label ?? v;


  return (
    <>
      {regions.length > 1 && (
        <div className="mb-3">
          <RegionSwitcher
            regions={regions}
            activeId={activeRegionId}
            basePath="/accounts"
            allowAll
          />
        </div>
      )}

      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        {/* Band is the one filter that gets touched all day. Everything else
            lives in the sheet. */}
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <FilterChips
            chips={bandChips}
            activeId={bandFilter ?? ''}
            onChange={(id) => setBandFilter(cur => (cur === id ? null : (id as 'HOT' | 'WARM' | 'COOL')))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors ${
              activeCount > 0
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/25 px-1.5 font-mono text-[10px] normal-case tracking-normal">
                {activeCount}
              </span>
            )}
          </button>
          <Input
            placeholder="Search name, city, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="min-w-[160px] flex-1 md:w-72 md:flex-none"
          />
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {vertical !== 'all' && (
            <ActivePill label={label(verticalOptions, vertical)} onClear={() => setVertical('all')} />
          )}
          {focus !== 'all' && (
            <ActivePill label={label(focusOptions, focus)} onClear={() => setFocus('all')} />
          )}
          {ownerFilter && (
            <ActivePill label={label(ownerOptions, ownerFilter)} onClear={() => setOwnerFilter(null)} />
          )}
          {sort !== 'recent' && (
            <ActivePill label={`Sorted by ${sort}`} onClear={() => setSort('recent')} />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear
          </button>
        </div>
      )}

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
              <div className="font-medium truncate flex items-center gap-1.5">
                {a.name}
                {a.tags.includes('HOLD') && (
                  <span className="shrink-0 rounded border border-destructive/50 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-destructive">
                    HOLD
                  </span>
                )}
              </div>
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
            No accounts match these filters. Re-tap a chip to clear it.
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
            No accounts match these filters. Re-tap a chip to clear it.
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
                    <option key={r.profile_id} value={r.profile_id}>
                      {r.first_name}{r.can_send === false ? ' (no email identity yet)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isCampaigning}
                  title="Make these shops eligible for campaign email"
                  onClick={() => applyCampaign(true)}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 rounded-md border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 shrink-0 disabled:opacity-50"
                >
                  {isCampaigning ? 'Working…' : '+ Campaign'}
                </button>
                <button
                  type="button"
                  disabled={isCampaigning}
                  title="Stop campaign email to these shops"
                  onClick={() => applyCampaign(false)}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 rounded-md border border-border/60 text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50"
                >
                  - Campaign
                </button>
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
                  disabled={isAssigning || isDeleting}
                  onClick={applyDelete}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors shrink-0"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              {filtered.length.toLocaleString()} of {accounts.length.toLocaleString()} accounts
              {activeRegionId && regions.length > 1
                ? ` in ${regions.find(r => r.id === activeRegionId)?.code ?? 'this region'}`
                : ''}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            {canAssign && (
              <OptionGroup
                title="Owner"
                options={ownerOptions}
                value={ownerFilter ?? 'all'}
                onChange={v => setOwnerFilter(v === 'all' ? null : v)}
              />
            )}
            <OptionGroup title="Show" options={focusOptions} value={focus} onChange={setFocus} />
            <OptionGroup
              title="Vertical"
              options={[{ value: 'all', label: 'All verticals', count: accounts.length }, ...verticalOptions]}
              value={vertical}
              onChange={setVertical}
            />
            <OptionGroup
              title="Sort by"
              options={[
                { value: 'recent', label: 'Recent activity', count: filtered.length },
                { value: 'city', label: 'City', count: filtered.length },
                { value: 'name', label: 'Name', count: filtered.length },
                ...(hasCrypto ? [{ value: 'crypto', label: 'Crypto density', count: filtered.length }] : []),
              ]}
              value={sort}
              onChange={v => setSort(v as SortKey)}
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 rounded-md bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
              >
                Show {filtered.length.toLocaleString()} account{filtered.length === 1 ? '' : 's'}
              </button>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-md border border-border/40 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
