'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalEvent = {
  id: string;
  type: string;
  subject: string;
  at: string;
  done: boolean;
  mine: boolean;
  owner: string;
  accountId: string | null;
  accountName: string;
  city: string;
};

const DAY_MS = 86400000;
const TZ = 'America/Phoenix';

function evtClass(e: CalEvent): string {
  if (e.subject.startsWith('Install')) return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200';
  if (e.type === 'task') return 'border-sky-500/45 bg-sky-500/10 text-sky-200';
  return 'border-amber-500/50 bg-amber-500/10 text-amber-100';
}

export function WeekView({
  events,
  weekStartIso,
  offset,
}: {
  events: CalEvent[];
  weekStartIso: string;
  offset: number;
}) {
  const weekStart = new Date(weekStartIso);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = new Date(e.at).toLocaleDateString('en-CA', { timeZone: TZ });
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const anyForeign = events.some((e) => !e.mine);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sales · Calendar</div>
          <h1 className="font-display text-3xl tracking-wider md:text-4xl">
            THE <span className="text-primary">WEEK</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?w=${offset - 1}`} className="rounded-lg border border-border/40 p-2 hover:bg-sidebar-accent/50">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {offset !== 0 && (
            <Link href="/calendar" className="rounded-lg border border-border/40 px-3.5 py-2 text-xs font-bold hover:bg-sidebar-accent/50">
              Today
            </Link>
          )}
          <Link href={`/calendar?w=${offset + 1}`} className="rounded-lg border border-border/40 p-2 hover:bg-sidebar-accent/50">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          return (
            <div
              key={k}
              className={cn(
                'min-h-[120px] rounded-xl border bg-sidebar/60 p-2.5 lg:min-h-[240px]',
                isToday ? 'border-amber-500/60' : 'border-border/40'
              )}
            >
              <div className="mb-2 flex justify-between text-[11px] font-bold tracking-wider text-muted-foreground">
                <span>{d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }).toUpperCase()}</span>
                <span className={cn(isToday && 'text-amber-400')}>
                  {d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ })}
                  {isToday && ' · TODAY'}
                </span>
              </div>
              {list.map((e) => (
                <Link
                  key={e.id}
                  href={e.accountId ? `/accounts/${e.accountId}` : '/activities'}
                  className={cn(
                    'mb-1.5 block rounded-lg border px-2.5 py-1.5 text-[12px] transition-opacity hover:opacity-80',
                    evtClass(e),
                    e.done && 'opacity-45 line-through'
                  )}
                >
                  <div className="text-[10.5px] font-extrabold opacity-85">
                    {new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })}
                    {anyForeign && e.owner && <span className="ml-1 opacity-70">· {e.owner}</span>}
                  </div>
                  <div className="truncate font-bold">{e.accountName}</div>
                  <div className="truncate text-[11px] opacity-75">{e.subject}{e.city ? ` · ${e.city}` : ''}</div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Visit</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />Callback / task</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Install</span>
        <span className="ml-auto">7:00 AM daily: agenda to reps · reminders to merchants</span>
      </div>
    </div>
  );
}
