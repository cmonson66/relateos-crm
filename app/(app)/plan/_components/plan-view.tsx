'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Phone, Send, Check, X, RefreshCw, CalendarCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generatePlan, setItemState } from '../actions';

export type PlanItemView = {
  id: string;
  kind: 'call' | 'send' | 'appointment' | 'walkin' | 'admin';
  accountId: string | null;
  contactId: string | null;
  accountName: string;
  city: string | null;
  phone: string | null;
  reason: string;
  estMinutes: number;
  state: 'pending' | 'done' | 'skipped' | 'rolled';
};

export type Appointment = {
  id: string;
  accountId: string | null;
  accountName: string;
  city: string | null;
  at: string;
  subject: string;
};

// Defined at module scope, not inside PlanView. A component created during
// render is a brand new type every pass, so React unmounts and remounts the
// whole subtree - which drops focus and throws away any local state in it.
function Row({
  item,
  pending,
  busy,
  onMark,
}: {
  item: PlanItemView;
  pending: boolean;
  busy: string | null;
  onMark: (id: string, state: 'done' | 'skipped') => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/25 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {item.accountId ? (
            <Link href={`/accounts/${item.accountId}`} className="font-medium hover:text-primary">
              {item.accountName}
            </Link>
          ) : (
            <span className="font-medium">{item.accountName}</span>
          )}
          {item.city && <span className="text-xs text-muted-foreground">{item.city}</span>}
        </div>
        {/* The reason is the whole feature. A list that cannot say why it
            picked something gets ignored by the second morning. */}
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{item.reason}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {item.kind === 'call' && item.accountId && (
          <Link
            href={`/call/${item.accountId}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/90 px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </Link>
        )}
        {item.kind === 'send' && item.accountId && (
          <Link
            href={`/send/${item.accountId}${item.contactId ? `?contact=${item.contactId}` : ''}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/90 px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary"
          >
            <Send className="h-3.5 w-3.5" /> Send
          </Link>
        )}
        <button
          type="button"
          title="Done"
          disabled={pending && busy === item.id}
          onClick={() => onMark(item.id, 'done')}
          className="rounded-md border border-border/40 p-2 text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Not today"
          disabled={pending && busy === item.id}
          onClick={() => onMark(item.id, 'skipped')}
          className="rounded-md border border-border/40 p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Block({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-lit mb-4 rounded-md border border-border/40 p-5">
      <div className="mb-1 font-display text-lg tracking-wider">{title}</div>
      <p className="mb-3 text-xs text-muted-foreground">{sub}</p>
      {children}
    </section>
  );
}

export function PlanView({
  calls,
  sends,
  appointments,
  generatedAt,
  timezone,
  firstName,
}: {
  calls: PlanItemView[];
  sends: PlanItemView[];
  appointments: Appointment[];
  generatedAt: string | null;
  timezone: string;
  firstName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });

  const open = (list: PlanItemView[]) => list.filter((i) => i.state === 'pending');
  const openCalls = open(calls);
  const openSends = open(sends);
  const doneCount = [...calls, ...sends].filter((i) => i.state === 'done').length;
  const minutes = [...openCalls, ...openSends].reduce((n, i) => n + i.estMinutes, 0);

  function mark(id: string, state: 'done' | 'skipped') {
    setBusy(id);
    start(async () => {
      const res = await setItemState(id, state);
      setBusy(null);
      if (res.ok === false) toast.error(res.message);
      else router.refresh();
    });
  }

  function replan() {
    start(async () => {
      const res = await generatePlan();
      if (res.ok === false) toast.error(res.message);
      else {
        toast.success('Rebuilt');
        router.refresh();
      }
    });
  }

  if (!generatedAt) {
    return (
      <div className="card-lit rounded-md border border-border/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No plan for today yet. It reads your own book - who raised their hand, what you
          promised, and who has been sitting untouched.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={replan}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary/90 px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
          {pending ? 'Building...' : 'Plan my day'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {openCalls.length + openSends.length === 0 ? (
            <span className="text-emerald-400">That is the morning done, {firstName}.</span>
          ) : (
            <>
              <span className="text-foreground">{openCalls.length + openSends.length} left</span>
              {' '}· about {minutes} minutes
              {doneCount > 0 && <> · {doneCount} done</>}
            </>
          )}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={replan}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} /> Replan
        </button>
      </div>

      {appointments.length > 0 && (
        <Block
          title="ON THE CALENDAR"
          sub="Fixed points. Everything else works around these."
        >
          {appointments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border/25 py-3 last:border-0">
              <div className="w-16 shrink-0 font-mono text-sm text-primary">{fmt(a.at)}</div>
              <div className="min-w-0 flex-1">
                {a.accountId ? (
                  <Link href={`/accounts/${a.accountId}`} className="font-medium hover:text-primary">
                    {a.accountName}
                  </Link>
                ) : (
                  <span className="font-medium">{a.accountName}</span>
                )}
                <p className="text-[13px] text-muted-foreground">
                  {a.subject}
                  {a.city ? ` · ${a.city}` : ''}
                </p>
              </div>
              <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </Block>
      )}

      <Block
        title="CALLS"
        sub="Ranked. Whoever raised their hand comes first, then what you promised, then the book."
      >
        {openCalls.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing left here. {doneCount > 0 ? 'Go get in the car.' : 'Hit Replan if that seems wrong.'}
          </p>
        ) : (
          openCalls.map((i) => <Row key={i.id} item={i} pending={pending} busy={busy} onMark={mark} />)
        )}
      </Block>

      <Block title="SENDS" sub="Follow-through on something that already happened.">
        {openSends.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing to send this morning.</p>
        ) : (
          openSends.map((i) => <Row key={i.id} item={i} pending={pending} busy={busy} onMark={mark} />)
        )}
      </Block>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        The point of the morning is tomorrow&apos;s calendar, not today&apos;s.
      </p>
    </div>
  );
}
