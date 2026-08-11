import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TerminalsView } from "./_components/terminals-view";

export const dynamic = "force-dynamic";

export default async function TerminalsPage() {
  const { profile } = await getUser();
  // Stock is an org-level concern, not a rep-level one.
  if (!profile || !["super_admin", "admin", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: rows }, { data: people }] = await Promise.all([
    supabase
      .from("terminals")
      .select(
        "id, serial, model, status, held_by_profile_id, account_id, deal_id, deployed_at, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .in("role", ["super_admin", "admin", "manager", "rep"]),
  ]);

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
      people={(people ?? []).map((p) => ({
        id: p.id as string,
        name: (p.full_name as string) ?? "Rep",
      }))}
    />
  );
}
