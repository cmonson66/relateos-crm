import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickPerson } from "@/lib/pick-contact";
import { DEFAULT_MAIL_APP, isMailApp, type MailApp } from "@/lib/mail-links";
import { SendSheet } from "./_components/send-sheet";

export const dynamic = "force-dynamic";

type Intel = {
  pulse_token?: string | null;
  owner_first_name?: string | null;
};

export default async function SendPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ contact?: string; t?: string }>;
}) {
  const { accountId } = await params;
  const { contact: contactParam, t: templateParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // RLS scopes this: a rep can only open Send on an account they own
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, city")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) notFound();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, title, email, phone, legacy_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  const all = contacts ?? [];

  // Prefer an explicitly targeted contact (arriving from a contact page),
  // otherwise the real human rather than an import placeholder
  const chosen =
    (contactParam ? all.find((c) => c.id === contactParam) : null) ??
    pickPerson(all, account.name) ??
    all[0] ??
    null;

  const legacyId = all.map((c) => c.legacy_id).find(Boolean) ?? null;

  let intel: Intel = {};
  let pulseUrl: string | null = null;
  if (legacyId) {
    const { data } = await supabase.rpc("get_call_intel", { p_legacy_id: legacyId });
    intel = (data ?? {}) as Intel;
    if (intel.pulse_token) {
      const { data: base } = await supabase.rpc("get_pulse_base");
      if (base) pulseUrl = `${String(base).replace(/\/$/, "")}/s/${intel.pulse_token}`;
    }
  }

  // The name to greet. A placeholder contact is not a person, so this stays
  // null and the templates fall back to "Hi there," rather than "Business,"
  const ownerName =
    intel.owner_first_name ??
    (chosen && chosen.title !== "Business" ? chosen.first_name : null);

  // preferred_mail_app arrives with 045. Selected separately and tolerantly
  // so this page still works if the code deploys before the SQL runs.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  let mailApp: MailApp = DEFAULT_MAIL_APP;
  const { data: pref } = await supabase
    .from("profiles")
    .select("preferred_mail_app")
    .eq("id", user.id)
    .maybeSingle();
  const stored = (pref as { preferred_mail_app?: unknown } | null)?.preferred_mail_app;
  if (isMailApp(stored)) mailApp = stored;

  const { data: repRow } = await supabase
    .from("reps")
    .select("first_name, cell, from_email")
    .eq("profile_id", user.id)
    .maybeSingle();

  const repFirst = repRow?.first_name ?? (profile?.full_name ?? "Rep").split(" ")[0];
  const repFull = profile?.full_name ?? repFirst;

  return (
    <SendSheet
      account={{ id: account.id, name: account.name, city: account.city }}
      contact={
        chosen
          ? {
              id: chosen.id,
              email: chosen.email,
              phone: chosen.phone,
              display: [chosen.first_name, chosen.last_name].filter(Boolean).join(" "),
            }
          : null
      }
      people={all.map((c) => ({
        id: c.id,
        label: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contact",
        email: c.email,
        phone: c.phone,
      }))}
      tokens={{
        shop: account.name,
        owner: ownerName,
        city: account.city,
        rep: repFull,
        repCell: repRow?.cell ?? null,
        repEmail: repRow?.from_email ?? null,
        pulseUrl,
      }}
      initialMailApp={mailApp}
      initialTemplateId={templateParam ?? null}
    />
  );
}
