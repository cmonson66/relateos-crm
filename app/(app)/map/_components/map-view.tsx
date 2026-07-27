'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { VERTICALS, verticalLabel } from '@/lib/verticals';

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
};

// Leaflet touches `window`, so the actual map only loads client-side
const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] rounded-md border border-border/40 flex items-center justify-center text-muted-foreground text-sm">
      Loading map…
    </div>
  ),
});

export function MapView({ accounts }: { accounts: MapAccount[] }) {
  const [band, setBand] = useState('all');
  const [vertical, setVertical] = useState('all');

  const filtered = useMemo(() => {
    let list = accounts;
    if (band !== 'all') list = list.filter(a => a.band === band);
    if (vertical !== 'all') list = list.filter(a => a.vertical === vertical);
    return list;
  }, [accounts, band, vertical]);

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
      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {filtered.length} doors on the map
        {vertical !== 'all' ? ` · ${verticalLabel(vertical)}` : ''}
        {band !== 'all' ? ` · ${band}` : ''}
      </div>
      <LeafletMap accounts={filtered} />
    </div>
  );
}
