import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Building2, Users, Briefcase, Activity as ActivityIcon, CheckSquare, Calendar } from 'lucide-react';
import { formatDealValue } from '@/lib/db/deals';
import { formatRelative } from '@/lib/utils/format';

export default async function DashboardPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const [
    { count: accountCount },
    { count: contactCount },
    { data: openDeals },
    { data: myOpenTasks },
    { data: upcomingToday },
  ] = await Promise.all([
    supabase.from('accounts').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals_with_stage').select('value_cents, stage_is_won, stage_is_lost').eq('stage_is_won', false).eq('stage_is_lost', false),
    supabase.from('activities')
      .select('id, subject, body, scheduled_at, account:accounts(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)')
      .eq('type', 'task')
      .eq('assigned_to', profile.id)
      .is('completed_at', null)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(5),
    supabase.from('activities')
      .select('id, type, subject, scheduled_at, account:accounts(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)')
      .eq('owner_id', profile.id)
      .is('completed_at', null)
      .gte('scheduled_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
      .lt('scheduled_at', new Date(new Date().setHours(23,59,59,999)).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5),
  ]);

  const totalPipeline = (openDeals || []).reduce((sum, d) => sum + (d.value_cents || 0), 0);
  const dealCount = (openDeals || []).length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const firstName = profile.full_name?.split(' ')[0] || profile.email.split('@')[0];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="inline-block w-2 h-2 bg-primary rounded-full hud-pulse" />
          <span>Live · {today} · {time}</span>
        </div>
        <h1 className="font-display text-6xl tracking-wider leading-none">
          WELCOME BACK,{' '}
          <span className="text-primary text-glow-primary">{firstName.toUpperCase()}</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Your sales pipeline at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiLink href="/deals" icon={Briefcase} label="Open pipeline" value={formatDealValue(totalPipeline)} subValue={`${dealCount} deals`} accent />
        <KpiLink href="/accounts" icon={Building2} label="Accounts" value={(accountCount ?? 0).toString()} />
        <KpiLink href="/contacts" icon={Users} label="Contacts" value={(contactCount ?? 0).toString()} />
        <KpiLink href="/activities" icon={ActivityIcon} label="My open tasks" value={(myOpenTasks?.length ?? 0).toString()} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <DashboardCard title="My tasks" icon={CheckSquare} href="/activities" emptyText="No open tasks. Nice.">
          {(myOpenTasks || []).map(t => (
            <Link key={t.id} href={
              t.deal && Array.isArray(t.deal) && t.deal[0] ? `/deals/${t.deal[0].id}` :
              t.contact && Array.isArray(t.contact) && t.contact[0] ? `/contacts/${t.contact[0].id}` :
              t.account && Array.isArray(t.account) && t.account[0] ? `/accounts/${t.account[0].id}` :
              '/activities'
            }
              className="block py-2 px-2 rounded-md hover:bg-primary/5 transition-colors -mx-2"
            >
              <div className="text-sm truncate">{t.subject || t.body?.slice(0, 80) || 'Task'}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {t.scheduled_at ? `Due ${formatRelative(t.scheduled_at)}` : 'No due date'}
              </div>
            </Link>
          ))}
        </DashboardCard>

        <DashboardCard title="On your calendar today" icon={Calendar} href="/activities" emptyText="Nothing scheduled today.">
          {(upcomingToday || []).map(a => (
            <div key={a.id} className="py-2 px-2 -mx-2">
              <div className="text-sm truncate">
                <span className="text-muted-foreground capitalize">{a.type}</span>
                {a.subject && <span> · {a.subject}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
              </div>
            </div>
          ))}
        </DashboardCard>
      </div>
    </div>
  );
}

function KpiLink({
  href, icon: Icon, label, value, subValue, accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card-lit border border-border/40 rounded-md relative group hover:border-primary/40 transition-colors"
    >
      <div className={`h-[3px] rounded-t-md ${accent ? 'bg-primary glow-stripe' : 'bg-card-foreground/10 group-hover:bg-primary/40'}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
        </div>
        <div className="font-display text-3xl tracking-wider leading-none">{value}</div>
        {subValue && <div className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.15em]">{subValue}</div>}
      </div>
    </Link>
  );
}

function DashboardCard({
  title, icon: Icon, href, emptyText, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasChildren = childArray.filter(Boolean).length > 0;

  return (
    <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
      <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl tracking-wider flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> {title.toUpperCase()}
          </h2>
          <Link href={href} className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">
            View all
          </Link>
        </div>
        {hasChildren ? (
          <div className="space-y-1">{children}</div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
