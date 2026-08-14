import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { AccountsTable } from './_components/accounts-table';
import { fetchAllRowsById } from '@/lib/db/fetch-all';
import type { AccountWithOwner } from '@/lib/db/types';
import { listRegions } from '@/lib/campaigns/region';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { profile } = await getUser();
  const supabase = await createClient();

  // Only corporate sees more than one - a rep or manager is already fenced by
  // RLS. Narrowing happens in the QUERY: this page ships every row it loads to
  // the browser for the counts and the search, so picking DFW should not drag
  // 28,000 Phoenix rows along first.
  const isCorporate = profile.role === 'super_admin' || profile.role === 'admin';
  const regionRows = isCorporate ? await listRegions(supabase, profile.org_id) : [];
  const regions = regionRows.map(r => ({ id: r.id, code: r.code, name: r.name }));
  const activeRegionId = region && regions.some(r => r.id === region) ? region : null;

  // Trimmed select narrows Supabase's inferred type; rows still carry every
  // field the table reads, so pin the shape at the boundary.
  // Keyset fetch orders by id; "recent first" is applied client-side in
  // the table (all rows are loaded anyway for chips/search)
  const accounts = (await fetchAllRowsById(() => {
    const q = supabase
      .from('accounts')
      .select(
        // Trimmed to what the list renders — select('*') was shipping 28K
        // full rows (notes text included) to the browser on every visit
        'id, name, vertical, city, state, tags, owner_id, created_at, last_activity_at, crypto_score, crypto_atm_count, crypto_native, owner:profiles!accounts_owner_id_fkey(id, full_name, email)'
      );
    return activeRegionId ? q.eq('region_id', activeRegionId) : q;
  })) as unknown as AccountWithOwner[];

  const list = accounts || [];

  // Assignable = anyone with an active CRM account. (This used to read the
  // `reps` table, which is the SENDING identity - so a rep who signed up but
  // had no email alias yet was invisible here. Owning accounts and sending
  // email are different capabilities.)
  // Scoped to the region on display. Otherwise every rep in the company shows
  // up in the owner filter, which is exactly what stops working at four
  // regions. Corporate profiles have no region and are always included, since
  // they can own an account anywhere.
  const peopleQuery = supabase
    .from('profiles')
    .select('id, full_name, email, role, region_id')
    .eq('is_active', true)
    .in('role', ['super_admin', 'admin', 'manager', 'rep'])
    .order('full_name');

  const [{ data: people }, { data: senders }] = await Promise.all([
    peopleQuery,
    supabase.from('reps').select('profile_id').eq('active', true),
  ]);
  const senderIds = new Set((senders ?? []).map(r => r.profile_id));
  const reps = (people ?? [])
    .filter(p => !activeRegionId || p.region_id === activeRegionId || p.region_id === null)
    .map(p => ({
      profile_id: p.id,
      first_name: (p.full_name || p.email || 'Rep').split(' ')[0],
      can_send: senderIds.has(p.id),
    }));
  const canAssign = profile.role === 'super_admin' || profile.role === 'admin';

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Sales · Accounts"
        title="All"
        highlight="Accounts"
        description="Companies, programs, and organizations in your pipeline."
        action={
          <Link href="/accounts/new">
            <Button className="font-display tracking-wider btn-glow">+ Add</Button>
          </Link>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Add your first account or import existing data to get started."
          action={
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link href="/accounts/new">
                <Button className="font-display tracking-wider">+ Add Account</Button>
              </Link>
              {(profile.role === 'super_admin' || profile.role === 'admin') && (
                <Link href="/import">
                  <Button variant="outline" className="font-display tracking-wider">Bulk Import</Button>
                </Link>
              )}
            </div>
          }
        />
      ) : (
        <AccountsTable
          accounts={list}
          currentUserId={profile.id}
          reps={reps ?? []}
          canAssign={canAssign}
          regions={regions}
          activeRegionId={activeRegionId}
        />
      )}
    </div>
  );
}
