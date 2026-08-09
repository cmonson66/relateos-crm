'use client';

// Two-tap scheduler: day chips × time chips, with "Pick date…" and
// "Pick time…" escape hatches. Shared by Call Mode dispositions and the
// road-mode quick appointment.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const SLOTS = [
  { label: 'Morning', h: 9, m: 0 },
  { label: 'Midday', h: 12, m: 0 },
  { label: 'Afternoon', h: 15, m: 0 },
] as const;

const DAY_MS = 86400000;

function dayLabel(d: Date, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

export function DaySlotPicker({
  onConfirm,
  confirmPrefix = 'Confirm',
  busy = false,
  presetDate,
}: {
  onConfirm: (iso: string, label: string) => void;
  confirmPrefix?: string;
  busy?: boolean;
  presetDate?: string; // YYYY-MM-DD - preselects Pick date
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const base = new Date();
    for (let i = 0; i < 5; i++) out.push(new Date(base.getTime() + i * DAY_MS));
    return out;
  }, []);

  const [dayIdx, setDayIdx] = useState<number | 'custom'>(presetDate ? 'custom' : 1);
  const [customDate, setCustomDate] = useState(presetDate ?? '');
  const [slotIdx, setSlotIdx] = useState<number | 'custom'>(0);
  const [customTime, setCustomTime] = useState('');

  const chosen = useMemo(() => {
    let d: Date | null = null;
    if (dayIdx === 'custom') {
      if (!customDate) return null;
      const [y, m, dd] = customDate.split('-').map(Number);
      d = new Date(y, m - 1, dd);
    } else {
      d = new Date(days[dayIdx]);
    }
    let h = 9, mi = 0, slotLabel = 'Morning';
    if (slotIdx === 'custom') {
      if (!customTime) return null;
      const [hh, mm] = customTime.split(':').map(Number);
      h = hh; mi = mm;
      slotLabel = new Date(2000, 0, 1, h, mi).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      h = SLOTS[slotIdx].h; mi = SLOTS[slotIdx].m;
      slotLabel = SLOTS[slotIdx].label;
    }
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi);
    const dLabel =
      dayIdx === 0 ? 'Today' : dayIdx === 1 ? 'Tomorrow'
      : at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { iso: at.toISOString(), label: `${dLabel} · ${slotLabel}` };
  }, [dayIdx, customDate, slotIdx, customTime, days]);

  const chip = (on: boolean) =>
    cn(
      'rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors',
      on ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-border/40 text-muted-foreground hover:text-foreground'
    );

  return (
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3.5">
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {days.map((d, i) => (
          <button key={i} type="button" onClick={() => setDayIdx(i)} className={chip(dayIdx === i)}>
            {dayLabel(d, i)}
          </button>
        ))}
        <button type="button" onClick={() => setDayIdx('custom')} className={chip(dayIdx === 'custom')}>
          Pick date…
        </button>
        {dayIdx === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-md border border-border/40 bg-background px-2 py-1 text-xs [color-scheme:dark]"
          />
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SLOTS.map((s, i) => (
          <button key={s.label} type="button" onClick={() => setSlotIdx(i)} className={chip(slotIdx === i)}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => setSlotIdx('custom')} className={chip(slotIdx === 'custom')}>
          Pick time…
        </button>
        {slotIdx === 'custom' && (
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="rounded-md border border-border/40 bg-background px-2 py-1 text-xs [color-scheme:dark]"
          />
        )}
      </div>
      <button
        type="button"
        disabled={!chosen || busy}
        onClick={() => chosen && onConfirm(chosen.iso, chosen.label)}
        className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-extrabold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        ✓ {confirmPrefix}{chosen ? ` — ${chosen.label}` : ''}
      </button>
    </div>
  );
}
