import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { EarningsView } from "./_components/earnings-view";

export const dynamic = "force-dynamic";

// Phoenix has no DST, so the whole app anchors on UTC-7.
const PHX = 7 * 3600000;

function phxWeekStartUtc(): Date {
  const now = new Date(Date.now() - PHX);
  const day = now.getUTCDay(); // 0 = Sunday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return new Date(monday.getTime() + PHX);
}

function phxMonthStartUtc(): Date {
  const now = new Date(Date.now() - PHX);
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return new Date(first.getTime() + PHX);
}

export default async function EarningsPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const isLead = ["super_admin", "admin", "manager"].includes(profile.role);
  const weekStart = phxWeekStartUtc();
  const monthStart = phxMonthStartUtc();

  // Comp terms live on the rep row so a plan change is data, not a deploy.
  const { data: comp } = await supabase
    .from("reps")
    .select("profile_id, first_name, quota_weekly, bonus_per_sale_cents, residual_pct")
    .eq(profile.role === "rep" ? "profile_id" : "profile_id", profile.id)
    .maybeSingle();

  // Won deals are the unit of pay. A deal is won only once the invoice is
  // paid, so this can never count money that has not arrived.
  const { data: wonRows } = await supabase
    .from("deals_with_stage")
    .select("id, name, owner_id, value_cents, updated_at, stage_is_won")
    .eq("stage_is_won", true)
    .gte("updated_at", monthStart.toISOString())
    .order("updated_at", { ascending: false });

  const mine = (wonRows ?? []).filter(
    (d) => isLead || d.owner_id === profile.id,
  );

  const thisWeek = mine.filter((d) => new Date(d.updated_at as string) >= weekStart);

  // Recurring lines are what a residual is paid on, so they are counted
  // separately from one-time hardware.
  const dealIds = mine.map((d) => d.id as string);
  const { data: itemRows } = dealIds.length
    ? await supabase
        .from("deal_items")
        .select("deal_id, qty, unit_price_cents, billing")
        .in("deal_id", dealIds.slice(0, 200))
    : { data: [] as { deal_id: string; qty: number; unit_price_cents: number; billing: string }[] };

  const monthlyByDeal = new Map<string, number>();
  for (const r of itemRows ?? []) {
    if (r.billing !== "monthly") continue;
    const id = r.deal_id as string;
    monthlyByDeal.set(
      id,
      (monthlyByDeal.get(id) ?? 0) + (r.unit_price_cents as number) * (r.qty as number),
    );
  }

  const quota = (comp?.quota_weekly as number | null) ?? 5;
  const bonusCents = (comp?.bonus_per_sale_cents as number | null) ?? 0;
  const residualPct = Number(comp?.residual_pct ?? 0);

  const monthRecurring = mine.reduce((n, d) => n + (monthlyByDeal.get(d.id as string) ?? 0), 0);

  return (
    <EarningsView
      isLead={isLead}
      firstName={(comp?.first_name as string) ?? profile.full_name ?? "there"}
      quota={quota}
      soldThisWeek={thisWeek.length}
      soldThisMonth={mine.length}
      bonusCents={bonusCents}
      residualPct={residualPct}
      monthBonusCents={bonusCents * mine.length}
      monthResidualCents={Math.round(monthRecurring * (residualPct / 100))}
      recent={mine.slice(0, 12).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        valueCents: (d.value_cents as number) ?? 0,
        monthlyCents: monthlyByDeal.get(d.id as string) ?? 0,
        at: d.updated_at as string,
      }))}
    />
  );
}
