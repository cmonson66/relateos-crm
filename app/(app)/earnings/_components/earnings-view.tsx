"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Coins, TrendingUp } from "lucide-react";
import {
  ladderProgress,
  nextSaleOutlook,
  weeklyBonusCents,
  type CompTier,
} from "@/lib/db/comp";

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Phoenix",
  });

type Week = {
  startsOn: string;
  sales: number;
  deals: { id: string; name: string; valueCents: number; at: string }[];
};

export function EarningsView({
  isLead,
  firstName,
  baseWeeklyCents,
  tiers,
  weeks,
}: {
  isLead: boolean;
  firstName: string;
  baseWeeklyCents: number;
  tiers: CompTier[];
  weeks: Week[];
}) {
  const thisWeek = weeks[0];
  const bonus = weeklyBonusCents(thisWeek.sales, tiers);
  const outlook = nextSaleOutlook(thisWeek.sales, tiers);
  const ladder = ladderProgress(thisWeek.sales, tiers);

  const sixWeekBonus = weeks.reduce((n, w) => n + weeklyBonusCents(w.sales, tiers), 0);
  const sixWeekSales = weeks.reduce((n, w) => n + w.sales, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <h1 className="font-display text-3xl tracking-wider">
        EARN<span className="text-primary">INGS</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLead ? "The whole team, week by week." : `Where you stand this week, ${firstName}.`}
      </p>

      {/* this week */}
      <div className="card-lit relative mt-6 rounded-md border border-border/40 p-5">
        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              This week
            </div>
            <div className="font-display text-4xl tracking-wider">
              {thisWeek.sales}
              <span className="ml-2 text-lg text-muted-foreground">
                sale{thisWeek.sales === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Bonus so far
            </div>
            <div className="font-display text-4xl tracking-wider text-primary">{usd(bonus)}</div>
            <div className="text-[11px] text-muted-foreground">
              plus {usd(baseWeeklyCents)} base
            </div>
          </div>
        </div>

        {/* the ladder, filled to where the week actually is */}
        <div className="mt-5 space-y-1.5">
          {ladder.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {t.label}
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-muted/30">
                <div
                  className={cn(
                    "h-full transition-all",
                    t.bonusCents === 0 ? "bg-muted-foreground/30" : "bg-primary/70",
                  )}
                  style={{ width: `${(t.filled / t.width) * 100}%` }}
                />
              </div>
              <div
                className={cn(
                  "w-20 shrink-0 text-right font-display text-sm tracking-wider",
                  t.reached ? "text-foreground" : "text-muted-foreground/50",
                )}
              >
                {t.bonusCents === 0 ? "no bonus" : `${usd(t.bonusCents)} ea`}
              </div>
            </div>
          ))}
        </div>

        {/* the number that changes behaviour on a Thursday */}
        <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/[0.06] p-3 text-[13px]">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <span className="font-bold">
              Your next sale this week is worth {usd(outlook.nextSaleCents)}
              {outlook.nextSaleCents === 0 ? " in bonus" : ""}.
            </span>
            {outlook.salesToNextTier !== null && outlook.nextTierCents !== null && (
              <>
                {" "}
                {outlook.salesToNextTier === 0
                  ? `The one after moves you to ${usd(outlook.nextTierCents)} each.`
                  : `${outlook.salesToNextTier} more after that and every sale becomes ${usd(
                      outlook.nextTierCents,
                    )}.`}
              </>
            )}
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              Brackets are not retroactive - each sale pays the rate of the bracket it lands in,
              and the ladder resets Monday.
            </div>
          </div>
        </div>
      </div>

      {/* recent weeks */}
      <div className="mt-4 flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wider">LAST SIX WEEKS</h2>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          {sixWeekSales} sales · {usd(sixWeekBonus)} in bonus
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {weeks.map((w, i) => {
          const wb = weeklyBonusCents(w.sales, tiers);
          return (
            <div key={w.startsOn} className="rounded-md border border-border/40 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {i === 0 ? "This week" : `Week of ${w.startsOn}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {w.sales} sale{w.sales === 1 ? "" : "s"}
                    {w.sales === 0 ? " · base only" : ""}
                  </div>
                </div>
                <div className="shrink-0 font-display text-sm tracking-wider text-primary">
                  {usd(wb)}
                </div>
              </div>

              {w.deals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/30 pt-2">
                  {w.deals.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deals/${d.id}`}
                      className="rounded-full border border-border/40 px-2.5 py-1 text-[11px] hover:bg-sidebar-accent/50"
                    >
                      {d.name} · {day(d.at)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[11.5px] text-muted-foreground">
        A sale counts the week its invoice is paid, not the week the paperwork was signed.
      </p>
    </div>
  );
}
