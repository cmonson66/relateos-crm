'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { bulkDeleteContacts } from '../actions';
import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { ActivePill, OptionGroup, FilterButton, SheetActions } from '@/components/app/filter-sheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { LifecycleBadge } from '@/components/app/lifecycle-badge';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import { formatRelative, initials } from '@/lib/utils/format';
import type { ContactWithRefs, Vertical, ContactLifecycle } from '@/lib/db/types';
import { VERTICALS, verticalLabel } from '@/lib/verticals';

type Owner = { id: string; full_name: string | null; email: string };

const LIFECYCLE_LABEL: Record<string, string> = {
  any: 'Any stage',
  new: 'New',
  working: 'Working',
  engaged: 'Engaged',
  customer: 'Customer',
  disqualified: 'Disqualified',
};

export function ContactsTable({
  contacts,
  currentUserId,
  currentRole,
  allOwners,
}: {
  contacts: ContactWithRefs[];
  currentUserId: string;
  currentRole: string;
  allOwners: Owner[];
}) {
  const router = useRouter();
  // Band and focus used to share ONE chip rail, so "Hot" and "Mine" could not
  // both be on. Split to match accounts and the map: band stays inline, the
  // rest lives in the sheet, and they combine.
  const [band, setBand] = useState<'HOT' | 'WARM' | 'COOL' | null>(null);
  const [focus, setFocus] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [coldCutoff] = useState(() => Date.now() - 14 * 86400000);
  const [search, setSearch] = useState('');
  const [vertical, setVertical] = useState<'any' | Vertical>('any');
  const [lifecycle, setLifecycle] = useState<'any' | ContactLifecycle>('any');
  const [ownerId, setOwnerId] = useState<string>('any');
  const [tagQuery, setTagQuery] = useState('');
  // Row selection (admins only) - the cleanup path when a rep imports
  // a batch wrong and wants a do-over
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const canDelete = currentRole === 'super_admin' || currentRole === 'admin';

  const canFilterByOwner = currentRole === 'super_admin' || currentRole === 'admin' || currentRole === 'manager';

  // All unique tags across visible contacts (for tag autocomplete UX later — for now just free text)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => c.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  const PAGE_SIZE = 150;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    // Server returns id order (keyset fetch) — most-recent-first happens here
    let list = [...contacts].sort((a, b) => {
      const av = a.last_activity_at ?? a.created_at ?? '';
      const bv = b.last_activity_at ?? b.created_at ?? '';
      return bv.localeCompare(av);
    });

    if (band) {
      list = list.filter(c => c.tags.includes(band));
    }
    if (focus === 'mine') {
      list = list.filter(c => c.owner_id === currentUserId);
    } else if (focus === 'cold') {
      list = list.filter(c => !c.last_activity_at || new Date(c.last_activity_at).getTime() < coldCutoff);
    } else if (focus === 'customers') {
      list = list.filter(c => c.lifecycle_stage === 'customer');
    } else if (focus === 'disqualified') {
      list = list.filter(c => c.lifecycle_stage === 'disqualified');
    }

    // Secondary refine
    if (vertical !== 'any') {
      list = list.filter(c => c.account?.vertical === vertical);
    }
    if (lifecycle !== 'any') {
      list = list.filter(c => c.lifecycle_stage === lifecycle);
    }
    if (canFilterByOwner && ownerId !== 'any') {
      if (ownerId === 'unassigned') {
        list = list.filter(c => !c.owner_id);
      } else {
        list = list.filter(c => c.owner_id === ownerId);
      }
    }
    if (tagQuery.trim()) {
      const q = tagQuery.toLowerCase().trim();
      list = list.filter(c => c.tags.some(t => t.toLowerCase().includes(q)));
    }

    // Search
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
  }, [contacts, band, focus, search, currentUserId, vertical, lifecycle, ownerId, tagQuery, canFilterByOwner, coldCutoff]);

  // Rendering ~10k rows (twice: desktop + mobile) locks the main thread.
  // Render a window and expand on demand; reset when filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelected(new Set());
    setAllMatching(false);
  }, [band, focus, search, vertical, lifecycle, ownerId, tagQuery]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const selectedCount = allMatching ? filtered.length : selected.size;
  const allVisibleSelected = visible.length > 0 && visible.every(c => allMatching || selected.has(c.id));
  const toggleOne = (id: string) => {
    setAllMatching(false);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleVisible = () => {
    if (allVisibleSelected) { setSelected(new Set()); setAllMatching(false); }
    else setSelected(new Set(visible.map(c => c.id)));
  };
  const applyDelete = () => {
    const ids = allMatching ? filtered.map(c => c.id) : [...selected];
    if (ids.length === 0) return;
    if (!confirm(
      `Delete ${ids.length.toLocaleString()} contact${ids.length === 1 ? '' : 's'}?\n\n` +
      `Their logged activities go too. This cannot be undone.`
    )) return;
    setDeleteMsg(null);
    startDelete(async () => {
      try {
        const res = await bulkDeleteContacts(ids);
        setDeleteMsg(`Deleted ${res.contactsDeleted.toLocaleString()} contacts`);
        setSelected(new Set());
        setAllMatching(false);
      } catch (err) {
        setDeleteMsg(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  };

  const bandChips: FilterChip[] = [
    { id: 'all', label: 'All', count: contacts.length },
    { id: 'HOT', label: 'Hot', count: contacts.filter(c => c.tags.includes('HOT')).length },
    { id: 'WARM', label: 'Warm', count: contacts.filter(c => c.tags.includes('WARM')).length },
    { id: 'COOL', label: 'Cool', count: contacts.filter(c => c.tags.includes('COOL')).length },
  ];

  // Counted against the band, so the numbers move with what is already on.
  const bandBase = band ? contacts.filter(c => c.tags.includes(band)) : contacts;

  const focusOptions = [
    { value: 'all', label: 'Everyone', count: contacts.length },
    { value: 'mine', label: 'Mine', count: bandBase.filter(c => c.owner_id === currentUserId).length },
    {
      value: 'cold',
      label: 'Going cold',
      count: bandBase.filter(
        c => !c.last_activity_at || new Date(c.last_activity_at).getTime() < coldCutoff
      ).length,
    },
    { value: 'customers', label: 'Customers', count: bandBase.filter(c => c.lifecycle_stage === 'customer').length },
    { value: 'disqualified', label: 'Disqualified', count: bandBase.filter(c => c.lifecycle_stage === 'disqualified').length },
  ];

  const verticalOptions = [
    { value: 'any', label: 'All verticals', count: contacts.length },
    ...VERTICALS.map(v => ({
      value: v.value,
      label: v.label,
      count: bandBase.filter(c => c.account?.vertical === v.value).length,
    })),
  ];

  const stageOptions = [
    { value: 'any', label: 'Any stage', count: contacts.length },
    ...(['new', 'working', 'engaged', 'customer', 'disqualified'] as const).map(st => ({
      value: st,
      label: LIFECYCLE_LABEL[st],
      count: bandBase.filter(c => c.lifecycle_stage === st).length,
    })),
  ];

  const ownerOptions = [
    { value: 'any', label: 'Anyone', count: contacts.length },
    ...allOwners.map(o => ({
      value: o.id,
      label: o.full_name || o.email.split('@')[0],
      count: contacts.filter(c => c.owner_id === o.id).length,
    })),
    { value: 'unassigned', label: 'Unassigned', count: contacts.filter(c => !c.owner_id).length },
  ];

  const activeCount =
    (focus !== 'all' ? 1 : 0) +
    (vertical !== 'any' ? 1 : 0) +
    (lifecycle !== 'any' ? 1 : 0) +
    (canFilterByOwner && ownerId !== 'any' ? 1 : 0) +
    (tagQuery.trim() ? 1 : 0);

  const optLabel = (opts: { value: string; label: string }[], v: string) =>
    opts.find(o => o.value === v)?.label ?? v;


  function clearAll() {
    setFocus('all');
    setVertical('any');
    setLifecycle('any');
    setOwnerId('any');
    setTagQuery('');
  }

  const ownerLabel = (() => {
    if (ownerId === 'any') return 'Any owner';
    if (ownerId === 'unassigned') return 'Unassigned';
    const o = allOwners.find(x => x.id === ownerId);
    return o ? (o.full_name || o.email.split('@')[0]) : 'Any owner';
  })();

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <FilterChips
            chips={bandChips}
            activeId={band ?? 'all'}
            onChange={(id) => setBand(id === 'all' ? null : (id as 'HOT' | 'WARM' | 'COOL'))}
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterButton activeCount={activeCount} onClick={() => setSheetOpen(true)} />
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="min-w-[160px] flex-1 md:w-72 md:flex-none"
          />
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          {focus !== 'all' && (
            <ActivePill label={optLabel(focusOptions, focus)} onClear={() => setFocus('all')} />
          )}
          {vertical !== 'any' && (
            <ActivePill label={verticalLabel(vertical)} onClear={() => setVertical('any')} />
          )}
          {lifecycle !== 'any' && (
            <ActivePill label={LIFECYCLE_LABEL[lifecycle]} onClear={() => setLifecycle('any')} />
          )}
          {canFilterByOwner && ownerId !== 'any' && (
            <ActivePill label={ownerLabel} onClear={() => setOwnerId('any')} />
          )}
          {tagQuery.trim() && (
            <ActivePill label={`tag: ${tagQuery}`} onClear={() => setTagQuery('')} />
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
        <div className={`grid ${canDelete ? 'grid-cols-[28px_2fr_2fr_1fr_1fr_1fr_0.6fr_64px]' : 'grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_64px]'} items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30`}>
          {canDelete && (
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisible}
              className="h-3.5 w-3.5 accent-primary cursor-pointer"
              aria-label="Select visible contacts"
            />
          )}
          <div>Contact</div>
          <div>Account</div>
          <div>Stage</div>
          <div>Owner</div>
          <div>Email</div>
          <div className="text-right">Last activity</div>
          <div></div>
        </div>
        {visible.map(c => (
          <Link key={c.id} href={`/contacts/${c.id}`}
            className={`grid ${canDelete ? 'grid-cols-[28px_2fr_2fr_1fr_1fr_1fr_0.6fr_64px]' : 'grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_64px]'} items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group min-h-[44px]`}
          >
            {canDelete && (
              <input
                type="checkbox"
                checked={allMatching || selected.has(c.id)}
                onChange={() => toggleOne(c.id)}
                onClick={e => { e.stopPropagation(); e.preventDefault(); toggleOne(c.id); }}
                className="h-3.5 w-3.5 accent-primary cursor-pointer"
                aria-label={`Select ${c.first_name}`}
              />
            )}
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
            <div className="flex items-center justify-end gap-1.5">
              {c.account && (
                <button
                  type="button"
                  title="Show on map"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/map?focus=${c.account!.id}`);
                  }}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                </button>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
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
        {visible.map(c => (
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
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {c.account && (
                      <button
                        type="button"
                        title="Show on map"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/map?focus=${c.account!.id}`);
                        }}
                        className="p-1.5 -m-0.5 rounded-md text-muted-foreground/40 active:text-primary active:bg-primary/10 transition-colors"
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
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

      {canDelete && (selectedCount > 0 || deleteMsg) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl">
          <div className="card-lit border border-destructive/40 rounded-lg px-4 py-3 bg-background/95 backdrop-blur flex items-center gap-3 flex-wrap shadow-2xl">
            {selectedCount > 0 ? (
              <>
                <span className="text-sm font-medium tabular-nums flex-1">
                  {selectedCount.toLocaleString()} selected
                  {!allMatching && filtered.length > visible.length && selected.size === visible.length && (
                    <button type="button" onClick={() => setAllMatching(true)} className="ml-2 text-primary underline text-xs">
                      select all {filtered.length.toLocaleString()} matching
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={applyDelete}
                  className="text-[11px] uppercase tracking-[0.15em] px-4 py-2 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors shrink-0"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelected(new Set()); setAllMatching(false); setDeleteMsg(null); }}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-primary flex-1">{deleteMsg}</span>
                <button type="button" onClick={() => setDeleteMsg(null)} className="text-[11px] uppercase tracking-[0.15em] px-3 py-2 text-muted-foreground hover:text-foreground">
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
              {filtered.length.toLocaleString()} of {contacts.length.toLocaleString()} contacts
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            {canFilterByOwner && (
              <OptionGroup title="Owner" options={ownerOptions} value={ownerId} onChange={setOwnerId} />
            )}
            <OptionGroup title="Show" options={focusOptions} value={focus} onChange={setFocus} />
            <OptionGroup
              title="Vertical"
              options={verticalOptions}
              value={vertical}
              onChange={v => setVertical(v as typeof vertical)}
            />
            <OptionGroup
              title="Stage"
              options={stageOptions}
              value={lifecycle}
              onChange={v => setLifecycle(v as typeof lifecycle)}
            />

            <div className="border-b border-border/30 py-3 last:border-0">
              <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Tag</div>
              <Input
                value={tagQuery}
                onChange={e => setTagQuery(e.target.value)}
                placeholder={allTags.length ? `e.g. ${allTags[0]}` : 'champion, q3-target…'}
                className="h-9"
                list="contacts-tag-list"
              />
              <datalist id="contacts-tag-list">
                {allTags.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            <SheetActions
              count={filtered.length}
              noun="contact"
              activeCount={activeCount}
              onDone={() => setSheetOpen(false)}
              onClear={clearAll}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

