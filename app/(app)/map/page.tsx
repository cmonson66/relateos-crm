import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { fetchAllRows, fetchAllRowsById } from '@/lib/db/fetch-all';
import { MapView, type MapAccount, type MapRegion } from './_components/map-view';
import { listRegions } from '@/lib/campaigns/region';
import type { CryptoSignal } from '@/lib/crypto/density';

type Row = {
  id: string;
  name: string;
  vertical: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  last_activity_at: string | null;
  crypto_native: boolean | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
    title: string | null;
    lifecycle_stage: string;
  }[];
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; region?: string }>;
}) {
  const { focus, region } = await searchParams;
  const { profile } = await getUser();
  const supabase = await createClient();

  // Only corporate ever sees more than one. A rep or manager is already
  // fenced by RLS, so the picker would be a dropdown with one entry.
  const isCorporate = profile.role === 'super_admin' || profile.role === 'admin';
  const regionRows = isCorporate ? await listRegions(supabase, profile.org_id) : [];
  const regions: MapRegion[] = regionRows.map(r => ({ id: r.id, code: r.code, name: r.name }));
  const activeRegionId = region && regions.some(r => r.id === region) ? region : null;

  // Narrowed in the QUERY, not in the browser. Hopping to DFW should not ship
  // every Phoenix pin down the wire first.
  const rows = await fetchAllRowsById<Row>(() => {
    const base = supabase
      .from('accounts')
      .select('id, name, vertical, city, latitude, longitude, tags, last_activity_at, crypto_native, contacts(first_name, last_name, phone, title, lifecycle_stage)')
      .not('latitude', 'is', null);
    return activeRegionId ? base.eq('region_id', activeRegionId) : base;
  });

  // Crypto touchpoints (ATMs + accepting merchants). Reference data, not
  // org-scoped. fetchAllRows swallows the error and returns [] if migration
  // 017 hasn't been applied yet, so the map still renders without the layer.
  //
  // Scoped to the region on display since 062. computeCryptoStats works out
  // percentiles from whatever it is handed, so mixing two metros would rank
  // a Phoenix corridor against Dallas kiosks and put the wrong number in the
  // legend. Corporate viewing all regions gets everything, which matches the
  // pins they are looking at.
  const signalRegionId = activeRegionId ?? (isCorporate ? null : profile.region_id ?? null);
  const signals = await fetchAllRows<CryptoSignal>((from, to) => {
    const q = supabase
      .from('crypto_signals')
      .select('id, signal_type, name, brand, city, lat, lng, weight')
      .order('id', { ascending: true })
      .range(from, to);
    return signalRegionId ? q.eq('region_id', signalRegionId) : q;
  });

  const accounts: MapAccount[] = rows.map(r => {
    const c = r.contacts?.[0] ?? null;
    return {
      id: r.id,
      name: r.name,
      vertical: r.vertical,
      city: r.city,
      lat: r.latitude as number,
      lng: r.longitude as number,
      band: r.tags.find(t => t === 'HOT' || t === 'WARM' || t === 'COOL') ?? 'COOL',
      phone: c?.phone ?? null,
      contactName: c && c.title !== 'Business' ? [c.first_name, c.last_name].filter(Boolean).join(' ') : null,
      stage: c?.lifecycle_stage ?? 'new',
      cryptoNative: !!r.crypto_native,
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Sales · Map"
        title="Territory"
        highlight="Map"
        description="Every pin is a door. Filter by band and vertical, then plan the day's route."
      />
      <MapView
        accounts={accounts}
        signals={signals}
        focusId={focus ?? null}
        regions={regions}
        activeRegionId={activeRegionId}
      />
    </div>
  );
}
