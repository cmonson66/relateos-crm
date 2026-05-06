import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { UserAdminTable } from './_components/user-admin-table';
import { InviteUserDialog } from './_components/invite-user-dialog';

export default async function AdminPage() {
  const { profile } = await getUser();
  if (profile.role !== 'super_admin' && profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, manager_id, is_active, created_at, last_activity_at:updated_at')
    .order('full_name', { nullsFirst: false });

  // Hide super_admins from non-super_admin viewers
  const profiles = (profilesRaw || []).filter(p =>
    profile.role === 'super_admin' || p.role !== 'super_admin'
  );

  const managerCandidates = profiles.filter(p =>
    p.role === 'manager' || p.role === 'admin' || p.role === 'super_admin'
  );

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Team management"
        title="User"
        highlight="Admin"
        description="Manage roles, manager hierarchies, and team membership."
        action={
          <InviteUserDialog
            currentRole={profile.role}
            managerCandidates={managerCandidates}
          />
        }
      />
      <UserAdminTable profiles={profiles} currentUserId={profile.id} currentRole={profile.role} />
    </div>
  );
}
