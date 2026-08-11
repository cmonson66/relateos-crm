"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Target, Coins, Repeat } from "lucide-react";

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Phoenix",
  });

export function EarningsView({
  isLead,
  firstName,
  quota,
  soldThisWeek,
  soldThisMonth,
  bonusCents,
  residualPct,
  monthBonusCents,
  monthResidualCents,
  recent,
}: {
  isLead: boolean;
  firstName: string;
  quota: number;
  soldThisWeek: number;
  soldThisMonth: number;
  bonusCents: number;
  residualPct: number;
  monthBonusCents: number;
  monthResidualCents: number;
  recent: { id: string; name: string; valueCents: number; monthlyCents: number; at: string }[];
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((soldThisWeek / quota) * 100)) : 0;
  const toGo = Math.max(0, quota - soldThisWeek);
  const compSet = bonusCents > 0 || residualPct > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <h1 className="font-display text-3xl tracking-wider">
        EARN<span className="text-primary">INGS</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLead ? "Everything the team has closed this month." : `What you have closed, ${firstName}.`}
      </p>

      {/* quota */}
      <div className="card-lit relative mt-6 rounded-md border border-border/40 p-5">
        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wider">
            <Target className="h-4 w-4 text-primary" /> THIS WEEK
          </h2>
          <div className="text-sm text-muted-foreground">
            {soldThisWeek} of {quota}
            {toGo > 0 ? ` · ${toGo} to go` : " · quota met"}
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 100 ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          A sale counts when the invoice is paid, not when the paperwork is signed.
        </p>
      </div>

      {/* money */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile
          icon={Coins}
          label="Bonus, month to date"
          value={usd(monthBonusCents)}
          sub={bonusCents > 0 ? `${usd(bonusCents)} per merchant` : "no bonus set"}
        />
        <Tile
          icon={Repeat}
          label="Residual, month to date"
          value={usd(monthResidualCents)}
          sub={residualPct > 0 ? `${residualPct}% of membership` : "no residual set"}
        />
        <Tile
          icon={Target}
          label="Merchants this month"
          value={soldThisMonth.toString()}
          sub="live and paid"
        />
      </div>

      {!compSet && (
        <div className="mt-3 rounded-md border border-border/40 bg-muted/20 p-3 text-[12.5px] text-muted-foreground">
          No comp terms are set on your rep record yet, so the money figures read zero. Chad can
          set the per-merchant bonus and residual percentage and these fill in.
        </div>
      )}

      {/* the deals behind the numbers */}
      <h2 className="mb-2 mt-7 font-display text-lg tracking-wider">WHAT IS BEHIND IT</h2>
      {recent.length === 0 ? (
        <div className="rounded-md border border-border/40 p-8 text-center text-sm text-muted-foreground">
          Nothing closed this month yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {recent.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.id}`}
              className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2.5 hover:bg-sidebar-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {day(d.at)}
                  {d.monthlyCents > 0 ? ` · ${usd(d.monthlyCents)}/mo recurring` : ""}
                </div>
              </div>
              <div className="shrink-0 font-display text-sm tracking-wider text-primary">
                {usd(d.valueCents)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-border/40 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-display text-2xl tracking-wider">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
