import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { AccountsTable } from './_components/accounts-table';

export default async function AccountsPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*, owner:profiles!accounts_owner_id_fkey(id, full_name, email)')
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const list = accounts || [];

  return (
    <div className="p-8 max-w-[1400px]">
      <PageHeader
        kicker="Sales · Accounts"
        title="All"
        highlight="Accounts"
        description="Companies, programs, and organizations in your pipeline."
        action={
          <Link href="/accounts/new">
            <Button className="font-display tracking-wider btn-glow">
              + Add Account
            </Button>
          </Link>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Add your first account or import existing data to get started."
          action={
            <div className="flex items-center justify-center gap-2">
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
        <AccountsTable accounts={list} currentUserId={profile.id} />
      )}
    </div>
  );
}
