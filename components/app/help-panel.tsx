"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X, AlertTriangle, LifeBuoy } from "lucide-react";
import { helpFor } from "@/lib/help-content";

/**
 * Page help, one tap from anywhere.
 *
 * Deliberately not a guided tour: coach marks are a lot of build for something
 * people click through once and never see again, and they break every time a
 * page changes. This sits still and answers the question a rep actually has,
 * which is usually "what am I supposed to do on this screen" or "why will it
 * not let me do the thing".
 */
export function HelpPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const topic = helpFor(pathname);

  // Close on route change without a setState-in-effect on every render
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
          </aside>
        </div>
      )}
    </>
  );
}
