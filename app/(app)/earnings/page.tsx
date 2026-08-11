import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BASE_WEEKLY_CENTS, DEFAULT_TIERS, type CompTier } from "@/lib/db/comp";
import { EarningsView } from "./_components/earnings-view";

export const dynamic = "force-dynamic";

// Phoenix has no DST, so the whole app anchors on UTC-7.
const PHX = 7 * 3600000;

/** Monday 00:00 Phoenix, as a UTC instant. Weeks are how the bonus resets. */
function phxWeekStart(offsetWeeks = 0): Date {
  const now = new Date(Date.now() - PHX);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7) - offsetWeeks * 7);
  monday.setUTCHours(0, 0, 0, 0);
  return new Date(monday.getTime() + PHX);
}

const label = (d: Date) =>
  new Date(d.getTime() - PHX).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function EarningsPage() {
  const { profile } = await getUser();
  const supabase = await createClient();

  const isLead = ["super_admin", "admin", "manager"].includes(profile.role);

  // Six weeks back covers "this month" under any week alignment.
  const windowStart = phxWeekStart(5);

  const [{ data: repRow }, { data: tierRows }, { data: wonRows }] = await Promise.all([
    supabase
      .from("reps")
      .select("first_name, base_weekly_cents")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase
      .from("comp_tiers")
      .select("from_sale, bonus_cents")
      .order("from_sale"),
    supabase
      .from("deals_with_stage")
      .select("id, name, owner_id, value_cents, updated_at")
      .eq("stage_is_won", true)
      .gte("updated_at", windowStart.toISOString())
      .order("updated_at", { ascending: false }),
  ]);

  const tiers: CompTier[] =
    (tierRows ?? []).length > 0
      ? (tierRows ?? []).map((t) => ({
          fromSale: t.from_sale as number,
          bonusCents: t.bonus_cents as number,
        }))
      : DEFAULT_TIERS;

  const mine = (wonRows ?? []).filter((d) => isLead || d.owner_id === profile.id);

  // Group into Monday-anchored weeks. The bonus ladder resets on each one, so
  // the week is the only unit that matters for pay.
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = phxWeekStart(i);
    const end = phxWeekStart(i - 1);
    const sales = mine.filter((d) => {
      const t = new Date(d.updated_at as string).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    return {
      startsOn: label(start),
      sales: sales.length,
      deals: sales.map((d) => ({
        id: d.id as string,
        name: d.name as string,
        valueCents: (d.value_cents as number) ?? 0,
        at: d.updated_at as string,
      })),
    };
  });

  return (
    <EarningsView
      isLead={isLead}
      firstName={(repRow?.first_name as string) ?? profile.full_name ?? "there"}
      baseWeeklyCents={(repRow?.base_weekly_cents as number | null) ?? DEFAULT_BASE_WEEKLY_CENTS}
      tiers={tiers}
      weeks={weeks}
    />
  );
}
