import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Building2, Users, Briefcase, Activity as ActivityIcon } from 'lucide-react';

export default async function DashboardPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const [{ count: accountCount }, { count: contactCount }, { count: dealCount }, { count: openTaskCount }] = await Promise.all([
    supabase.from('accounts').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('*', { count: 'exact', head: true }),
    supabase.from('activities').select('*', { count: 'exact', head: true })
      .eq('type', 'task').is('completed_at', null),
  ]);

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
        <KpiLink href="/accounts" icon={Building2} label="Accounts" value={accountCount ?? 0} accent />
        <KpiLink href="/contacts" icon={Users} label="Contacts" value={contactCount ?? 0} />
        <KpiLink href="/deals" icon={Briefcase} label="Deals" value={dealCount ?? 0} />
        <KpiLink href="/activities" icon={ActivityIcon} label="Open tasks" value={openTaskCount ?? 0} />
      </div>

      <div className="card-lit text-card-foreground rounded-md border border-border/40 relative">
        <div className="h-[2px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="p-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
            Coming next
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">04</span>
              <span>Deals + pipeline kanban (Day 4)</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">05</span>
              <span>Activity logging + comments + @mentions (Day 5)</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-primary leading-none">06</span>
              <span>System alerts + admin tools + soft launch (Day 6)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiLink({
  href, icon: Icon, label, value, accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
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
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
        </div>
        <div className="font-display text-4xl tracking-wider leading-none">
          {value.toLocaleString()}
        </div>
      </div>
    </Link>
  );
}
