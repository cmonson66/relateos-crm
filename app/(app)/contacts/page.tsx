import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { ContactsTable } from './_components/contacts-table';

export default async function ContactsPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      *,
      account:accounts(id, name, vertical),
      owner:profiles!contacts_owner_id_fkey(id, full_name, email)
    `)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

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
        <ContactsTable contacts={list} currentUserId={profile.id} />
      )}
    </div>
  );
}
