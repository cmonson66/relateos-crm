'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronLeft, Footprints } from 'lucide-react';
import { DaySlotPicker } from '@/components/day-slot-picker';
import { createAppointment, logWalkIn, type ApptKind } from '../../actions';

const KINDS: { id: ApptKind; label: string }[] = [
  { id: 'demo', label: 'Demo visit' },
  { id: 'install', label: 'Install' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'callback', label: 'Callback' },
];

export function QuickAppointment({
  account,
  contactId,
}: {
  account: { id: string; name: string; city: string };
  contactId: string | null;
}) {
  const [kind, setKind] = useState<ApptKind>('demo');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = (iso: string, label: string) => {
    startTransition(async () => {
      await createAppointment({
        accountId: account.id,
        contactId,
        kind,
        scheduledAt: iso,
        scheduleLabel: label,
        note,
      });
      setDone(`${KINDS.find((k) => k.id === kind)?.label} - ${label}`);
    });
  };

  const walkIn = () => {
    startTransition(async () => {
      await logWalkIn({ accountId: account.id, contactId, note });
      setDone('Walk-in visit logged - completed just now');
    });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link
        href={`/accounts/${account.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {account.name}
      </Link>

      <div className="rounded-2xl border border-border/40 bg-sidebar/60 p-5">
        <h1 className="text-lg font-extrabold">+ Appointment</h1>
        <div className="mb-4 text-xs text-muted-foreground">
          {account.name} · {account.city || '—'}
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Saved ✓ — {done}
            <div className="mt-3 flex gap-3 text-xs">
              <button onClick={() => router.push('/calendar')} className="underline">Open calendar</button>
              <button onClick={() => router.push(`/accounts/${account.id}`)} className="underline">Back to account</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors',
                    kind === k.id
                      ? k.id === 'install'
                        ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
                        : 'border-amber-500 bg-amber-500 text-slate-950'
                      : 'border-border/40 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <DaySlotPicker busy={pending} confirmPrefix="Save" onConfirm={save} />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note: owner said come by before lunch rush"
              className="mt-3 w-full rounded-xl border border-border/40 bg-background/40 px-3.5 py-2.5 text-sm"
            />

            <button
              type="button"
              onClick={walkIn}
              disabled={pending}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/40 bg-background/40 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Footprints className="h-4 w-4" /> Walk-in happened — log completed visit now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
