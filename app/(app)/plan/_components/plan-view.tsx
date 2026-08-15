'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Phone, Send, Check, X, RefreshCw, CornerDownRight } from 'lucide-react';
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

/**
 * The morning as a BURN-DOWN, not a list.
 *
 * Three things drive the layout, and all three are arguments with how the
 * first version looked:
 *
 * 1. ONE QUEUE. Calls and sends were two separate lists, which made a rep
 *    context-switch between them to work out what was actually next. They are
 *    one ordered queue now with a small tag on each row - the question a rep
 *    is asking is "what next", not "what kind".
 *
 * 2. THE REASON IS THE HEADLINE. Every CRM makes the company name the biggest
 *    thing on the card. But "tapped waiting to get paid yesterday and put
 *    themselves at $40k a month" is what makes somebody pick up the phone -
 *    the shop name is just the label on it. So the name is the eyebrow and
 *    the reason is set large. That inversion only makes sense in this product,
 *    because the reason column exists at all here.
 *
 * 3. FINITE, VISIBLY. A segmented rail with one tick per item. Twelve ticks
 *    is a morning you can see the end of; a scrolling list is not.
 */

const TICK = 'h-1.5 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-300';

function BurnDown({ total, done }: { total: number; done: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            TICK,
            i < done ? 'bg-primary' : i === done ? 'bg-primary/40' : 'bg-border',
          )}
        />
      ))}
    </div>
  );
}

function KindTag({ kind }: { kind: 'call' | 'send' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {kind === 'call' ? <Phone className="h-3 w-3" /> : <Send className="h-3 w-3" />}
      {kind}
    </span>
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

  // One queue. Calls lead because a conversation beats a message, but after
  // that it is simply the order the ranking produced.
  const all = [...calls, ...sends];
  const queue = all.filter((i) => i.state === 'pending');
  const doneCount = all.filter((i) => i.state === 'done').length;
  const [up, ...rest] = queue;
  const minutes = queue.reduce((n, i) => n + i.estMinutes, 0);

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
      else router.refresh();
    });
  }

  if (!generatedAt) {
    return (
      <div className="card-lit rounded-md border border-border/40 px-6 py-14 text-center">
        <p className="font-display text-2xl tracking-wider">NOTHING PLANNED YET</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Reads your own book and puts it in order: who raised their hand, what you promised,
          and who has been sitting untouched.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={replan}
          className="btn-glow mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-display tracking-widest text-primary-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', pending && 'motion-safe:animate-spin')} />
          {pending ? 'BUILDING' : 'PLAN MY DAY'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The shape of the morning, in one line. */}
      <div className="card-lit rounded-md border border-border/40 px-5 py-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none tracking-wider text-primary text-glow-primary">
              {queue.length}
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              left{queue.length > 0 && <> · about {minutes} min</>}
            </span>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={replan}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3 w-3', pending && 'motion-safe:animate-spin')} /> Replan
          </button>
        </div>
        <BurnDown total={all.length} done={doneCount} />
        {doneCount > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {doneCount} done{queue.length === 0 ? '. That is the morning.' : ''}
          </p>
        )}
      </div>

      {/* Fixed points. Times in mono because they are data, not prose. */}
      {appointments.length > 0 && (
        <div className="rounded-md border border-border/40 bg-sidebar/40 px-5 py-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Booked today
          </div>
          <div className="space-y-2">
            {appointments.map((a) => (
              <div key={a.id} className="flex items-baseline gap-3">
                <span className="w-[4.5rem] shrink-0 font-mono text-sm text-primary">{fmt(a.at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.accountId ? (
                    <Link href={`/accounts/${a.accountId}`} className="hover:text-primary">
                      {a.accountName}
                    </Link>
                  ) : (
                    a.accountName
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">{a.subject}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {up ? (
        <>
          {/* The hero. Reason set large, name demoted to the eyebrow. */}
          <div className="card-lit relative overflow-hidden rounded-md border border-primary/30 px-5 py-6">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            <div className="mb-4 flex items-center justify-between gap-3">
              <KindTag kind={up.kind === 'send' ? 'send' : 'call'} />
              <span className="text-[10px] uppercase tracking-[0.18em] text-primary">Up next</span>
            </div>

            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {up.accountId ? (
                <Link href={`/accounts/${up.accountId}`} className="hover:text-foreground">
                  {up.accountName}
                </Link>
              ) : (
                up.accountName
              )}
              {up.city && <span className="text-muted-foreground/60"> · {up.city}</span>}
            </div>

            <p className="mt-2 text-[19px] leading-snug text-foreground sm:text-[21px]">{up.reason}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {up.accountId && (
                <Link
                  href={
                    up.kind === 'send'
                      ? `/send/${up.accountId}${up.contactId ? `?contact=${up.contactId}` : ''}`
                      : `/call/${up.accountId}`
                  }
                  className="btn-glow inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-display tracking-widest text-primary-foreground"
                >
                  {up.kind === 'send' ? <Send className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {up.kind === 'send' ? 'SEND IT' : 'CALL'}
                </Link>
              )}
              <button
                type="button"
                disabled={pending && busy === up.id}
                onClick={() => mark(up.id, 'done')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3.5 py-2.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Done
              </button>
              <button
                type="button"
                disabled={pending && busy === up.id}
                onClick={() => mark(up.id, 'skipped')}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3.5 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Not today
              </button>
            </div>
          </div>

          {rest.length > 0 && (
            <div className="rounded-md border border-border/40 bg-sidebar/40">
              <div className="border-b border-border/25 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Then
              </div>
              {rest.map((i) => (
                <div
                  key={i.id}
                  className="flex items-start gap-3 border-b border-border/20 px-5 py-3.5 last:border-0"
                >
                  <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{i.accountName}</span>
                      <KindTag kind={i.kind === 'send' ? 'send' : 'call'} />
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{i.reason}</p>
                  </div>
                  <button
                    type="button"
                    title="Not today"
                    disabled={pending && busy === i.id}
                    onClick={() => mark(i.id, 'skipped')}
                    className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card-lit rounded-md border border-emerald-500/25 px-6 py-12 text-center">
          <p className="font-display text-2xl tracking-wider text-emerald-400">
            {doneCount > 0 ? `THAT IS THE MORNING, ${firstName.toUpperCase()}` : 'NOTHING QUEUED'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {doneCount > 0
              ? 'Go get in the car. What you booked this morning is tomorrow you, sorted.'
              : 'Nothing in your book came up. Replan if that seems wrong.'}
          </p>
        </div>
      )}

      <p className="px-1 text-[11px] text-muted-foreground">
        The point of the morning is tomorrow&apos;s calendar, not today&apos;s.
      </p>
    </div>
  );
}