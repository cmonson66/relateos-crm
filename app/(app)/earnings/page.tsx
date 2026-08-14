import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BASE_WEEKLY_CENTS, DEFAULT_TIERS, type CompTier } from "@/lib/db/comp";
import { EarningsView } from "./_components/earnings-view";
import { regionScope } from "@/lib/db/region-scope";
import { RegionSwitcher } from "@/components/app/region-switcher";
import { DEFAULT_TZ, todayIn, zonedIso, addDays, formatDateIn, type TimeZone } from "@/lib/db/tz";

export const dynamic = "force-dynamic";

/**
 * Monday 00:00 in the REGION as a UTC instant - the bonus ladder resets here.
 *
 * This used to be a fixed UTC-7 offset. A Dallas rep closing a deal late on a
 * Sunday night is already Monday in Phoenix terms, so the sale would land in
 * the wrong pay week and the ladder would pay the wrong rate for it.
 */
function weekStart(tz: TimeZone, offsetWeeks = 0): Date {
  const today = todayIn(tz);
  const [y, m, d] = today.split("-").map(Number);
  // getUTCDay on a plain date is safe: no zone involved, just the weekday.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = addDays(today, -(((dow + 6) % 7) + offsetWeeks * 7));
  return new Date(zonedIso(monday, 0, 0, tz));
}

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { profile } = await getUser();
  const supabase = await createClient();
  const { regions, activeRegionId } = await regionScope(supabase, profile, region ?? null);

  // Pay weeks run on the region's clock. Falls back to Phoenix when looking
  // at every region at once, which is the only sane single answer.
  const { data: regionRow } = activeRegionId
    ? await supabase.from("regions").select("timezone").eq("id", activeRegionId).maybeSingle()
    : { data: null };
  const tz: TimeZone = (regionRow?.timezone as TimeZone) ?? DEFAULT_TZ;
  const label = (d: Date) => formatDateIn(d.toISOString(), tz).replace(/,? \d{4}$/, "");

  const isLead = ["super_admin", "admin", "manager"].includes(profile.role);
  const windowStart = weekStart(tz, 5);

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
      supabase.from("profiles").select("id, full_name, region_id").eq("is_active", true),
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

  // Region narrows WHICH REPS are in view. It must never narrow into a
  // pooled figure: the ladder is per rep and marginal, so a region roll-up is
  // the SUM OF PER-REP LADDERS. Filtering the rep set keeps that intact.
  const regionRepIds = new Set(
    (people ?? [])
      .filter((p) => !activeRegionId || p.region_id === activeRegionId)
      .map((p) => p.id as string),
  );

  const all = (wonRows ?? []).filter(
    (d) => !activeRegionId || (d.owner_id && regionRepIds.has(d.owner_id as string)),
  );
  // A rep only ever sees their own. A lead sees everyone, but every ladder is
  // still computed PER REP - pooling the team into one ladder would report a
  // bonus nobody earned.
  const scoped = isLead ? all : all.filter((d) => d.owner_id === profile.id);

  const weekBounds = Array.from({ length: 6 }, (_, i) => ({
    i,
    start: weekStart(tz, i).getTime(),
    end: weekStart(tz, i - 1).getTime(),
    startsOn: label(weekStart(tz, i)),
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
  // Region-filtered too, or a Phoenix rep with no DFW sales would show up in
  // the DFW roll-up at zero and pad the payroll line with a base they are
  // not paid out of this region.
  const ownerIds = Array.from(
    new Set([
      ...(repRows ?? [])
        .map((r) => r.profile_id as string)
        .filter((id) => !activeRegionId || regionRepIds.has(id)),
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
    <>
      {regions.length > 1 && (
        <div className="px-4 pt-4 md:px-8">
          <RegionSwitcher regions={regions} activeId={activeRegionId} basePath="/earnings" allowAll />
        </div>
      )}
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
    </>
  );
}
