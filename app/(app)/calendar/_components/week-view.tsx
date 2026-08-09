'use client';

// Week view with native drag-and-drop rescheduling. Drop keeps the event's
// time and immediately offers a time adjust; clicking an event opens the
// edit panel (reschedule / mark done / cancel / open account); every day
// has a + to book directly onto that date.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X, CheckCircle2, Trash2, ExternalLink, Plus } from 'lucide-react';
import { DaySlotPicker } from '@/components/day-slot-picker';
import { rescheduleActivity, markActivityDone, cancelActivity } from '../actions';

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

const fmtT = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

export function WeekView({
  events,
  weekStartIso,
  offset,
}: {
  events: CalEvent[];
  weekStartIso: string;
  offset: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [justMoved, setJustMoved] = useState<CalEvent | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

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

  const dropOn = (targetKey: string, evtId: string) => {
    const e = events.find((x) => x.id === evtId);
    if (!e) return;
    const fromKey = new Date(e.at).toLocaleDateString('en-CA', { timeZone: TZ });
    if (fromKey === targetKey) return;
    // Keep the clock time, swap the date (Phoenix = UTC-7, no DST)
    const old = new Date(e.at);
    const [y, m, d] = targetKey.split('-').map(Number);
    const phxHours = (old.getUTCHours() - 7 + 24) % 24;
    const moved = new Date(Date.UTC(y, m - 1, d, phxHours + 7, old.getUTCMinutes()));
    const label =
      moved.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }) +
      ' · ' + fmtT(moved.toISOString());
    startTransition(async () => {
      await rescheduleActivity(e.id, moved.toISOString(), label);
      setJustMoved({ ...e, at: moved.toISOString() });
      router.refresh();
    });
  };

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      setEditing(null);
      setJustMoved(null);
      router.refresh();
    });

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
              onDragOver={(ev) => { ev.preventDefault(); setDragOver(k); }}
              onDragLeave={() => setDragOver((cur) => (cur === k ? null : cur))}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOver(null);
                dropOn(k, ev.dataTransfer.getData('text/plain'));
              }}
              className={cn(
                'group min-h-[120px] rounded-xl border bg-sidebar/60 p-2.5 transition-colors lg:min-h-[240px]',
                isToday ? 'border-amber-500/60' : 'border-border/40',
                dragOver === k && 'border-emerald-500/70 bg-emerald-500/[0.06]'
              )}
            >
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-wider text-muted-foreground">
                <span>{d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }).toUpperCase()}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn(isToday && 'text-amber-400')}>
                    {d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ })}
                    {isToday && ' · TODAY'}
                  </span>
                  <Link
                    href={`/appointments/new?date=${k}`}
                    title="Book on this day"
                    className="rounded-md border border-border/40 p-0.5 opacity-0 transition-opacity hover:text-amber-400 group-hover:opacity-100"
                  >
                    <Plus className="h-3 w-3" />
                  </Link>
                </span>
              </div>
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  draggable={!e.done}
                  onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.id)}
                  onClick={() => setEditing(e)}
                  className={cn(
                    'mb-1.5 block w-full cursor-grab rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition-opacity hover:opacity-80 active:cursor-grabbing',
                    evtClass(e),
                    e.done && 'opacity-45 line-through'
                  )}
                >
                  <div className="text-[10.5px] font-extrabold opacity-85">
                    {fmtT(e.at)}
                    {anyForeign && e.owner && <span className="ml-1 opacity-70">· {e.owner}</span>}
                  </div>
                  <div className="truncate font-bold">{e.accountName}</div>
                  <div className="truncate text-[11px] opacity-75">{e.subject}{e.city ? ` · ${e.city}` : ''}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Visit</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />Callback / task</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Install</span>
        <span className="hidden sm:inline">Drag to a new day · click to edit</span>
        <span className="ml-auto">7:00 AM daily: agenda to reps · reminders to merchants</span>
      </div>

      {/* ---- post-drop time adjust ---- */}
      {justMoved && !editing && (
        <Panel onClose={() => setJustMoved(null)}>
          <div className="mb-1 text-sm font-extrabold">{justMoved.accountName}</div>
          <div className="mb-2 text-xs text-muted-foreground">
            Moved ✓ — now {new Date(justMoved.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })} at {fmtT(justMoved.at)}. Time need a reset?
          </div>
          <DaySlotPicker
            busy={pending}
            confirmPrefix="Set new time"
            presetDate={new Date(justMoved.at).toLocaleDateString('en-CA', { timeZone: TZ })}
            onConfirm={(iso, label) => act(() => rescheduleActivity(justMoved.id, iso, label))}
          />
          <button onClick={() => setJustMoved(null)} className="mt-2 w-full rounded-xl border border-border/40 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
            Keep {fmtT(justMoved.at)}
          </button>
        </Panel>
      )}

      {/* ---- click-to-edit ---- */}
      {editing && (
        <Panel onClose={() => setEditing(null)}>
          <div className="mb-0.5 text-sm font-extrabold">{editing.accountName}</div>
          <div className="mb-3 text-xs text-muted-foreground">
            {editing.subject} · {new Date(editing.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })} {fmtT(editing.at)}
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs font-bold">
            {editing.accountId && (
              <Link href={`/accounts/${editing.accountId}`} className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/40 py-2 hover:bg-sidebar-accent/50">
                <ExternalLink className="h-3.5 w-3.5" /> Account
              </Link>
            )}
            {!editing.done && (
              <button disabled={pending} onClick={() => act(() => markActivityDone(editing.id))} className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 py-2 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> Done
              </button>
            )}
            <button disabled={pending} onClick={() => act(() => cancelActivity(editing.id))} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-500/40 py-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
          {!editing.done && (
            <>
              <div className="mb-1 text-[11px] font-extrabold tracking-[0.12em] text-muted-foreground">RESCHEDULE</div>
              <DaySlotPicker
                busy={pending}
                confirmPrefix="Move"
                onConfirm={(iso, label) => act(() => rescheduleActivity(editing.id, iso, label))}
              />
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-sidebar p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex justify-end">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
