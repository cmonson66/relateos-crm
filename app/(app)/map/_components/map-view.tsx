'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Crosshair, Maximize2, X, Globe } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { VERTICALS, verticalLabel } from '@/lib/verticals';
import { cn } from '@/lib/utils';
import { computeCryptoStats, ATM_COLOR, type CryptoSignal } from '@/lib/crypto/density';
import { useMyLocation, milesBetween, hasLocationConsent } from './my-location';

export type MapAccount = {
  id: string;
  name: string;
  vertical: string;
  city: string | null;
  lat: number;
  lng: number;
  band: string;
  phone: string | null;
  contactName: string | null;
  stage: string;
  cryptoNative?: boolean;
};

export type MapRegion = { id: string; code: string; name: string };

type HeatFilter = 'all' | 'atm' | 'merchant';

// Leaflet touches `window`, so the actual map only loads client-side
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] rounded-md border border-border/40 flex items-center justify-center text-muted-foreground text-sm">
      Loading map…
    </div>
  ),
});

const CONTROL =
  'text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5';
const IDLE = 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50';

/** A filter that is ON, rendered as a removable pill under the bar. */
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

function ToggleRow({
  label, hint, on, onToggle, count, dotColor, children,
}: {
  label: string; hint?: string; on: boolean; onToggle: () => void;
  count?: number; dotColor?: string; children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/30 py-3 last:border-0">
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: on ? (dotColor ?? '#34d399') : 'currentColor', opacity: on ? 1 : 0.4 }}
            />
            {label}
            {count != null && (
              <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
            )}
          </span>
          {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <span
          className={cn(
            'h-5 w-9 shrink-0 rounded-full border transition-colors',
            on ? 'border-primary/50 bg-primary/30' : 'border-border/50 bg-muted/40'
          )}
        >
          <span
            className={cn(
              'mt-px block h-4 w-4 rounded-full bg-foreground/80 transition-transform',
              on ? 'translate-x-4' : 'translate-x-0.5'
            )}
          />
        </span>
      </button>
      {on && children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function MapView({
  accounts,
  signals = [],
  focusId = null,
  regions = [],
  activeRegionId = null,
}: {
  accounts: MapAccount[];
  signals?: CryptoSignal[];
  focusId?: string | null;
  /** Only populated for corporate. A rep or manager gets exactly one region
   *  through RLS and never sees this control. */
  regions?: MapRegion[];
  activeRegionId?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [band, setBand] = useState('all');
  const [vertical, setVertical] = useState('all');
  const [fitSignal, setFitSignal] = useState(0);
  const [followSignal, setFollowSignal] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Miles from where the rep is standing. null = the whole book.
  // Opens on a 3 mile view. The sheet can widen or clear it.
  const [radius, setRadius] = useState<number | null>(3);
  const { fix, error: locError, watching, start, stop } = useMyLocation();

  // Locate on arrival ONLY if this rep has allowed it here before. The
  // first request always comes from a deliberate tap, because a cold
  // prompt on page load gets denied on reflex and the denial sticks.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    // A ?focus= arrival owns the view - the rep clicked Map from a specific
    // shop and wants to see that shop, not wherever they are standing.
    if (focusId) return;
    if (hasLocationConsent()) start();
  }, [start, focusId]);

  const [nativeOnly, setNativeOnly] = useState(false);
  const [showHeat, setShowHeat] = useState(false);
  const [heatFilter, setHeatFilter] = useState<HeatFilter>('all');

  const filtered = useMemo(() => {
    let list = accounts;
    if (band !== 'all') list = list.filter(a => a.band === band);
    if (vertical !== 'all') list = list.filter(a => a.vertical === vertical);
    if (nativeOnly) list = list.filter(a => a.cryptoNative);
    return list;
  }, [accounts, band, vertical, nativeOnly]);

  // Tighten to what a rep could actually walk or drive to right now. Straight
  // line rather than driving distance - it only has to be right enough to
  // decide which shops are worth the next hour.
  const nearby = useMemo(() => {
    if (!fix || !radius) return filtered;
    return filtered.filter(
      a =>
        // never filter out the shop the rep came here to look at
        a.id === focusId || milesBetween(fix, { lat: a.lat, lng: a.lng }) <= radius,
    );
  }, [filtered, fix, radius, focusId]);

  // Computed over the full account set, not the filtered one, so the
  // percentile means the same thing no matter which filters are active.
  const cryptoStats = useMemo(
    () => computeCryptoStats(accounts, signals),
    [accounts, signals]
  );

  const bandChips: FilterChip[] = [
    { id: 'all', label: 'All', count: accounts.length },
    { id: 'HOT', label: 'Hot', count: accounts.filter(a => a.band === 'HOT').length },
    { id: 'WARM', label: 'Warm', count: accounts.filter(a => a.band === 'WARM').length },
    { id: 'COOL', label: 'Cool', count: accounts.filter(a => a.band === 'COOL').length },
  ];

  // Everything the sheet owns. The number rides on the Filters button so the
  // bar can stay collapsed without hiding that something is narrowing the map.
  const activeCount =
    (vertical !== 'all' ? 1 : 0) +
    (nativeOnly ? 1 : 0) +
    (showHeat ? 1 : 0) +
    (fix && radius ? 1 : 0);

  function clearAll() {
    setVertical('all');
    setNativeOnly(false);
    setShowHeat(false);
    setRadius(null);
  }

  function goToRegion(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id === 'all') next.delete('region');
    else next.set('region', id);
    // focus belongs to a shop in the region being left behind
    next.delete('focus');
    router.push(`/map${next.toString() ? `?${next.toString()}` : ''}`);
  }

  // An empty region used to return early and render nothing but a message,
  // which took the region picker with it - switching to a region with no
  // shops yet was a one-way trip that could only be undone by editing the
  // URL. The bar stays; only the map is replaced.
  const isEmpty = accounts.length === 0;
  const activeRegion = regions.find(r => r.id === activeRegionId);
  const regionLabel = activeRegion ? activeRegion.code : 'All regions';

  return (
    <div className="space-y-3">
      {/* Band stays in reach: it is the one filter a rep touches all day. */}
      {!isEmpty && (
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <FilterChips chips={bandChips} activeId={band} onChange={setBand} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          <span className="text-foreground">{nearby.length}</span> doors
          {activeRegion && <span className="ml-1.5 text-muted-foreground/70">· {activeRegion.code}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {regions.length > 1 && (
            <Select value={activeRegionId ?? 'all'} onValueChange={(v: string | null) => v && goToRegion(v)}>
              <SelectTrigger
                className="h-[30px] w-auto max-w-[9rem] gap-1.5 rounded-md border-border/40 px-2.5 text-[11px] uppercase tracking-[0.15em]"
                aria-label="Region"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {/* An explicit label, not SelectValue. This Select renders the
                    raw value, so SelectValue printed the region's UUID across
                    the whole bar. Same reason user-admin-table uses a span. */}
                <span className="truncate">{regionLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isEmpty && (
          <>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(CONTROL, activeCount > 0 ? 'border-primary/50 bg-primary/10 text-primary' : IDLE)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/25 px-1.5 font-mono text-[10px] normal-case tracking-normal">
                {activeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!watching && !fix) start();
              setFollowSignal(n => n + 1);
            }}
            title="Show where you are"
            aria-label="Show where you are"
            className={cn(CONTROL, fix ? 'border-blue-500/60 bg-blue-500/10 text-blue-300' : IDLE)}
          >
            <Crosshair className={cn('h-3.5 w-3.5', watching && !fix && 'animate-pulse')} />
            <span className="hidden sm:inline">{watching && !fix ? 'Finding you...' : 'Near me'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFitSignal(n => n + 1)}
            title="Fit view"
            aria-label="Fit view"
            className={cn(CONTROL, IDLE)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fit</span>
          </button>
          </>
          )}
        </div>
      </div>

      {/* What is currently narrowing the map, and one tap to undo each. */}
      {!isEmpty && activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {vertical !== 'all' && (
            <ActivePill label={verticalLabel(vertical)} onClear={() => setVertical('all')} />
          )}
          {nativeOnly && <ActivePill label="Crypto native" onClear={() => setNativeOnly(false)} />}
          {showHeat && (
            <ActivePill
              label={heatFilter === 'all' ? 'Density' : heatFilter === 'atm' ? 'Density: ATMs' : 'Density: accepting'}
              onClear={() => setShowHeat(false)}
            />
          )}
          {fix && radius && (
            <ActivePill label={`Within ${radius} mi`} onClear={() => setRadius(null)} />
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

      {locError && <p className="text-[12px] text-destructive">{locError}</p>}

      {isEmpty ? (
        <div className="card-lit rounded-md border border-border/40 p-10 text-center text-muted-foreground">
          {activeRegionId
            ? 'No mapped shops in this region yet - they appear here once they have coordinates.'
            : 'No mapped accounts yet - accounts appear here once they have coordinates.'}
        </div>
      ) : (
      <LeafletMap
        accounts={nearby}
        myFix={fix}
        followSignal={followSignal}
        radiusMiles={fix ? radius : null}
        focusId={focusId}
        fitSignal={fitSignal}
        signals={signals}
        showHeat={showHeat}
        heatFilter={heatFilter}
        cryptoStats={cryptoStats}
      />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              {nearby.length} of {accounts.length} shops showing.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="border-b border-border/30 py-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Vertical
              </div>
              {/* A dropdown, not chips. Two dozen verticals on a scrolling
                  rail pushed the map off the bottom of a phone. */}
              <Select value={vertical} onValueChange={(v: string | null) => v && setVertical(v)}>
                <SelectTrigger>
                  <span>{vertical === 'all' ? `All verticals (${accounts.length})` : verticalLabel(vertical)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verticals ({accounts.length})</SelectItem>
                  {VERTICALS.map(v => {
                    const n = accounts.filter(a => a.vertical === v.value).length;
                    return (
                      <SelectItem key={v.value} value={v.value} disabled={n === 0}>
                        {v.label} ({n})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <ToggleRow
              label="Crypto native"
              hint="Shops already taking crypto"
              on={nativeOnly}
              onToggle={() => setNativeOnly(v => !v)}
              count={accounts.filter(a => a.cryptoNative).length}
            />

            {signals.length > 0 && (
              <ToggleRow
                label="Crypto density"
                hint="ATMs and accepting merchants nearby"
                on={showHeat}
                onToggle={() => setShowHeat(v => !v)}
                count={signals.length}
                dotColor={ATM_COLOR}
              >
                <div className="inline-flex overflow-hidden rounded-md border border-border/40">
                  {([['all', 'All'], ['atm', 'ATMs'], ['merchant', 'Accepting']] as [HeatFilter, string][]).map(
                    ([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={heatFilter === id}
                        onClick={() => setHeatFilter(id)}
                        className={cn(
                          'border-r border-border/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition-colors last:border-r-0',
                          heatFilter === id
                            ? 'bg-fuchsia-500/15 text-fuchsia-200'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </ToggleRow>
            )}

            <div className="py-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Distance from you
              </div>
              {!fix ? (
                <button
                  type="button"
                  onClick={() => { start(); setFollowSignal(n => n + 1); }}
                  className={cn(CONTROL, IDLE)}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  {watching ? 'Finding you...' : 'Find me first'}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 3, 10].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setRadius(radius === m ? null : m); setFollowSignal(n => n + 1); }}
                      className={cn(
                        CONTROL,
                        radius === m ? 'border-blue-500/60 bg-blue-500/10 text-blue-300' : IDLE
                      )}
                    >
                      {m} mi
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRadius(null)}
                    className={cn(CONTROL, radius === null ? 'border-blue-500/60 bg-blue-500/10 text-blue-300' : IDLE)}
                  >
                    Any
                  </button>
                  <button
                    type="button"
                    onClick={() => { stop(); setRadius(null); }}
                    className="ml-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Stop tracking
                  </button>
                </div>
              )}
              {fix && radius && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {nearby.length} shop{nearby.length === 1 ? '' : 's'} within {radius} mile
                  {radius === 1 ? '' : 's'} of you
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 rounded-md bg-primary/90 px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
              >
                Show {nearby.length} door{nearby.length === 1 ? '' : 's'}
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
    </div>
  );
}
