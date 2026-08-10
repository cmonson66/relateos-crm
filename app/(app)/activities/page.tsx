import { getUser } from '@/lib/auth/get-user';
import { BackLink } from '@/components/app/back-link';
import { createClient } from '@/lib/supabase/server';
import { Activity as ActivityIcon } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { ActivitiesList } from './_components/activities-list';

export default async function ActivitiesPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const { data: activities } = await supabase
    .from('activities')
    .select(`
      *,
      owner:profiles!activities_owner_id_fkey(id, full_name, email),
      assignee:profiles!activities_assigned_to_fkey(id, full_name, email),
      account:accounts(id, name),
      contact:contacts(id, first_name, last_name),
      deal:deals(id, name)
    `)
    .order('completed_at', { ascending: false, nullsFirst: true })
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  const list = activities || [];

  return (
    <div className="p-8 max-w-[1400px]">
      <BackLink fallbackHref="/dashboard" fallbackLabel="Dashboard" />

      <PageHeader
        kicker="Activities · last 200"
        title="All"
        highlight="Activity"
        description="Calls, emails, meetings, notes, and tasks across your accounts."
      />
      {list.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Open any account, contact, or deal and use the activity panel to log a call, schedule a meeting, or assign a task."
        />
      ) : (
        <ActivitiesList activities={list} currentUserId={profile.id} />
      )}
    </div>
  );
}
