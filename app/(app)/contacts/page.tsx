import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { ContactsTable } from './_components/contacts-table';
import { fetchAllRowsById } from '@/lib/db/fetch-all';
import { regionScope } from '@/lib/db/region-scope';
import { RegionSwitcher } from '@/components/app/region-switcher';
import type { ContactWithRefs } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { profile } = await getUser();
  const supabase = await createClient();
  const { regions, activeRegionId } = await regionScope(supabase, profile, region ?? null);

  const [contacts, { data: profilesRaw }] = await Promise.all([
    fetchAllRowsById(() => {
      const q = supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, title, email, phone, tags,
          lifecycle_stage, account_id, owner_id, created_at, last_activity_at, legacy_id,
          account:accounts(id, name, vertical),
          owner:profiles!contacts_owner_id_fkey(id, full_name, email)
        `);
      // Narrowed in the query: this page ships every row to the browser for
      // its counts and search, so DFW should not drag Phoenix along first.
      return activeRegionId ? q.eq('region_id', activeRegionId) : q;
    }).then((rows) => rows as unknown as ContactWithRefs[]),
    supabase.from('profiles').select('id, full_name, email, role, region_id').eq('is_active', true),
  ]);

  // Hide super_admins from owner pickers when viewer is not super_admin
  // Owner pickers follow the region, or every rep in the company shows up on
  // a Texas screen. Corporate has no region and can own anywhere.
  const profiles = (profilesRaw || [])
    .filter(p => profile.role === 'super_admin' || p.role !== 'super_admin')
    .filter(p => !activeRegionId || p.region_id === activeRegionId || p.region_id === null);

  const list = contacts || [];

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Sales · Contacts"
        title="All"
        highlight="Contacts"
        description="The decision makers, champions, and influencers in your accounts."
        action={
          <Link href="/contacts/new">
            <Button className="font-display tracking-wider btn-glow">+ Add</Button>
          </Link>
        }
      />

      {regions.length > 1 && (
        <div className="mb-3">
          <RegionSwitcher regions={regions} activeId={activeRegionId} basePath="/contacts" allowAll />
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add a contact one at a time, or import your existing list to get started."
          action={
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link href="/contacts/new">
                <Button className="font-display tracking-wider">+ Add Contact</Button>
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
        <ContactsTable
          contacts={list}
          currentUserId={profile.id}
          currentRole={profile.role}
          allOwners={profiles}
        />
      )}
    </div>
  );
}
