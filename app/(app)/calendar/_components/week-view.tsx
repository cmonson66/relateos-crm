'use client';

// One calendar, three densities: Day (agenda), Week (planning grid),
// Month (the big picture). Drag-and-drop rescheduling works in week and
// month; clicking an event opens the edit panel everywhere; month cells
// click through to their day.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X, CheckCircle2, Trash2, ExternalLink, Plus, Phone, FileText, Mail, Pencil } from 'lucide-react';
import { DaySlotPicker } from '@/components/day-slot-picker';
import { rescheduleActivity, markActivityDone, cancelActivity } from '../actions';

export type CalMode = 'day' | 'week' | 'month';

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

const keyOf = (msOrIso: number | string) =>
  new Date(msOrIso).toLocaleDateString('en-CA', { timeZone: TZ });

export function CalendarView({
  events,
  view,
  rangeStartIso,
  numDays,
  label,
  offset,
  focusMonth,
}: {
  events: CalEvent[];
  view: CalMode;
  rangeStartIso: string;
  numDays: number;
  label: string;
  offset: number;
  focusMonth: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [justMoved, setJustMoved] = useState<CalEvent | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const start = new Date(rangeStartIso).getTime();
  const days = Array.from({ length: numDays }, (_, i) => new Date(start + i * DAY_MS));
  const todayKey = keyOf(Date.now());
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) byDay.set(keyOf(e.at), [...(byDay.get(keyOf(e.at)) ?? []), e]);
  const anyForeign = events.some((e) => !e.mine);

  const dropOn = (targetKey: string, evtId: string) => {
    const e = events.find((x) => x.id === evtId);
    if (!e || keyOf(e.at) === targetKey) return;
    const old = new Date(e.at);
    const [yy, mm, dd] = targetKey.split('-').map(Number);
    const phxHours = (old.getUTCHours() - 7 + 24) % 24;
    const moved = new Date(Date.UTC(yy, mm - 1, dd, phxHours + 7, old.getUTCMinutes()));
    const newLabel =
      moved.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }) +
      ' · ' + fmtT(moved.toISOString());
    startTransition(async () => {
      await rescheduleActivity(e.id, moved.toISOString(), newLabel);
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

  const href = (o: number) => `/calendar?v=${view}${o !== 0 ? `&o=${o}` : ''}`;

  // Clicking an event goes to the SHOP - that is what people are after.
  // Rescheduling is a deliberate second action on the pencil.
  const EventCard = ({ e, compact }: { e: CalEvent; compact?: boolean }) => (
    <div
      draggable={!e.done && view !== 'day'}
      onDragStart={(ev) => {
        ev.dataTransfer.setData('text/plain', e.id);
        ev.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group/evt relative mb-1 rounded-lg border transition-opacity hover:opacity-90',
        view !== 'day' && !e.done && 'cursor-grab active:cursor-grabbing',
        evtClass(e),
        e.done && 'opacity-45'
      )}
    >
      <Link
        href={e.accountId ? `/accounts/${e.accountId}` : '/calendar'}
        draggable={false}
        onDragStart={(ev) => ev.preventDefault()}
        onClick={(ev) => ev.stopPropagation()}
        className={cn(
          'block w-full text-left',
          compact ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1.5 text-[12px]',
          e.done && 'line-through'
        )}
      >
        {compact ? (
          <div className="truncate pr-4 font-bold">{fmtT(e.at)} {e.accountName}</div>
        ) : (
          <>
            <div className="text-[10.5px] font-extrabold opacity-85">
              {fmtT(e.at)}
              {anyForeign && e.owner && <span className="ml-1 opacity-70">· {e.owner}</span>}
            </div>
            <div className="truncate pr-4 font-bold">{e.accountName}</div>
            <div className="truncate text-[11px] opacity-75">{e.subject}{e.city ? ` · ${e.city}` : ''}</div>
          </>
        )}
      </Link>
      <button
        type="button"
        title="Reschedule, mark done, cancel"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setEditing(e); }}
        className="absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/20 focus:opacity-100 group-hover/evt:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sales · Calendar</div>
          <h1 className="font-display text-2xl tracking-wider md:text-4xl">
            {label.toUpperCase()}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/40 p-0.5">
            {(['day', 'week', 'month'] as CalMode[]).map((v) => (
              <Link
                key={v}
                href={`/calendar?v=${v}`}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider',
                  view === v ? 'bg-amber-500 text-slate-950' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v}
              </Link>
            ))}
          </div>
          <Link href={href(offset - 1)} className="rounded-lg border border-border/40 p-2 hover:bg-sidebar-accent/50">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {offset !== 0 && (
            <Link href={`/calendar?v=${view}`} className="rounded-lg border border-border/40 px-3.5 py-2 text-xs font-bold hover:bg-sidebar-accent/50">
              Today
            </Link>
          )}
          <Link href={href(offset + 1)} className="rounded-lg border border-border/40 p-2 hover:bg-sidebar-accent/50">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ---------------- DAY: the agenda ---------------- */}
      {view === 'day' && (
        <div className="mx-auto max-w-2xl">
          {(byDay.get(keyOf(start)) ?? []).length === 0 && (
            <div className="rounded-xl border border-border/40 bg-sidebar/60 p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled. The doors won't knock themselves.
            </div>
          )}
          {(byDay.get(keyOf(start)) ?? []).map((e) => (
            <div key={e.id} className={cn('mb-2.5 rounded-xl border p-3.5', evtClass(e), e.done && 'opacity-45')}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">{fmtT(e.at)}{anyForeign && e.owner ? ` · ${e.owner}` : ''}</div>
                <div className="flex gap-2">
                  {e.accountId && (
                    <Link href={`/call/${e.accountId}`} className="rounded-md border border-current/30 p-1.5 opacity-80 hover:opacity-100" title="Call mode">
                      <Phone className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {e.accountId && (
                    <Link href={`/call/${e.accountId}/sheet`} className="rounded-md border border-current/30 p-1.5 opacity-80 hover:opacity-100" title="Walk-in sheet">
                      <FileText className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {e.accountId && (
                    <Link href={`/send/${e.accountId}`} className="rounded-md border border-current/30 p-1.5 opacity-80 hover:opacity-100" title="Send a message">
                      <Mail className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  <button onClick={() => setEditing(e)} className="rounded-md border border-current/30 px-2.5 py-1 text-[11px] font-bold opacity-80 hover:opacity-100">
                    Edit
                  </button>
                </div>
              </div>
              {e.accountId ? (
                <Link href={`/accounts/${e.accountId}`} className={cn('mt-1 block text-base font-bold underline-offset-2 hover:underline', e.done && 'line-through')}>
                  {e.accountName}
                </Link>
              ) : (
                <div className={cn('mt-1 text-base font-bold', e.done && 'line-through')}>{e.accountName}</div>
              )}
              <div className="text-xs opacity-75">{e.subject}{e.city ? ` · ${e.city}` : ''}</div>
            </div>
          ))}
          <Link
            href={`/appointments/new?date=${keyOf(start)}`}
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-border/40 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Book on this day
          </Link>
        </div>
      )}

      {/* ---------------- WEEK ---------------- */}
      {view === 'week' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((dObj) => {
            const k = keyOf(dObj.getTime());
            const list = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            return (
              <div
                key={k}
                onDragOver={(ev) => { ev.preventDefault(); setDragOver(k); }}
                onDragLeave={() => setDragOver((cur) => (cur === k ? null : cur))}
                onDrop={(ev) => { ev.preventDefault(); setDragOver(null); dropOn(k, ev.dataTransfer.getData('text/plain')); }}
                className={cn(
                  'group min-h-[120px] rounded-xl border bg-sidebar/60 p-2.5 transition-colors lg:min-h-[240px]',
                  isToday ? 'border-amber-500/60' : 'border-border/40',
                  dragOver === k && 'border-emerald-500/70 bg-emerald-500/[0.06]'
                )}
              >
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold tracking-wider text-muted-foreground">
                  <span>{dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }).toUpperCase()}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn(isToday && 'text-amber-400')}>
                      {dObj.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ })}
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
                {list.map((e) => <EventCard key={e.id} e={e} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- MONTH ---------------- */}
      {view === 'month' && (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-widest text-muted-foreground">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((dObj) => {
              const k = keyOf(dObj.getTime());
              const list = byDay.get(k) ?? [];
              const isToday = k === todayKey;
              const inMonth = focusMonth === null || dObj.getUTCMonth() === focusMonth;
              return (
                <div
                  key={k}
                  onClick={() => router.push(`/calendar?v=day&d=${k}`)}
                  onDragOver={(ev) => { ev.preventDefault(); setDragOver(k); }}
                  onDragLeave={() => setDragOver((cur) => (cur === k ? null : cur))}
                  onDrop={(ev) => { ev.preventDefault(); ev.stopPropagation(); setDragOver(null); dropOn(k, ev.dataTransfer.getData('text/plain')); }}
                  className={cn(
                    'min-h-[86px] cursor-pointer rounded-lg border bg-sidebar/60 p-1.5 transition-colors md:min-h-[104px]',
                    isToday ? 'border-amber-500/60' : 'border-border/40',
                    !inMonth && 'opacity-40',
                    dragOver === k && 'border-emerald-500/70 bg-emerald-500/[0.06]'
                  )}
                >
                  <div className={cn('mb-1 text-right text-[10.5px] font-bold', isToday ? 'text-amber-400' : 'text-muted-foreground')}>
                    {dObj.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ })}
                  </div>
                  {list.slice(0, 3).map((e) => <EventCard key={e.id} e={e} compact />)}
                  {list.length > 3 && (
                    <div className="px-1 text-[10px] font-bold text-muted-foreground">+{list.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view !== 'day' && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Visit</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />Callback / task</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Install</span>
          <span className="hidden sm:inline">Drag to a new day · click to edit{view === 'month' ? ' · click a day to zoom in' : ''}</span>
          <span className="ml-auto">7:00 AM daily: agenda to reps · reminders to merchants</span>
        </div>
      )}

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
            presetDate={keyOf(justMoved.at)}
            onConfirm={(iso, l) => act(() => rescheduleActivity(justMoved.id, iso, l))}
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
                onConfirm={(iso, l) => act(() => rescheduleActivity(editing.id, iso, l))}
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
