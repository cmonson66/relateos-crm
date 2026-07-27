import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { fetchAllRows } from '@/lib/db/fetch-all';
import { MapView, type MapAccount } from './_components/map-view';

type Row = {
  id: string;
  name: string;
  vertical: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  last_activity_at: string | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
    title: string | null;
    lifecycle_stage: string;
  }[];
};

export default async function MapPage() {
  await getUser();
  const supabase = await createClient();

  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from('accounts')
      .select('id, name, vertical, city, latitude, longitude, tags, last_activity_at, contacts(first_name, last_name, phone, title, lifecycle_stage)')
      .not('latitude', 'is', null)
      .range(from, to)
  );

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
      <MapView accounts={accounts} />
    </div>
  );
}
