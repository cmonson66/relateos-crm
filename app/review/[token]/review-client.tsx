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

function when(iso: string | null): string {
  if (!iso) return '';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ReviewClient({ token, initial }: { token: string; initial: ReviewPayload }) {
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks);
  const [log, setLog] = useState<LogRow[]>(initial.log);
  const [since, setSince] = useState<string>(new Date().toISOString());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  /**
   * Blocks this person has touched and not yet had confirmed. A poll must
   * never overwrite one of these - two people editing at once is the entire
   * point of the page, and clobbering someone mid-sentence would make it
   * useless. Incoming changes to a dirty block surface as a banner instead.
   */
  const dirty = useRef<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Record<string, { value: string; who: string }>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // Poll for the other person's edits.
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

  const sections = useMemo(() => {
    const out: { name: string; blocks: Block[] }[] = [];
    for (const b of blocks) {
      const last = out[out.length - 1];
      if (last && last.name === b.section) last.blocks.push(b);
      else out.push({ name: b.section, blocks: [b] });
    }
    return out;
  }, [blocks]);

  const editedCount = blocks.filter((b) => b.edited).length;

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <header className="sticky top-0 z-20 border-b border-[#0c1a2c]/10 bg-[#0c1a2c]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
          <div className="text-lg font-extrabold text-white">
            Nectar<span className="text-[#f2a71b]">Pay</span>
          </div>
          <div className="text-sm text-white/70">Call script review</div>
          <div className="ml-auto text-xs text-white/60">
            {initial.viewer} · {editedCount} edited
            {!initial.can_edit && ' · read only'}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#47566b]">
          Every box below is a piece of the live call script. Edit anything in place. Changes save
          on their own a moment after you stop typing, and whoever else has this page open sees
          them within a few seconds. Nothing here goes live to reps until it is ported back into
          the app, so mark it up freely.
        </p>

        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.name}>
                <h2 className="mb-3 border-b border-[#0c1a2c]/15 pb-1 text-xs font-bold uppercase tracking-wider text-[#0c1a2c]/60">
                  {s.name}
                </h2>
                <div className="space-y-4">
                  {s.blocks.map((b) => (
                    <div key={b.key} className="rounded-lg border border-[#0c1a2c]/10 bg-white p-3">
                      <div className="mb-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold">{b.label}</span>
                        {b.edited && (
                          <span className="rounded bg-[#f2a71b]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a00]">
                            edited
                          </span>
                        )}
                        {saving.has(b.key) && <span className="text-[11px] text-[#8a94a3]">saving…</span>}
                        {!saving.has(b.key) && b.updated_by && (
                          <span className="text-[11px] text-[#8a94a3]">
                            {b.updated_by}, {when(b.updated_at)}
                          </span>
                        )}
                      </div>
                      {b.help && <p className="mb-2 text-[11px] text-[#8a94a3]">{b.help}</p>}

                      {conflicts[b.key] && (
                        <div className="mb-2 rounded border border-[#c9820a] bg-[#f2a71b]/10 p-2 text-[11px]">
                          <b>{conflicts[b.key].who} changed this while you were typing.</b> Your
                          version is still in the box.
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
                        onChange={(e) => onChange(b.key, e.target.value)}
                        onBlur={(e) => {
                          clearTimeout(timers.current[b.key]);
                          if (dirty.current.has(b.key)) save(b.key, e.target.value);
                        }}
                        rows={Math.min(10, Math.max(2, Math.ceil(b.value.length / 78)))}
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
              </section>
            ))}
          </div>

          <aside className="md:sticky md:top-20 md:self-start">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0c1a2c]/60">
              Activity
            </h2>
            <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-lg border border-[#0c1a2c]/10 bg-white p-3">
              {log.length === 0 && <p className="text-[12px] text-[#8a94a3]">No edits yet.</p>}
              {log.map((l, i) => (
                <p key={`${l.at}-${i}`} className="text-[12px] leading-snug text-[#47566b]">
                  <b>{l.who}</b> edited {l.label}
                  <span className="text-[#8a94a3]"> · {when(l.at)}</span>
                </p>
              ))}
            </div>
            <a
              href={`/api/review/${token}/export`}
              className="mt-3 block rounded-lg bg-[#0c1a2c] px-3 py-2 text-center text-[13px] font-bold text-[#f2a71b]"
            >
              Download the changes
            </a>
            <p className="mt-1 text-[11px] leading-snug text-[#8a94a3]">
              Only the blocks that differ from the original, as JSON, for porting back into the
              app.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
