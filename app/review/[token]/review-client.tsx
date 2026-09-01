'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Block = {
  key: string;
  section: string;
  cluster: string | null;
  label: string;
  help: string;
  original: string;
  value: string;
  note: string | null;
  edited: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

export type LogRow = { label: string; who: string; at: string };

export type ReviewPayload = {
  viewer: string;
  can_edit: boolean;
  blocks: Block[];
  log: LogRow[];
};

const POLL_MS = 3000;
const DEBOUNCE_MS = 700;

const CLUSTERS = [
  { id: 'crowd', name: 'Crowd', covers: 'restaurants, barbers, nails, tattoo, sneakers, gaming, thrift, collectibles' },
  { id: 'math', name: 'Math', covers: 'auto, jewelry, powersports, med spa, pool, liquor, bike' },
  { id: 'simple', name: 'Simple', covers: 'phone repair, gyms and supplements' },
  { id: 'control', name: 'Control', covers: 'firearms, pawn, smoke, kava, cigar, adult retail' },
  { id: 'native', name: 'Crypto-native', covers: 'shops that already take crypto' },
] as const;

type ClusterId = (typeof CLUSTERS)[number]['id'];

/** The five things a rep clicks through in Call Mode, in order, plus the wall. */
const STEPS = [
  { id: 'opener', name: 'Opener', caption: 'Ten seconds. Earn the next thirty.' },
  { id: 'hook', name: 'Hook', caption: 'One reason to keep listening.' },
  { id: 'discovery', name: 'Discovery', caption: 'Their numbers, in their words.' },
  { id: 'math', name: 'The math', caption: 'Say it with their number, not yours.' },
  { id: 'close', name: 'Close', caption: 'One clear ask. Trial beats everything.' },
  { id: 'objections', name: 'Objections', caption: 'Opens over the script, mid-call.' },
  { id: 'arcs', name: 'Both arcs', caption: 'The shape of a call and of a walk-in.' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/** Which Call Mode screen a block appears on. Mirrors buildScript(). */
function stepOf(key: string): StepId {
  if (key.startsWith('arc.')) return 'arcs';
  if (key.startsWith('shared.opener')) return 'opener';
  if (key.includes('.hook')) return 'hook';
  if (key.includes('.discovery.')) return 'discovery';
  if (key.endsWith('.mathLine')) return 'math';
  if (key.includes('.close.')) return 'close';
  if (key.includes('.objection.')) return 'objections';
  return 'opener';
}

/**
 * Which blocks a given cluster actually uses. Native overrides discovery and
 * closes outright and prepends two of its own objections to the shared list
 * from the third onward - so showing Tim the shared discovery while he has
 * Crypto-native selected would show him a screen no rep will ever see.
 */
function usedBy(cluster: ClusterId, key: string): boolean {
  if (key.startsWith('arc.') || key.startsWith('shared.opener')) return true;
  if (key.startsWith('cluster.')) return key.startsWith(`cluster.${cluster}.`);
  if (cluster === 'native') {
    if (key.startsWith('shared.discovery.') || key.startsWith('shared.close.')) return false;
    if (key.startsWith('shared.objection.')) {
      const n = Number(key.split('.')[2]);
      return n >= 2;
    }
  }
  return true;
}

function when(iso: string | null): string {
  if (!iso) return '';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const strip = (s: string) => s.replace(/^"|"$/g, '');

/**
 * One line of script inside the preview, highlighted when it has been edited.
 *
 * Declared at module scope on purpose. Defined inside ReviewClient it is a new
 * component type on every render, so React remounts every preview line on each
 * keystroke - which loses focus and makes the highlight flicker.
 */
function Line({
  k,
  byKey,
  focused,
  showChanges,
  setFocused,
  register,
  className = '',
  quoted = true,
}: {
  k: string;
  byKey: Record<string, Block>;
  focused: string | null;
  showChanges: boolean;
  setFocused: (k: string) => void;
  register: (k: string, el: HTMLElement | null) => void;
  className?: string;
  quoted?: boolean;
}) {
  const b = byKey[k];
  if (!b) return null;
  const isFocus = focused === k;
  const mark = showChanges && b.edited;
  return (
    <p
      ref={(el) => register(k, el)}
      onClick={() => setFocused(k)}
      title={mark ? `Was: ${b.original}` : undefined}
      className={[
        'cursor-pointer rounded px-2 py-1 transition-colors',
        mark ? 'bg-amber-400/20 ring-1 ring-amber-400/50' : '',
        isFocus ? 'outline outline-2 outline-amber-400' : '',
        className,
      ].join(' ')}
    >
      {quoted ? strip(b.value) : b.value}
      {mark && (
        <span className="ml-2 align-middle text-[10px] font-bold uppercase text-amber-300">
          edited
        </span>
      )}
    </p>
  );
}

export function ReviewClient({ token, initial }: { token: string; initial: ReviewPayload }) {
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  const [log, setLog] = useState<LogRow[]>(initial.log);
  const [since, setSince] = useState<string>(new Date().toISOString());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const [cluster, setCluster] = useState<ClusterId>('crowd');
  const [step, setStep] = useState<StepId>('opener');
  const [focused, setFocused] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(true);

  const dirty = useRef<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Record<string, { value: string; who: string }>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const previewRefs = useRef<Record<string, HTMLElement | null>>({});

  const byKey = useMemo(() => {
    const m: Record<string, Block> = {};
    for (const b of blocks) m[b.key] = b;
    return m;
  }, [blocks]);

  const pick = useCallback(
    (prefix: string) =>
      blocks
        .filter((b) => b.key.startsWith(prefix))
        .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    [blocks]
  );

  const save = useCallback(
    async (key: string, value: string) => {
      setSaving((s) => new Set(s).add(key));
      try {
        const res = await fetch(`/api/review/${token}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
        if (res.ok) {
          const row = await res.json();
          dirty.current.delete(key);
          setBlocks((bs) =>
            bs.map((b) =>
              b.key === key
                ? { ...b, edited: row.edited, updated_at: row.updated_at, updated_by: row.updated_by }
                : b
            )
          );
        }
      } finally {
        setSaving((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [token]
  );

  const onChange = (key: string, value: string) => {
    dirty.current.add(key);
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, value } : b)));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => save(key, value), DEBOUNCE_MS);
  };

  // Focusing an editor box jumps the preview to the screen that box lives on,
  // so Tim always sees the change land where a rep would meet it.
  const onFocus = (key: string) => {
    setFocused(key);
    setStep(stepOf(key));
  };

  useEffect(() => {
    if (!focused) return;
    const el = previewRefs.current[focused];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focused, step]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/review/${token}/poll?since=${encodeURIComponent(since)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (stop) return;
        setSince(data.now);
        if (data.log?.length) setLog((l) => [...data.log, ...l].slice(0, 40));
        if (data.blocks?.length) {
          setBlocks((bs) =>
            bs.map((b) => {
              const inc = data.blocks.find((x: Block) => x.key === b.key);
              if (!inc) return b;
              if (dirty.current.has(b.key)) {
                if (inc.value !== b.value) {
                  setConflicts((c) => ({ ...c, [b.key]: { value: inc.value, who: inc.updated_by } }));
                }
                return b;
              }
              return { ...b, ...inc };
            })
          );
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one covers it.
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token, since]);


  // Bundled once so each preview line stays a plain <Line> element with a real
  // key, rather than a component rebuilt on every render.
  const register = useCallback((k: string, el: HTMLElement | null) => {
    previewRefs.current[k] = el;
  }, []);

  const shared = { byKey, focused, showChanges, setFocused, register };

  const editorBlocks = blocks.filter((b) => usedBy(cluster, b.key) && stepOf(b.key) === step);
  const editedCount = blocks.filter((b) => b.edited).length;
  const objections = pick('shared.objection.').filter((b) => usedBy(cluster, b.key));
  const nativeObjections = cluster === 'native' ? pick('cluster.native.objection.') : [];
  const closes = cluster === 'native' ? pick('cluster.native.close.') : pick('shared.close.');
  const discovery = cluster === 'native' ? pick('cluster.native.discovery.') : pick('shared.discovery.');

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <header className="sticky top-0 z-30 bg-[#0c1a2c]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <div className="text-lg font-extrabold text-white">
            Nectar<span className="text-[#f2a71b]">Pay</span>
          </div>
          <div className="text-sm text-white/70">Call script review</div>

          <div className="flex flex-wrap gap-1">
            {CLUSTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.covers}
                onClick={() => setCluster(c.id)}
                className={
                  'rounded-full px-3 py-1 text-xs font-semibold ' +
                  (cluster === c.id ? 'bg-[#f2a71b] text-[#0c1a2c]' : 'text-white/60 hover:text-white')
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          <label className="ml-auto flex items-center gap-1.5 text-xs text-white/70">
            <input
              type="checkbox"
              checked={showChanges}
              onChange={(e) => setShowChanges(e.target.checked)}
            />
            Highlight changes
          </label>
          <div className="text-xs text-white/60">
            {initial.viewer} · {editedCount} edited{!initial.can_edit && ' · read only'}
          </div>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-1 px-5 pb-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={
                'rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ' +
                (step === s.id ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/80')
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-2">
        {/* ---------------------------------------------------------- EDIT */}
        <div>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#0c1a2c]/60">
            Edit · {STEPS.find((s) => s.id === step)?.name}
          </h2>
          <p className="mb-4 text-[12px] text-[#8a94a3]">
            {CLUSTERS.find((c) => c.id === cluster)?.covers}. Saves on its own once you stop
            typing. The panel on the right is what a rep sees.
          </p>

          <div className="space-y-4">
            {editorBlocks.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#0c1a2c]/20 p-4 text-sm text-[#8a94a3]">
                This cluster does not use that screen.
              </p>
            )}
            {editorBlocks.map((b) => (
              <div
                key={b.key}
                className={
                  'rounded-lg border bg-white p-3 ' +
                  (focused === b.key ? 'border-[#c9820a] ring-2 ring-[#f2a71b]/40' : 'border-[#0c1a2c]/10')
                }
              >
                <div className="mb-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold">{b.label}</span>
                  {b.edited && (
                    <span className="rounded bg-[#f2a71b]/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a00]">
                      edited
                    </span>
                  )}
                  {saving.has(b.key) ? (
                    <span className="text-[11px] text-[#8a94a3]">saving…</span>
                  ) : (
                    b.updated_by && (
                      <span className="text-[11px] text-[#8a94a3]">
                        {b.updated_by}, {when(b.updated_at)}
                      </span>
                    )
                  )}
                </div>
                {b.help && <p className="mb-2 text-[11px] text-[#8a94a3]">{b.help}</p>}

                {conflicts[b.key] && (
                  <div className="mb-2 rounded border border-[#c9820a] bg-[#f2a71b]/10 p-2 text-[11px]">
                    <b>{conflicts[b.key].who} changed this while you were typing.</b> Yours is
                    still in the box.
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => {
                        const v = conflicts[b.key].value;
                        dirty.current.delete(b.key);
                        setBlocks((bs) => bs.map((x) => (x.key === b.key ? { ...x, value: v } : x)));
                        setConflicts((c) => {
                          const n = { ...c };
                          delete n[b.key];
                          return n;
                        });
                      }}
                    >
                      Load theirs
                    </button>
                  </div>
                )}

                <textarea
                  value={b.value}
                  readOnly={!initial.can_edit}
                  onFocus={() => onFocus(b.key)}
                  onChange={(e) => onChange(b.key, e.target.value)}
                  onBlur={(e) => {
                    clearTimeout(timers.current[b.key]);
                    if (dirty.current.has(b.key)) save(b.key, e.target.value);
                  }}
                  rows={Math.min(10, Math.max(2, Math.ceil(b.value.length / 70)))}
                  className="w-full resize-y rounded border border-[#0c1a2c]/20 bg-[#fffdf8] p-2 font-mono text-[13px] leading-relaxed outline-none focus:border-[#c9820a]"
                />

                {b.edited && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-[#8a94a3]">
                      Show what it said before
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap rounded bg-[#f1f2f4] p-2 font-mono text-[12px] text-[#47566b]">
                      {b.original}
                    </p>
                    {initial.can_edit && (
                      <button
                        type="button"
                        className="mt-1 text-[11px] underline"
                        onClick={() => {
                          dirty.current.add(b.key);
                          setBlocks((bs) =>
                            bs.map((x) => (x.key === b.key ? { ...x, value: x.original } : x))
                          );
                          save(b.key, b.original);
                        }}
                      >
                        Put it back
                      </button>
                    )}
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------- PREVIEW */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#0c1a2c]/60">
            What the rep sees
          </h2>
          <p className="mb-4 text-[12px] text-[#8a94a3]">
            Call Mode, {CLUSTERS.find((c) => c.id === cluster)?.name} cluster. Click any line to
            jump to its box on the left.
          </p>

          <div className="max-h-[72vh] overflow-y-auto rounded-2xl bg-[#0f1620] p-5 text-slate-200">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.16em] text-slate-500">
              {step === 'arcs' ? 'THE SHAPE OF A CALL' : `ON THE PHONE · ${STEPS.find((s) => s.id === step)?.caption.toUpperCase()}`}
            </div>
            <div className="mb-4 text-[11px] text-slate-500">
              {byKey[`cluster.${cluster}.label`]?.value}
            </div>

            {step === 'opener' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                  OPENER - 10 SECONDS, EARN THE NEXT 30
                </h3>
                <div className="text-[15px] leading-relaxed">
                  <Line {...shared} k="shared.opener" />
                </div>
                <div className="mt-3 space-y-1 text-[12px] italic text-slate-400">
                  {pick('shared.openerHint.').map((b) => (
                    <Line {...shared} key={b.key} k={b.key} quoted={false} />
                  ))}
                </div>
              </>
            )}

            {step === 'hook' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                  HOOK - {byKey[`cluster.${cluster}.label`]?.value.toUpperCase()}
                </h3>
                <div className="space-y-2 text-[15px] leading-relaxed">
                  {pick(`cluster.${cluster}.hook.`).map((b) => (
                    <Line {...shared} key={b.key} k={b.key} />
                  ))}
                </div>
                <div className="mt-3 text-[12px] italic text-slate-400">
                  <Line {...shared} k={`cluster.${cluster}.hookHint`} quoted={false} />
                </div>
              </>
            )}

            {step === 'discovery' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                  DISCOVERY - GET THE NUMBERS, WRITE THEM DOWN
                </h3>
                <div className="space-y-2">
                  {discovery.map((b) => (
                    <div key={b.key} className="flex items-center gap-3 rounded-xl bg-white/5 px-2 py-1.5">
                      <div className="flex-1 text-[15px]">
                        <Line {...shared} k={b.key} />
                      </div>
                      <div className="w-28 rounded-md bg-black/30 px-2 py-1 text-center text-xs text-slate-500">
                        answer
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 'math' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                  THE MATH - THEIR NUMBER, NOT YOURS
                </h3>
                <div className="mb-3 rounded-xl bg-white/5 p-3 text-[13px] text-slate-400">
                  A slider and the cost table sit here in the app. {'{vol}'} and {'{loss}'} below
                  fill in from whatever the rep drags it to.
                </div>
                <div className="text-[15px] leading-relaxed">
                  <Line {...shared} k={`cluster.${cluster}.mathLine`} />
                </div>
              </>
            )}

            {step === 'close' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                  CLOSE - ALWAYS LEAVE WITH ONE OF THESE
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {closes
                    .filter((b) => b.key.endsWith('.title'))
                    .map((t) => {
                      const base = t.key.replace(/\.title$/, '');
                      return (
                        <div key={t.key} className="rounded-xl bg-white/5 p-3">
                          <div className="mb-1 text-[13px] font-bold text-amber-400">
                            <Line {...shared} k={t.key} quoted={false} />
                          </div>
                          <div className="text-[13.5px] text-slate-300">
                            <Line {...shared} k={`${base}.script`} />
                          </div>
                          {byKey[`${base}.note`] && (
                            <div className="mt-1 text-[12px] italic text-slate-500">
                              <Line {...shared} k={`${base}.note`} quoted={false} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {step === 'objections' && (
              <>
                <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-red-400">
                  OBJECTIONS - OPENS OVER THE SCRIPT
                </h3>
                <div className="space-y-3">
                  {[...nativeObjections, ...objections]
                    .filter((b) => b.key.endsWith('.q'))
                    .map((q) => {
                      const base = q.key.replace(/\.q$/, '');
                      return (
                        <div key={q.key} className="rounded-xl bg-white/5 p-3">
                          <div className="mb-1 text-[14px] font-bold text-red-300">
                            <Line {...shared} k={q.key} />
                          </div>
                          <div className="text-[13.5px] text-slate-300">
                            <Line {...shared} k={`${base}.a`} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {step === 'arcs' && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                    ON THE PHONE
                  </h3>
                  <ol className="space-y-1.5 text-[13px]">
                    {pick('arc.phone.').map((b, i) => (
                      <li key={b.key}>
                        <span className="mr-2 text-amber-400">{i + 1}</span>
                        <span className="text-slate-400">{b.label}: </span>
                        <Line {...shared} k={b.key} quoted={false} className="inline-block" />
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="mb-2 text-[11px] font-extrabold tracking-[0.14em] text-amber-500">
                    AT THE DOOR
                  </h3>
                  <ol className="space-y-1.5 text-[13px]">
                    {pick('arc.door.').map((b, i) => (
                      <li key={b.key}>
                        <span className="mr-2 text-amber-400">{i + 1}</span>
                        <span className="text-slate-400">{b.label}: </span>
                        <Line {...shared} k={b.key} quoted={false} className="inline-block" />
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#0c1a2c]/10 bg-white p-3">
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0c1a2c]/60">
                Activity
              </h3>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {log.length === 0 && <p className="text-[12px] text-[#8a94a3]">No edits yet.</p>}
                {log.map((l, i) => (
                  <p key={`${l.at}-${i}`} className="text-[12px] leading-snug text-[#47566b]">
                    <b>{l.who}</b> edited {l.label}
                    <span className="text-[#8a94a3]"> · {when(l.at)}</span>
                  </p>
                ))}
              </div>
            </div>
            <div>
              <a
                href={`/api/review/${token}/export`}
                className="block rounded-lg bg-[#0c1a2c] px-3 py-2 text-center text-[13px] font-bold text-[#f2a71b]"
              >
                Download the changes
              </a>
              <p className="mt-1 text-[11px] leading-snug text-[#8a94a3]">
                Only the blocks that differ, as JSON, for porting back into the app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
