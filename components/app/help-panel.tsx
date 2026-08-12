"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X, AlertTriangle, LifeBuoy, Pencil } from "lucide-react";
import { helpFor, type HelpTopic } from "@/lib/help-content";
import { loadHelp, saveHelp, resetHelp } from "@/app/(app)/help-actions";

/**
 * Page help, one tap from anywhere.
 *
 * Deliberately not a guided tour: coach marks are a lot of build for something
 * people click through once and never see again, and they break every time a
 * page changes. This sits still and answers the question a rep actually has,
 * which is usually "what am I supposed to do on this screen" or "why will it
 * not let me do the thing".
 */
export function HelpPanel({ canEdit = false }: { canEdit?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  // The code copy renders instantly; a database override, if one exists,
  // replaces it once the panel opens. A fresh deployment is never blank and
  // an edited page is never stale.
  const [override, setOverride] = useState<HelpTopic | null>(null);
  const topic = override ?? helpFor(pathname);

  const [form, setForm] = useState({ title: "", what: "", steps: "", gotchas: "", stuck: "" });
  const [error, setError] = useState<string | null>(null);

  // Close on route change without a setState-in-effect on every render
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    loadHelp(pathname)
      .then((r) => { if (r.topic && r.edited) setOverride(r.topic); })
      .catch(() => {});
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!topic) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`How ${topic.title} works`}
        aria-label={`How ${topic.title} works`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close help"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border/40 bg-background shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/40 bg-background px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  How this works
                </div>
                <h2 className="font-display text-xl tracking-wider">{topic.title}</h2>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && !editing && (
                  <button
                    type="button"
                    title="Edit this page's help"
                    onClick={() => {
                      setForm({
                        title: topic.title,
                        what: topic.what,
                        steps: (topic.steps ?? []).join("\n"),
                        gotchas: (topic.gotchas ?? []).join("\n"),
                        stuck: topic.stuck ?? "",
                      });
                      setEditing(true);
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {editing ? (
              <div className="space-y-3 px-5 py-5">
                <p className="text-[12.5px] text-muted-foreground">
                  Whatever you write here replaces the built-in text for everyone in this
                  workspace. One line per step.
                </p>
                <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                <Field label="What this page is for" value={form.what} onChange={(v) => setForm({ ...form, what: v })} rows={3} />
                <Field label="How to work it, one per line" value={form.steps} onChange={(v) => setForm({ ...form, steps: v })} rows={5} />
                <Field label="Worth knowing, one per line" value={form.gotchas} onChange={(v) => setForm({ ...form, gotchas: v })} rows={5} />
                <Field label="If you are stuck" value={form.stuck} onChange={(v) => setForm({ ...form, stuck: v })} rows={2} />

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await saveHelp({ path: topic.path, ...form });
                        if (!res.ok) { setError(res.message); return; }
                        setOverride({
                          path: topic.path,
                          title: form.title || topic.title,
                          what: form.what,
                          steps: form.steps.split("\n").map((l) => l.trim()).filter(Boolean),
                          gotchas: form.gotchas.split("\n").map((l) => l.trim()).filter(Boolean),
                          stuck: form.stuck || undefined,
                        });
                        setError(null);
                        setEditing(false);
                      })
                    }
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Save for everyone
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setEditing(false); setError(null); }}
                    className="rounded-lg border border-border/40 px-4 py-2 text-sm font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await resetHelp(topic.path);
                        if (!res.ok) { setError(res.message); return; }
                        setOverride(null);
                        setEditing(false);
                      })
                    }
                    className="ml-auto text-[12px] text-muted-foreground underline"
                  >
                    Put the original back
                  </button>
                </div>
                {error && <p className="text-[12.5px] text-destructive">{error}</p>}
              </div>
            ) : (
            <div className="space-y-6 px-5 py-5">
              <p className="text-[14.5px] leading-relaxed">{topic.what}</p>

              {topic.steps && topic.steps.length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    How to work it
                  </div>
                  <ol className="space-y-2.5">
                    {topic.steps.map((s, i) => (
                      <li key={s} className="flex gap-3 text-[13.5px] leading-relaxed">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {topic.gotchas && topic.gotchas.length > 0 && (
                <div className="rounded-md border border-amber-500/35 bg-amber-500/[0.06] p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-amber-300">
                    <AlertTriangle className="h-3 w-3" /> Worth knowing
                  </div>
                  <ul className="space-y-2">
                    {topic.gotchas.map((g) => (
                      <li key={g} className="flex gap-2 text-[13px] leading-relaxed">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {topic.stuck && (
                <div className="rounded-md border border-border/40 p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <LifeBuoy className="h-3 w-3" /> If you are stuck
                  </div>
                  <p className="text-[13px] leading-relaxed">{topic.stuck}</p>
                </div>
              )}

              <p className="border-t border-border/30 pt-4 text-[12px] text-muted-foreground">
                Something here wrong or missing? Tell Chad and it gets fixed for everyone.
              </p>
            </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      {rows > 1 ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-[13px]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-[13px]"
        />
      )}
    </div>
  );
}
