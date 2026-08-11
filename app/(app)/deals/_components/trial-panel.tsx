"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTrial, updateTrial, endTrial } from "../trial-actions";
import {
  TRIAL_LENGTH_OPTIONS,
  addDays,
  trialStatus,
  type TrialFields,
} from "@/lib/db/trials";

export function TrialPanel({
  dealId,
  trial,
  today,
}: {
  dealId: string;
  trial: TrialFields;
  /** Phoenix date computed on the server, so the countdown does not depend
   *  on the rep's device clock or timezone. */
  today: string;
}) {
  const router = useRouter();
  const [pending, startPending] = useTransition();
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState(trial.trial_start ?? today);
  const [days, setDays] = useState(trial.trial_days ?? 14);
  const [serial, setSerial] = useState(trial.terminal_serial ?? "");

  const status = trialStatus(trial, today);
  const running = !!status && !status.finished;

  const run = (fn: () => Promise<unknown>, ok: string) =>
    startPending(async () => {
      try {
        await fn();
        toast.success(ok);
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not save");
      }
    });

  const form = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Terminal goes in
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Terminal serial (optional)
          </label>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Off the back of the unit"
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          How long - your call
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {TRIAL_LENGTH_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                d === days
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                  : "border-border/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {d} days
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
            className="w-20 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            ends {addDays(startDate, days)}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border/40 bg-muted/20 p-2.5 text-[12px] text-muted-foreground">
        Free means free - no terminal cost and no monthly while the trial runs. A signed
        trial agreement goes in before the unit does.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                trial.trial_start
                  ? updateTrial({ dealId, startDate, days, serial })
                  : startTrial({ dealId, startDate, days, serial }),
              trial.trial_start ? "Trial updated" : "Trial started, check-ins are on your calendar",
            )
          }
          className="font-display tracking-wider btn-glow"
        >
          {trial.trial_start ? "Save" : "Start the trial"}
        </Button>
        {(trial.trial_start || editing) && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-amber-500/60" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wider">
          <Timer className="h-4 w-4 text-amber-400" /> TRIAL TERMINAL
        </h2>

        {status && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold",
                status.tone === "over"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : status.tone === "closing"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                    : "border-border/40 text-muted-foreground",
              )}
            >
              {status.finished
                ? trial.trial_outcome === "converted"
                  ? "Converted to paid"
                  : "Trial ended"
                : status.tone === "over"
                  ? `Ended ${status.endDate} - ${Math.abs(status.daysLeft)} days ago`
                  : status.label}
            </span>
            {!editing && running && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {!status && !editing && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No trial on this deal. If the owner is interested but not ready to pay, put a
            terminal in on a free trial and let the thing sell itself.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/deals/${dealId}/agreement`}>
              <Button size="sm" className="font-display tracking-wider btn-glow">Sign the trial agreement</Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="font-display tracking-wider"
            >
              Start without signing
            </Button>
          </div>
        </div>
      )}

      {editing && form}

      {status && !editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Started" value={trial.trial_start ?? "-"} />
            <Field label="Ends" value={status.endDate} />
            <Field
              label="Days left"
              value={status.finished ? "-" : String(Math.max(0, status.daysLeft))}
            />
            <Field label="Serial" value={trial.terminal_serial || "not recorded"} />
          </div>

          {!status.finished && (
            <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await endTrial({ dealId, outcome: "converted" });
                    router.push(`/deals/${dealId}/agreement?kind=purchase`);
                  }, "Now sign the purchase agreement")
                }
                className="font-display tracking-wider btn-glow"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> They are buying - start the paperwork
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => endTrial({ dealId, outcome: "returned" }), "Trial closed out")
                }
                className="font-display tracking-wider"
              >
                <PackageOpen className="mr-1.5 h-3.5 w-3.5" /> Terminal came back
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="truncate font-display text-sm tracking-wider">{value}</div>
    </div>
  );
}
