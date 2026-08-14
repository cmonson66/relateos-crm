import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { regionScope } from "@/lib/db/region-scope";
import { RegionSwitcher } from "@/components/app/region-switcher";
import { TerminalsView } from "./_components/terminals-view";

export const dynamic = "force-dynamic";

export default async function TerminalsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { profile } = await getUser();
  // Stock is an org-level concern, not a rep-level one.
  if (!profile || !["super_admin", "admin", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { regions, activeRegionId } = await regionScope(supabase, profile, region ?? null);

  // Hardware is physically in one market. A Phoenix manager assigning a unit
  // that is sitting in a Fort Worth rep's trunk is not a useful screen.
  const terminalQuery = supabase
    .from("terminals")
    .select(
      "id, serial, model, status, held_by_profile_id, account_id, deal_id, deployed_at, created_at",
    )
    .order("created_at", { ascending: false });

  const [{ data: rows, error: rowsErr }, { data: people }] = await Promise.all([
    activeRegionId ? terminalQuery.eq("region_id", activeRegionId) : terminalQuery,
    supabase
      .from("profiles")
      .select("id, full_name, region_id")
      .eq("is_active", true)
      .in("role", ["super_admin", "admin", "manager", "rep"]),
  ]);

  // Production hides server-render errors behind a generic message, so a
  // missing table or policy reads as "something broke". Say what it is.
  if (rowsErr) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <h1 className="font-display text-2xl tracking-wider">INVENTORY</h1>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-bold text-destructive">Inventory is not reachable.</div>
          <p className="mt-1.5 text-muted-foreground">
            Most likely migration 051 has not run yet. Run it in the Supabase SQL editor, then
            reload this page.
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">{rowsErr.message}</p>
        </div>
      </div>
    );
  }

  const terminals = rows ?? [];

  // Resolve shop names in one query rather than per row
  const accountIds = Array.from(
    new Set(terminals.map((t) => t.account_id).filter(Boolean) as string[]),
  );
  const { data: accts } = accountIds.length
    ? await supabase.from("accounts").select("id, name").in("id", accountIds)
    : { data: [] as { id: string; name: string }[] };

  const nameById = new Map((accts ?? []).map((a) => [a.id as string, a.name as string]));
  const repById = new Map(
    (people ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Rep"]),
  );

  return (
    <>
      {regions.length > 1 && (
        <div className="px-4 pt-4 md:px-8">
          <RegionSwitcher regions={regions} activeId={activeRegionId} basePath="/terminals" allowAll />
        </div>
      )}
    <TerminalsView
      terminals={terminals.map((t) => ({
        id: t.id as string,
        serial: t.serial as string,
        model: (t.model as string) ?? "Terminal",
        status: t.status as string,
        heldBy: t.held_by_profile_id ? repById.get(t.held_by_profile_id as string) ?? null : null,
        heldById: (t.held_by_profile_id as string | null) ?? null,
        shop: t.account_id ? nameById.get(t.account_id as string) ?? null : null,
        accountId: (t.account_id as string | null) ?? null,
        deployedAt: (t.deployed_at as string | null) ?? null,
      }))}
      people={(people ?? [])
        .filter((p) => !activeRegionId || p.region_id === activeRegionId || p.region_id === null)
        .map((p) => ({
          id: p.id as string,
          name: (p.full_name as string) ?? "Rep",
        }))}
    />
    </>
  );
}
