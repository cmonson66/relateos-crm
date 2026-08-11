import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BASE_WEEKLY_CENTS, DEFAULT_TIERS, type CompTier } from "@/lib/db/comp";
import { EarningsView } from "./_components/earnings-view";

export const dynamic = "force-dynamic";

// Phoenix has no DST, so the whole app anchors on UTC-7.
const PHX = 7 * 3600000;

/** Monday 00:00 Phoenix as a UTC instant - the bonus ladder resets here. */
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
  const windowStart = phxWeekStart(5);

  const [{ data: repRows }, { data: tierRows }, { data: wonRows }, { data: people }] =
    await Promise.all([
      supabase.from("reps").select("profile_id, first_name, base_weekly_cents"),
      supabase.from("comp_tiers").select("from_sale, bonus_cents").order("from_sale"),
      supabase
        .from("deals_with_stage")
        .select("id, name, owner_id, value_cents, updated_at")
        .eq("stage_is_won", true)
        .gte("updated_at", windowStart.toISOString())
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name").eq("is_active", true),
    ]);

  const tiers: CompTier[] =
    (tierRows ?? []).length > 0
      ? (tierRows ?? []).map((t) => ({
          fromSale: t.from_sale as number,
          bonusCents: t.bonus_cents as number,
        }))
      : DEFAULT_TIERS;

  const nameById = new Map(
    (people ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Rep"]),
  );
  const baseById = new Map(
    (repRows ?? []).map((r) => [
      r.profile_id as string,
      (r.base_weekly_cents as number | null) ?? DEFAULT_BASE_WEEKLY_CENTS,
    ]),
  );

  const all = wonRows ?? [];
  // A rep only ever sees their own. A lead sees everyone, but every ladder is
  // still computed PER REP - pooling the team into one ladder would report a
  // bonus nobody earned.
  const scoped = isLead ? all : all.filter((d) => d.owner_id === profile.id);

  const weekBounds = Array.from({ length: 6 }, (_, i) => ({
    i,
    start: phxWeekStart(i).getTime(),
    end: phxWeekStart(i - 1).getTime(),
    startsOn: label(phxWeekStart(i)),
  }));

  /** Deals for one owner (or everyone), bucketed into Monday-anchored weeks. */
  const weeksFor = (ownerId: string | null) =>
    weekBounds.map((w) => {
      const sales = scoped.filter((d) => {
        if (ownerId && d.owner_id !== ownerId) return false;
        const t = new Date(d.updated_at as string).getTime();
        return t >= w.start && t < w.end;
      });
      return {
        startsOn: w.startsOn,
        sales: sales.length,
        deals: sales.map((d) => ({
          id: d.id as string,
          name: d.name as string,
          valueCents: (d.value_cents as number) ?? 0,
          at: d.updated_at as string,
          repName: d.owner_id ? nameById.get(d.owner_id as string) ?? null : null,
        })),
      };
    });

  // Everyone who either sold something in the window or has a rep record, so
  // a rep at zero this week still appears rather than quietly vanishing.
  const ownerIds = Array.from(
    new Set([
      ...(repRows ?? []).map((r) => r.profile_id as string),
      ...all.map((d) => d.owner_id as string).filter(Boolean),
    ]),
  );

  const team = isLead
    ? ownerIds
        .map((id) => ({
          id,
          name: nameById.get(id) ?? "Unassigned",
          baseWeeklyCents: baseById.get(id) ?? DEFAULT_BASE_WEEKLY_CENTS,
          weeks: weeksFor(id),
        }))
        .filter((r) => r.weeks.some((w) => w.sales > 0) || baseById.has(r.id))
        .sort((a, b) => b.weeks[0].sales - a.weeks[0].sales)
    : [];

  return (
    <EarningsView
      isLead={isLead}
      firstName={
        (repRows ?? []).find((r) => r.profile_id === profile.id)?.first_name ??
        profile.full_name ??
        "there"
      }
      baseWeeklyCents={baseById.get(profile.id) ?? DEFAULT_BASE_WEEKLY_CENTS}
      tiers={tiers}
      weeks={weeksFor(isLead ? null : profile.id)}
      team={team}
    />
  );
}
