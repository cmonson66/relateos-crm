'use client';

import { useState, useTransition } from 'react';
import { markSetupStep } from './actions';

export type StepId = 'exchange' | 'account' | 'ready';

/**
 * The merchant's pre-visit checklist.
 *
 * Optimistic on purpose: an owner tapping "done" on a shop phone should see it
 * land immediately, and the worst case of a failed write is a rep asking about
 * something that was already handled. It reverts if the server disagrees.
 */
export function SetupChecklist({
  token,
  initial,
  steps,
}: {
  token: string;
  initial: Record<string, string | null>;
  steps: { id: StepId; n: string; title: string; body: React.ReactNode; time: string }[];
}) {
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(steps.map((s) => [s.id, Boolean(initial[s.id])])),
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = (id: StepId) => {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next }));
    setFailed(null);
    start(async () => {
      const res = await markSetupStep({ token, step: id, done: next });
      if (!res.ok) {
        setDone((d) => ({ ...d, [id]: !next }));
        setFailed('That did not save. Check your connection and try again.');
        return;
      }
      setDone(Object.fromEntries(steps.map((s) => [s.id, Boolean(res.steps[s.id])])));
    });
  };

  const complete = steps.filter((s) => done[s.id]).length;

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#0c1a2c]/10">
          <div
            className="h-full rounded-full bg-[#f2a71b] transition-all"
            style={{ width: `${(complete / steps.length) * 100}%` }}
          />
        </div>
        <div className="text-[12px] font-bold text-[#47566b]">
          {complete} of {steps.length}
        </div>
      </div>

      {failed && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {failed}
        </p>
      )}

      {steps.map((s) => {
        const isDone = done[s.id];
        return (
          <div
            key={s.id}
            className={`mb-4 rounded-2xl border bg-white p-5 ${
              isDone ? 'border-[#1f8a5b]/40' : 'border-[#0c1a2c]/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                  isDone ? 'bg-[#1f8a5b] text-white' : 'bg-[#f2a71b] text-[#0c1a2c]'
                }`}
              >
                {isDone ? '\u2713' : s.n}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold leading-tight">{s.title}</h2>
                <p className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#47566b]">
                  {s.time}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2 pl-11 text-[14px] leading-relaxed">{s.body}</div>

            <div className="mt-4 pl-11">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={isDone}
                className={`min-h-11 rounded-lg px-4 py-2.5 text-[14px] font-bold ${
                  isDone
                    ? 'border border-[#0c1a2c]/20 bg-white text-[#47566b]'
                    : 'bg-[#0c1a2c] text-white'
                }`}
              >
                {isDone ? 'Done \u2014 tap to undo' : 'Mark this done'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
