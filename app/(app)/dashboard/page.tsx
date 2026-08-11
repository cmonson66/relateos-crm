import { getUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  Zap, Briefcase, DoorOpen, Mail, PartyPopper, CalendarDays,
  AlertCircle, Plus, TrendingUp, FileText, Timer,
} from 'lucide-react';
import { formatDealValue } from '@/lib/db/deals';
import { phxToday, trialStatus, type TrialFields } from '@/lib/db/trials';
import { formatRelative, APP_TIMEZONE } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const PHX_MS = 7 * 3600000; // Phoenix = UTC-7, no DST

// Phoenix day boundaries. (The old dashboard used new Date().setHours(),
// which is SERVER-local - on a UTC host "today" rolled over every evening
// at 5 PM Phoenix, the same bug that hid appointments on the calendar.)
function phxDayStartUtc(daysAgo = 0): Date {
  const p = new Date(Date.now() - PHX_MS);
  return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate() - daysAgo, 7, 0, 0));
}

type ActivityRow = {
  id: string;
  type: string;
  subject: string | null;
  body?: string | null;
  scheduled_at: string | null;
  completed_at?: string | null;
  account?: { id: string; name: string; city: string | null }[] | { id: string; name: string; city: string | null } | null;
};

const one = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function DashboardPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const todayStart = phxDayStartUtc(0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const weekStart = phxDayStartUtc(7);
  const prevWeekStart = phxDayStartUtc(14);

  const [
    { data: openDeals },
    { data: wonDeals },
    { data: trialDeals },
    { data: todayItems },
    { data: weekActivities },
    { data: myAlerts },
    { count: unassignedHot },
    { data: stages },
    { data: allDeals },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('deals_with_stage')
      .select('value_cents, stage_name, stage_position, stage_is_won, stage_is_lost')
      .eq('stage_is_won', false).eq('stage_is_lost', false),
    supabase.from('deals_with_stage')
      .select('id, name, updated_at, stage_is_won')
      .eq('stage_is_won', true)
      .gte('updated_at', prevWeekStart.toISOString()),
    // Terminals physically sitting in shops right now. RLS-scoped, so a
    // rep sees their own and Chad sees every one that is out.
    supabase.from('deals_with_stage')
      .select('id, trial_start, trial_days, trial_end, trial_outcome')
      .not('trial_start', 'is', null)
      .is('trial_outcome', null),
    // ONE list for today: appointments, callbacks, installs AND tasks.
    // (The old dashboard ran two overlapping queries, so a task due today
    // appeared in both "My tasks" and "On your calendar today".)
    supabase.from('activities')
      .select('id, type, subject, body, scheduled_at, completed_at, account:accounts(id, name, city)')
      .is('completed_at', null)
      .lt('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(40),
    supabase.from('activities')
      .select('id, type, subject, created_at, owner_id')
      .gte('created_at', prevWeekStart.toISOString()),
    supabase.from('notifications')
      .select('id, title, body, entity_type, entity_id, created_at')
      .eq('recipient_id', profile.id).eq('type', 'system_alert').is('read_at', null)
      .order('created_at', { ascending: false }).limit(4),
    supabase.from('accounts')
      .select('id', { count: 'exact', head: true })
      .contains('tags', ['HOT']).is('owner_id', null),
    supabase.from('pipeline_stages').select('id, name, position, is_won, is_lost').order('position'),
    supabase.from('deals_with_stage').select('stage_position, stage_is_won, stage_is_lost'),
    supabase.from('profiles').select('id, full_name'),
  ]);

  // ---- KPIs: motion, not inventory ----
  const openPipeline = (openDeals ?? []).reduce((s, d) => s + (d.value_cents || 0), 0);
  const openCount = (openDeals ?? []).length;

  const inWeek = (iso: string) => new Date(iso) >= weekStart;
  const inPrevWeek = (iso: string) => new Date(iso) >= prevWeekStart && new Date(iso) < weekStart;

  const liveThisWeek = (wonDeals ?? []).filter(d => d.updated_at && inWeek(d.updated_at)).length;
  const livePrevWeek = (wonDeals ?? []).filter(d => d.updated_at && inPrevWeek(d.updated_at)).length;

  // Trials: how many terminals are out, and how many need a decision this week
  const phxNow = phxToday();
  const trials = (trialDeals ?? []) as TrialFields[];
  const trialsRunning = trials.length;
  const trialsClosing = trials.filter(t => {
    const s = trialStatus(t, phxNow);
    return s && s.daysLeft <= 2;
  }).length;

  const acts = (weekActivities ?? []) as { type: string; subject: string | null; created_at: string }[];
  const demosThisWeek = acts.filter(a => inWeek(a.created_at) && a.type === 'meeting' && (a.subject ?? '').startsWith('Demo')).length;
  const demosPrevWeek = acts.filter(a => inPrevWeek(a.created_at) && a.type === 'meeting' && (a.subject ?? '').startsWith('Demo')).length;
  const callsThisWeek = acts.filter(a => inWeek(a.created_at) && a.type === 'call').length;
  const visitsThisWeek = acts.filter(a => inWeek(a.created_at) && a.type === 'meeting').length;
  const doorsThisWeek = callsThisWeek + visitsThisWeek;
  const doorsPrevWeek = acts.filter(a => inPrevWeek(a.created_at) && (a.type === 'call' || a.type === 'meeting')).length;
  const emailsThisWeek = acts.filter(a => inWeek(a.created_at) && a.type === 'email').length;
  const pulseThisWeek = acts.filter(a => inWeek(a.created_at) && a.type === 'note' && (a.subject ?? '').toLowerCase().includes('pulse')).length;

  // ---- today's single list ----
  const today = (todayItems ?? []) as ActivityRow[];
  const todayList = today.filter(t => t.scheduled_at && new Date(t.scheduled_at) >= todayStart);
  const overdue = today.filter(t => t.scheduled_at && new Date(t.scheduled_at) < todayStart);

  // ---- pipeline funnel ----
  const stageList = (stages ?? []) as { id: string; name: string; position: number; is_won: boolean; is_lost: boolean }[];
  const dealsByPos = new Map<number, number>();
  for (const d of (allDeals ?? []) as { stage_position: number }[]) {
    dealsByPos.set(d.stage_position, (dealsByPos.get(d.stage_position) ?? 0) + 1);
  }
  const funnelMax = Math.max(1, ...Array.from(dealsByPos.values()));

  const nameById = new Map((profiles ?? []).map(p => [p.id, (p.full_name ?? '').split(' ')[0]]));
  const byRep = new Map<string, { demos: number; doors: number }>();
  for (const a of (weekActivities ?? []) as { type: string; subject: string | null; created_at: string; owner_id: string }[]) {
    if (!inWeek(a.created_at)) continue;
    if (a.type !== 'call' && a.type !== 'meeting') continue;
    const cur = byRep.get(a.owner_id) ?? { demos: 0, doors: 0 };
    cur.doors++;
    if (a.type === 'meeting' && (a.subject ?? '').startsWith('Demo')) cur.demos++;
    byRep.set(a.owner_id, cur);
  }
  const scoreboard = Array.from(byRep.entries())
    .map(([id, v]) => ({ name: nameById.get(id) || 'Rep', ...v }))
    .sort((a, b) => b.doors - a.doors)
    .slice(0, 5);

  const firstName = (profile.full_name ?? 'there').split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: APP_TIMEZONE,
  });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider leading-none">
          WELCOME BACK, <span className="text-primary text-glow-primary">{firstName.toUpperCase()}</span>
        </h1>
        <p className="text-muted-foreground mt-2.5 text-sm">
          {todayLabel} · {todayList.length} scheduled today
          {overdue.length > 0 && <span className="text-destructive"> · {overdue.length} overdue</span>}
        </p>
      </div>

      {/* ---------------- KPIs ---------------- */}
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">This week</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
        <Kpi href="/deals" icon={PartyPopper} label="Terminals live" value={liveThisWeek.toString()}
             sub={delta(liveThisWeek, livePrevWeek)} tone="green" />
        <Kpi href="/calendar" icon={CalendarDays} label="Demos booked" value={demosThisWeek.toString()}
             sub={delta(demosThisWeek, demosPrevWeek)} tone="gold" />
        <Kpi href="/activities" icon={DoorOpen} label="Doors worked" value={doorsThisWeek.toString()}
             sub={`${callsThisWeek} calls · ${visitsThisWeek} visits · ${delta(doorsThisWeek, doorsPrevWeek)}`} tone="blue" />
        <Kpi href="/activities" icon={Mail} label="Touches logged" value={(emailsThisWeek + pulseThisWeek).toString()}
             sub={`${pulseThisWeek} Pulse events`} />
        <Kpi href="/deals" icon={Timer} label="Trials running" value={trialsRunning.toString()}
             sub={trialsClosing > 0 ? `${trialsClosing} need a decision` : 'terminals in shops'}
             tone={trialsClosing > 0 ? 'gold' : undefined} />
        <Kpi href="/deals" icon={Briefcase} label="Open pipeline" value={formatDealValue(openPipeline)}
             sub={`${openCount} deals`} tone="gold" />
      </div>

      {/* ---------------- today + attention ---------------- */}
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card title="TODAY" icon={CalendarDays}>
          {overdue.slice(0, 3).map(t => <Row key={t.id} item={t} overdue />)}
          {todayList.map(t => <Row key={t.id} item={t} />)}
          {todayList.length === 0 && overdue.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nothing scheduled. The doors won&apos;t knock themselves.
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Link href="/calendar" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
              Open calendar
            </Link>
            <Link href="/appointments/new" className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3.5 py-2 text-xs font-bold hover:bg-sidebar-accent/50">
              <Plus className="h-3.5 w-3.5" /> Appointment
            </Link>
          </div>
        </Card>

        <div className="space-y-5">
          {((myAlerts?.length ?? 0) > 0 || (unassignedHot ?? 0) > 0) && (
            <div className="card-lit relative rounded-md border border-destructive/30 p-5">
              <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-destructive/60" />
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider">
                <AlertCircle className="h-4 w-4 text-destructive" /> NEEDS ATTENTION
              </h2>
              {(unassignedHot ?? 0) > 0 && (
                <Link href="/accounts" className="-mx-2 block rounded-md px-2 py-2 hover:bg-destructive/5">
                  <div className="text-sm font-medium">{unassignedHot} HOT accounts unassigned</div>
                  <div className="text-[11px] text-muted-foreground">Invisible to reps until someone owns them</div>
                </Link>
              )}
              {(myAlerts ?? []).map(a => (
                <Link key={a.id} href={
                  a.entity_type === 'deal' ? `/deals/${a.entity_id}` :
                  a.entity_type === 'contact' ? `/contacts/${a.entity_id}` :
                  a.entity_type === 'account' ? `/accounts/${a.entity_id}` : '/activities'
                } className="-mx-2 block rounded-md px-2 py-2 hover:bg-destructive/5">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  {a.body && <div className="truncate text-[11px] text-muted-foreground">{a.body}</div>}
                  <div className="mt-0.5 text-[10px] text-muted-foreground/70">{formatRelative(a.created_at)}</div>
                </Link>
              ))}
            </div>
          )}

          <Card title="PIPELINE" icon={TrendingUp} href="/deals">
            <div className="grid gap-1.5">
              {stageList.map(s => {
                const n = dealsByPos.get(s.position) ?? 0;
                return (
                  <div key={s.id} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className={`w-[92px] shrink-0 ${s.is_won ? 'text-emerald-400' : 'text-muted-foreground'}`}>{s.name}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-background/60">
                      <div
                        className={`h-full ${s.is_won ? 'bg-emerald-500' : s.is_lost ? 'bg-destructive/60' : 'bg-primary/70'}`}
                        style={{ width: `${Math.round((n / funnelMax) * 100)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-bold">{n}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {scoreboard.length > 1 && (
            <Card title="REP SCOREBOARD · WEEK" icon={Zap}>
              {scoreboard.map(r => (
                <div key={r.name} className="flex justify-between border-b border-dashed border-border/30 py-1.5 text-sm last:border-0">
                  <span className="font-bold">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.demos} demos · {r.doors} doors</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function delta(now: number, prev: number): string {
  const d = now - prev;
  if (d === 0) return `same as last week`;
  return `${d > 0 ? '+' : ''}${d} vs last week`;
}

function Kpi({
  href, icon: Icon, label, value, sub, tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; tone?: 'gold' | 'green' | 'blue';
}) {
  const toneClass =
    tone === 'green' ? 'text-emerald-400' : tone === 'blue' ? 'text-sky-400' : tone === 'gold' ? 'text-primary' : '';
  return (
    <Link href={href} className="card-lit rounded-md border border-border/40 p-3.5 transition-colors hover:border-primary/50">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`font-display text-2xl tracking-wider md:text-3xl ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </Link>
  );
}

function Card({
  title, icon: Icon, href, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-lit relative rounded-md border border-border/40 p-5">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wider">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h2>
        {href && <Link href={href} className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">View all →</Link>}
      </div>
      {children}
    </div>
  );
}

function Row({ item, overdue }: { item: ActivityRow; overdue?: boolean }) {
  const acct = one(item.account);
  const isInstall = (item.subject ?? '').startsWith('Install');
  const tag = isInstall ? 'INSTALL' : item.type === 'task' ? 'TASK' : item.type === 'call' ? 'CALL' : (item.subject ?? '').startsWith('Callback') ? 'CALLBACK' : 'DEMO';
  const tagClass =
    tag === 'INSTALL' ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' :
    tag === 'TASK' ? 'border-violet-500/45 bg-violet-500/10 text-violet-300' :
    tag === 'CALLBACK' || tag === 'CALL' ? 'border-sky-500/45 bg-sky-500/10 text-sky-300' :
    'border-primary/45 bg-primary/10 text-primary';
  const time = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_TIMEZONE })
    : '';

  return (
    <div className="-mx-2 flex items-center gap-1.5 border-b border-dashed border-border/25 px-2 last:border-0">
    <Link
      href={acct ? `/accounts/${acct.id}` : '/calendar'}
      className="flex flex-1 items-start gap-2.5 py-2.5 hover:bg-primary/5"
    >
      <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider ${tagClass}`}>
        {tag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold">{acct?.name ?? item.subject ?? 'Activity'}</span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {[acct?.city, item.subject].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className={`shrink-0 text-[11.5px] tabular-nums ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
        {overdue ? `overdue ${formatRelative(item.scheduled_at!)}` : time}
      </span>
    </Link>
    {acct && (
      <Link
        href={`/call/${acct.id}/sheet`}
        title="Walk-in sheet"
        className="shrink-0 rounded-md border border-border/40 p-1.5 text-muted-foreground hover:text-primary"
      >
        <FileText className="h-3.5 w-3.5" />
      </Link>
    )}
    {acct && (
      <Link
        href={`/send/${acct.id}`}
        title="Send a message"
        className="shrink-0 rounded-md border border-border/40 p-1.5 text-muted-foreground hover:text-primary"
      >
        <Mail className="h-3.5 w-3.5" />
      </Link>
    )}
    </div>
  );
}
