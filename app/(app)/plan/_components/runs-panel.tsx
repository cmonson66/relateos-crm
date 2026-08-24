'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Footprints, MapPin, Check, X, Navigation, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { offerRuns, takeRun, setStopState, endRun, type RunOffer } from '../run-actions';

export type ActiveStop = {
  id: string;
  accountId: string;
  name: string;
  city: string | null;
  band: string;
  vertical: string;
  lat: number | null;
  lng: number | null;
  state: 'pending' | 'done' | 'skipped';
};

export type ActiveRun = {
  id: string;
  label: string;
  estMinutes: number;
  stops: ActiveStop[];
};

/**
 * The OPPORTUNITY half of the day.
 *
 * The morning list above this is a queue - things a rep owes. This is offered,
 * finite and declinable. They are deliberately different objects: mix them and
 * the queue starts feeling optional while the offer feels like homework.
 */
export function RunsPanel({ active }: { active: ActiveRun | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [offers, setOffers] = useState<RunOffer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function look() {
    start(async () => {
      const res = await offerRuns();
      if (res.ok === false) {
        toast.error(res.message);
        return;
      }
      setOffers(res.runs);
      if (res.runs.length === 0) {
        toast.message('Nothing worth a walk right now', {
          description: 'Needs a pocket of doors with at least one warm one in it.',
        });
      }
    });
  }

  function go(offer: RunOffer) {
    setBusy(offer.label);
    start(async () => {
      const res = await takeRun(offer);
      setBusy(null);
      if (res.ok === false) {
        toast.error(res.message);
        return;
      }
      toast.success(
        res.claimed > 0
          ? `${offer.label} is yours. ${res.claimed} new shop${res.claimed === 1 ? '' : 's'} added to your book.`
          : `${offer.label} started.`,
        { duration: 7000 },
      );
      setOffers(null);
      router.refresh();
    });
  }

  function mark(stopId: string, state: 'done' | 'skipped') {
    setBusy(stopId);
    start(async () => {
      const res = await setStopState(stopId, state);
      setBusy(null);
      if (res.ok === false) toast.error(res.message);
      else router.refresh();
    });
  }

  function finish(state: 'done' | 'abandoned') {
    if (!active) return;
    start(async () => {
      const res = await endRun(active.id, state);
      if (res.ok === false) toast.error(res.message);
      else {
        toast.success(state === 'done' ? 'Run closed out.' : 'Run dropped.');
        router.refresh();
      }
    });
  }

  // ---- a run in progress -------------------------------------------------
  if (active) {
    const left = active.stops.filter((s) => s.state === 'pending');
    const done = active.stops.length - left.length;
    const [next, ...rest] = left;

    return (
      <section className="card-lit rounded-md border border-primary/30 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary">Walking now</div>
            <div className="font-display text-xl tracking-wider">{active.label.toUpperCase()}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {done} of {active.stops.length} · about {active.estMinutes} min
          </div>
        </div>

        {next ? (
          <div className="rounded-md border border-border/40 bg-background/40 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Next door · {next.band}
            </div>
            <Link href={`/accounts/${next.accountId}`} className="text-lg font-medium hover:text-primary">
              {next.name}
            </Link>
            {next.city && <span className="ml-2 text-xs text-muted-foreground">{next.city}</span>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {next.lat && next.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}`}
                  target="_blank"
                  rel="noopener"
                  className="btn-glow col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-display tracking-widest text-primary-foreground"
                >
                  <Navigation className="h-4 w-4" /> WALK THERE
                </a>
              )}
              <Link
                href={`/call/${next.accountId}`}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-border/40 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" /> Open the script
              </Link>
              <button
                type="button"
                disabled={busy === next.id}
                onClick={() => mark(next.id, 'done')}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border/40 px-3 py-2.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Talked
              </button>
              <button
                type="button"
                disabled={busy === next.id}
                onClick={() => mark(next.id, 'skipped')}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border/40 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-sm">
            Every door walked. Close it out and the shops stay in your book.
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-3 border-t border-border/25 pt-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Then ({rest.length})
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
              {rest.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 opacity-50" />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => finish('done')}
            className="rounded-md border border-border/40 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Finish the run
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => finish('abandoned')}
            className="rounded-md px-3 py-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
          >
            Drop it
          </button>
        </div>
      </section>
    );
  }

  // ---- offers ------------------------------------------------------------
  return (
    <section className="rounded-md border border-border/40 bg-sidebar/40 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Footprints className="h-4 w-4 text-primary" />
        <span className="font-display text-lg tracking-wider">GO KNOCK</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pockets of doors close enough to walk. Taking one adds every unclaimed shop in it to your
        book.
      </p>

      {offers === null ? (
        <button
          type="button"
          disabled={pending}
          onClick={look}
          className="btn-glow w-full rounded-md bg-primary px-4 py-3 font-display tracking-widest text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'LOOKING...' : 'FIND ME A RUN'}
        </button>
      ) : offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing clustered tightly enough today. Try again after the campaign has warmed a few
          more shops up.
        </p>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div
              key={o.label}
              className="rounded-md border border-border/40 bg-background/40 p-3.5"
            >
              <div className="font-medium">{o.label}</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-mono text-primary">{o.doors} doors</span>
                <span className="text-muted-foreground">about {o.estMinutes} min</span>
              </div>
              {o.reason && (
                <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{o.reason}</p>
              )}
              <button
                type="button"
                disabled={busy === o.label}
                onClick={() => go(o)}
                className={cn(
                  'btn-glow mt-3 w-full rounded-md bg-primary px-4 py-2.5 font-display tracking-widest text-primary-foreground',
                  busy === o.label && 'opacity-60',
                )}
              >
                {busy === o.label ? 'STARTING' : 'TAKE IT'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
