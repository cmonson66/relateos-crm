import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { UserAdminTable } from './_components/user-admin-table';

export default async function AdminPage() {
  const { profile } = await getUser();
  if (profile.role !== 'super_admin' && profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, manager_id, is_active, created_at, last_activity_at:updated_at')
    .order('full_name', { nullsFirst: false });

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Team management"
        title="User"
        highlight="Admin"
        description="Manage roles, manager hierarchies, and active status. Adding new reps via email invite ships next."
      />
      <UserAdminTable profiles={profiles || []} currentUserId={profile.id} currentRole={profile.role} />
    </div>
  );
}
