import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickPerson } from "@/lib/pick-contact";
import { phxToday } from "@/lib/db/trials";
import { AgreementForm } from "@/app/(app)/deals/_components/agreement-form";

export const dynamic = "force-dynamic";

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params;
  const { kind: kindParam } = await searchParams;
  const kind = kindParam === "purchase" ? "purchase" : "trial";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: deal } = await supabase
    .from("deals_with_stage")
    .select("id, name, account_id, primary_contact_id, trial_start, trial_days, terminal_serial")
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, city, state")
    .eq("id", deal.account_id)
    .maybeSingle();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, title, email, phone")
    .eq("account_id", deal.account_id)
    .order("created_at", { ascending: true });

  const all = contacts ?? [];
  const chosen =
    (deal.primary_contact_id ? all.find((c) => c.id === deal.primary_contact_id) : null) ??
    pickPerson(all, account?.name ?? "") ??
    null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // accounts carries city and state only - no street address column exists,
  // so the rep types the street line on the form if the merchant wants it.
  const addr = [account?.city, account?.state].filter(Boolean).join(", ");

  return (
    <AgreementForm
      dealId={deal.id}
      accountId={deal.account_id}
      contactId={chosen?.id ?? null}
      businessName={account?.name ?? deal.name}
      businessAddress={addr || null}
      signerName={
        chosen ? [chosen.first_name, chosen.last_name].filter(Boolean).join(" ") : ""
      }
      signerTitle={chosen?.title && chosen.title !== "Business" ? chosen.title : ""}
      signerEmail={chosen?.email ?? ""}
      serial={deal.terminal_serial ?? ""}
      startDate={deal.trial_start ?? phxToday()}
      days={deal.trial_days ?? 14}
      repName={profile?.full_name ?? "your rep"}
      kind={kind}
    />
  );
}
