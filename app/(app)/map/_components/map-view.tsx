'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { VERTICALS, verticalLabel } from '@/lib/verticals';
import { cn } from '@/lib/utils';
import { computeCryptoStats, ATM_COLOR, type CryptoSignal } from '@/lib/crypto/density';
import { useMyLocation, milesBetween } from './my-location';

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
  'text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-md border transition-colors';

export function MapView({
  accounts,
  signals = [],
  focusId = null,
}: {
  accounts: MapAccount[];
  signals?: CryptoSignal[];
  focusId?: string | null;
}) {
  const [band, setBand] = useState('all');
  const [vertical, setVertical] = useState('all');
  const [fitSignal, setFitSignal] = useState(0);
  const [followSignal, setFollowSignal] = useState(0);
  // Miles from where the rep is standing. null = the whole book.
  const [radius, setRadius] = useState<number | null>(null);
  const { fix, error: locError, watching, start, stop } = useMyLocation();
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
    return filtered.filter(a => milesBetween(fix, { lat: a.lat, lng: a.lng }) <= radius);
  }, [filtered, fix, radius]);

  // Computed over the full account set, not the filtered one, so the
  // percentile means the same thing no matter which chips are active.
  // Deliberately not keyed on the filters — this runs once per data load.
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

  const verticalChips: FilterChip[] = [
    { id: 'all', label: 'All verticals', count: accounts.length },
    ...VERTICALS.map(v => ({
      id: v.value,
      label: v.label,
      count: accounts.filter(a => a.vertical === v.value).length,
    })),
  ];

  if (accounts.length === 0) {
    return (
      <div className="card-lit border border-border/40 rounded-md p-10 text-center text-muted-foreground">
        No mapped accounts yet — accounts appear here once they have coordinates.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <FilterChips chips={bandChips} activeId={band} onChange={setBand} />
      </div>
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <FilterChips chips={verticalChips} activeId={vertical} onChange={setVertical} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {nearby.length} doors on the map
          {vertical !== 'all' ? ` · ${verticalLabel(vertical)}` : ''}
          {band !== 'all' ? ` · ${band}` : ''}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-pressed={nativeOnly}
            onClick={() => setNativeOnly(v => !v)}
            className={cn(
              CONTROL,
              'inline-flex items-center gap-2',
              nativeOnly
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: nativeOnly ? '#34d399' : 'currentColor' }}
            />
            Crypto native
            <span className="font-mono text-[10px] normal-case tracking-normal opacity-70">
              {accounts.filter(a => a.cryptoNative).length}
            </span>
          </button>

          {signals.length > 0 && (
            <>
              <button
                type="button"
                aria-pressed={showHeat}
                onClick={() => setShowHeat(v => !v)}
                className={cn(
                  CONTROL,
                  'inline-flex items-center gap-2',
                  showHeat
                    ? 'border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: showHeat ? ATM_COLOR : 'currentColor' }}
                />
                Crypto density
                <span className="font-mono text-[10px] normal-case tracking-normal opacity-70">
                  {signals.length}
                </span>
              </button>

              {showHeat && (
                <div className="inline-flex rounded-md border border-border/40 overflow-hidden">
                  {(
                    [
                      ['all', 'All'],
                      ['atm', 'ATMs'],
                      ['merchant', 'Accepting'],
                    ] as [HeatFilter, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={heatFilter === id}
                      onClick={() => setHeatFilter(id)}
                      className={cn(
                        'text-[11px] uppercase tracking-[0.15em] px-2.5 py-1.5 border-r border-border/40 last:border-r-0 transition-colors',
                        heatFilter === id
                          ? 'bg-fuchsia-500/15 text-fuchsia-200'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (!watching && !fix) start();
              setFollowSignal(n => n + 1);
            }}
            title="Show where you are"
            className={cn(
              CONTROL,
              fix
                ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            )}
          >
            {watching && !fix ? 'Finding you...' : 'Near me'}
          </button>

          {fix && (
            <>
              {[1, 3, 10].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRadius(radius === m ? null : m)}
                  className={cn(
                    CONTROL,
                    radius === m
                      ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                      : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  {m} mi
                </button>
              ))}
              <button
                type="button"
                onClick={() => { stop(); setRadius(null); }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Stop
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setFitSignal(n => n + 1)}
            className={cn(
              CONTROL,
              'border-border/40 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            )}
          >
            Fit view
          </button>
        </div>
      </div>

      {locError && <p className="mb-2 text-[12px] text-destructive">{locError}</p>}

      {fix && radius && (
        <p className="mb-2 text-[12px] text-muted-foreground">
          {nearby.length} shop{nearby.length === 1 ? '' : 's'} within {radius} mile
          {radius === 1 ? '' : 's'} of you
        </p>
      )}

      <LeafletMap
        accounts={nearby}
        myFix={fix}
        followSignal={followSignal}
        focusId={focusId}
        fitSignal={fitSignal}
        signals={signals}
        showHeat={showHeat}
        heatFilter={heatFilter}
        cryptoStats={cryptoStats}
      />
    </div>
  );
}
