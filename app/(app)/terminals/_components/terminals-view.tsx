"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PackagePlus, Radio, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveTerminals, assignTerminal, returnTerminal } from "../actions";

type Row = {
  id: string;
  serial: string;
  model: string;
  status: string;
  heldBy: string | null;
  heldById: string | null;
  shop: string | null;
  accountId: string | null;
  deployedAt: string | null;
};

const STATUSES: { id: string; label: string; tone: string }[] = [
  { id: "deployed", label: "In shops", tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  { id: "with_rep", label: "With reps", tone: "border-amber-500/50 bg-amber-500/10 text-amber-300" },
  { id: "in_stock", label: "In stock", tone: "border-sky-500/50 bg-sky-500/10 text-sky-300" },
  { id: "damaged", label: "Damaged", tone: "border-destructive/50 bg-destructive/10 text-destructive" },
  { id: "lost", label: "Lost", tone: "border-destructive/50 bg-destructive/10 text-destructive" },
];

const daysSince = (iso: string | null) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null;

export function TerminalsView({
  terminals,
  people,
}: {
  terminals: Row[];
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<string | null>(null);
  const [serials, setSerials] = useState("");
  const [showReceive, setShowReceive] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of terminals) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [terminals]);

  const shown = filter ? terminals.filter((t) => t.status === filter) : terminals;

  // Actions RETURN their failure reason rather than throwing, because Next
  // strips thrown messages from server actions in production builds.
  const run = (fn: () => Promise<{ ok: boolean; message?: string } | void>, ok: string) =>
    start(async () => {
      try {
        const res = await fn();
        if (res && res.ok === false) {
          toast.error(res.message ?? "That did not work");
          return;
        }
        toast.success(ok);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not work");
      }
    });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-wider">
            TERMI<span className="text-primary">NALS</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every unit, where it is, and how long it has been there.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowReceive((v) => !v)}
          className="font-display tracking-wider btn-glow"
        >
          <PackagePlus className="mr-1.5 h-3.5 w-3.5" /> Receive stock
        </Button>
      </div>

      {showReceive && (
        <div className="mb-5 rounded-md border border-border/40 p-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Paste serials, one per line
          </div>
          <textarea
            value={serials}
            onChange={(e) => setSerials(e.target.value)}
            rows={4}
            placeholder={"2586462547\n2586462548"}
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 font-mono text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={pending || !serials.trim()}
              onClick={() =>
                run(async () => {
                  const res = await receiveTerminals({ serials });
                  setSerials("");
                  setShowReceive(false);
                  return res;
                }, "Stock added")
              }
              className="font-display tracking-wider"
            >
              Add to stock
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowReceive(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* status counts double as filters */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((s) => {
          const n = counts.get(s.id) ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(filter === s.id ? null : s.id)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                filter === s.id ? s.tone : "border-border/40 hover:bg-sidebar-accent/40",
              )}
            >
              <div className="font-display text-2xl tracking-wider tabular-nums">{n}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-md border border-border/40 p-8 text-center text-sm text-muted-foreground">
          {terminals.length === 0
            ? "No terminals yet. Paste the serials from your first shipment above."
            : "Nothing with that status."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((t) => {
            const days = daysSince(t.deployedAt);
            return (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{t.serial}</span>
                    {t.status === "deployed" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                        <Radio className="h-2.5 w-2.5" /> In a shop
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {t.shop && t.accountId ? (
                      <>
                        <Link href={`/accounts/${t.accountId}`} className="hover:text-foreground">
                          {t.shop}
                        </Link>
                        {days !== null ? ` · ${days} day${days === 1 ? "" : "s"} out` : ""}
                      </>
                    ) : t.heldBy ? (
                      `Carried by ${t.heldBy}`
                    ) : (
                      t.model
                    )}
                  </div>
                </div>

                {t.status !== "deployed" && (
                  <select
                    value={t.heldById ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(
                        () =>
                          assignTerminal({
                            terminalId: t.id,
                            profileId: e.target.value || null,
                          }),
                        e.target.value ? "Assigned" : "Back to stock",
                      )
                    }
                    className="shrink-0 rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs [color-scheme:dark]"
                  >
                    <option value="">In stock</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}

                {t.status === "deployed" && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => returnTerminal({ terminalId: t.id, outcome: "returned" }),
                          "Back in stock",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2.5 py-1.5 text-xs font-bold hover:bg-sidebar-accent/50"
                    >
                      <Undo2 className="h-3 w-3" /> Came back
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => returnTerminal({ terminalId: t.id, outcome: "damaged" }),
                          "Marked damaged",
                        )
                      }
                      className="rounded-md border border-border/40 px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-destructive"
                    >
                      Damaged
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
