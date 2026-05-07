import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { PageHeader } from '@/components/app/page-header';
import { LockControl } from './_components/lock-control';

export default async function SystemPage() {
  const { profile } = await getUser();
  if (profile.role !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, lock_status, lock_message, locked_at, locked_by')
    .eq('id', profile.org_id)
    .single();

  // Stats for impact preview (count what would be affected if you lock)
  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: accounts },
    { count: contacts },
    { count: deals },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('is_active', true),
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader
        kicker="Super admin · Killswitch"
        title="System"
        highlight="Lock"
        description="Control workspace-wide access. Use sparingly."
      />
      <LockControl
        org={org!}
        counts={{
          totalUsers: totalUsers ?? 0,
          activeUsers: activeUsers ?? 0,
          accounts: accounts ?? 0,
          contacts: contacts ?? 0,
          deals: deals ?? 0,
        }}
      />
    </div>
  );
}
