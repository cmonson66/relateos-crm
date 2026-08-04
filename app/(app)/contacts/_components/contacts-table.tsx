'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { LifecycleBadge } from '@/components/app/lifecycle-badge';
import { VerticalBadge } from '@/components/app/vertical-badge';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  const [chip, setChip] = useState('all');
  const [search, setSearch] = useState('');
  const [vertical, setVertical] = useState<'any' | Vertical>('any');
  const [lifecycle, setLifecycle] = useState<'any' | ContactLifecycle>('any');
  const [ownerId, setOwnerId] = useState<string>('any');
  const [tagQuery, setTagQuery] = useState('');

  const canFilterByOwner = currentRole === 'super_admin' || currentRole === 'admin' || currentRole === 'manager';
  const refineActiveCount = [
    vertical !== 'any',
    lifecycle !== 'any',
    canFilterByOwner && ownerId !== 'any',
    tagQuery.trim().length > 0,
  ].filter(Boolean).length;

  // All unique tags across visible contacts (for tag autocomplete UX later — for now just free text)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => c.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  const PAGE_SIZE = 150;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let list = contacts;

    // Primary chip filters
    if (chip === 'mine') {
      list = list.filter(c => c.owner_id === currentUserId);
    } else if (chip === 'cold') {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      list = list.filter(c => !c.last_activity_at || new Date(c.last_activity_at).getTime() < fourteenDaysAgo);
    } else if (chip === 'customers') {
      list = list.filter(c => c.lifecycle_stage === 'customer');
    } else if (chip === 'disqualified') {
      list = list.filter(c => c.lifecycle_stage === 'disqualified');
    } else if (chip === 'HOT' || chip === 'WARM' || chip === 'COOL') {
      list = list.filter(c => c.tags.includes(chip));
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
  }, [contacts, chip, search, currentUserId, vertical, lifecycle, ownerId, tagQuery, canFilterByOwner]);

  // Rendering ~10k rows (twice: desktop + mobile) locks the main thread.
  // Render a window and expand on demand; reset when filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [chip, search, vertical, lifecycle, ownerId, tagQuery]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: contacts.length },
    { id: 'mine', label: 'Mine', count: contacts.filter(c => c.owner_id === currentUserId).length },
    { id: 'cold', label: 'Going cold', count: contacts.filter(c => {
      const fourteenDaysAgo = Date.now() - 14 * 86400000;
      return !c.last_activity_at || new Date(c.last_activity_at).getTime() < fourteenDaysAgo;
    }).length },
    { id: 'HOT', label: 'Hot', count: contacts.filter(c => c.tags.includes('HOT')).length },
    { id: 'WARM', label: 'Warm', count: contacts.filter(c => c.tags.includes('WARM')).length },
    { id: 'COOL', label: 'Cool', count: contacts.filter(c => c.tags.includes('COOL')).length },
    { id: 'customers', label: 'Customers', count: contacts.filter(c => c.lifecycle_stage === 'customer').length },
    { id: 'disqualified', label: 'Disqualified', count: contacts.filter(c => c.lifecycle_stage === 'disqualified').length },
  ];

  function clearRefine() {
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4">
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <FilterChips chips={chips} activeId={chip} onChange={setChip} />
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Popover>
            <PopoverTrigger
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs uppercase tracking-[0.12em] transition-colors min-h-[36px]',
                refineActiveCount > 0
                  ? 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10'
                  : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-card'
              )}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="hidden md:inline">Refine</span>
              {refineActiveCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-primary text-primary-foreground rounded text-[9px] font-bold tabular-nums">
                  {refineActiveCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm tracking-wider">REFINE</h3>
                {refineActiveCount > 0 && (
                  <button
                    onClick={clearRefine}
                    className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Vertical</div>
                  <Select value={vertical} onValueChange={(v: string | null) => v && setVertical(v as typeof vertical)}>
                    <SelectTrigger className="h-9"><span>{vertical === 'any' ? 'Any vertical' : verticalLabel(vertical)}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any vertical</SelectItem>
                      {VERTICALS.map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Stage</div>
                  <Select value={lifecycle} onValueChange={(v: string | null) => v && setLifecycle(v as typeof lifecycle)}>
                    <SelectTrigger className="h-9"><span>{LIFECYCLE_LABEL[lifecycle]}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any stage</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="working">Working</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="disqualified">Disqualified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {canFilterByOwner && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Owner</div>
                    <Select value={ownerId} onValueChange={(v: string | null) => v && setOwnerId(v)}>
                      <SelectTrigger className="h-9"><span>{ownerLabel}</span></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any owner</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {allOwners.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.full_name || o.email.split('@')[0]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Tag contains</div>
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
              </div>
            </PopoverContent>
          </Popover>
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="md:max-w-xs" />
        </div>
      </div>

      {/* Show active refine summary as a strip when there are active filters */}
      {refineActiveCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Filters:</span>
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
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block card-lit border border-border/40 rounded-md overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_64px] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
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
            className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_0.6fr_64px] items-center gap-4 px-5 py-4 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors group min-h-[44px]"
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
    </>
  );
}

function ActivePill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-primary/40 bg-primary/10 text-primary text-[11px]">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="hover:text-primary/70"
        aria-label={`Clear ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
