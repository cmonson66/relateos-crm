"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";

function mintToken(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}

/**
 * The pre-visit homework link, sent the moment an install is booked.
 *
 * Reuses deals.welcome_token rather than minting a second merchant token: the
 * same person, the same deal, two pages. One token to revoke.
 *
 * Sends server-side through Resend under the rep's own alias for the same
 * reason the agreement email does - the nectarpayaz.com addresses are
 * ImprovMX aliases, not Google accounts, so no compose URL can send as them.
 */
export async function sendSetupLink(input: { dealId: string; to?: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: deal } = await supabase
    .from("deals_with_stage")
    .select("id, name, account_id, primary_contact_id, welcome_token")
    .eq("id", input.dealId)
    .maybeSingle();
  if (!deal) throw new Error("Deal not found");

  let token = deal.welcome_token as string | null;
  if (!token) {
    token = mintToken();
    const { error } = await supabase
      .from("deals")
      .update({ welcome_token: token })
      .eq("id", input.dealId);
    if (error) throw new Error(error.message);
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const url = base ? `${base}/setup/${token}` : `/setup/${token}`;

  let to = input.to?.trim() || null;
  let contactId = deal.primary_contact_id as string | null;
  if (!to && contactId) {
    const { data: c } = await supabase
      .from("contacts")
      .select("email")
      .eq("id", contactId)
      .maybeSingle();
    to = c?.email ?? null;
  }
  if (!to) {
    const { data: c } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("account_id", deal.account_id)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();
    to = c?.email ?? null;
    contactId = c?.id ?? contactId;
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", deal.account_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const { data: rep } = await supabase
    .from("reps")
    .select("first_name, from_email, cell")
    .eq("profile_id", user.id)
    .maybeSingle();

  const repName = profile?.full_name ?? rep?.first_name ?? "your rep";
  const shop = account?.name ?? deal.name;

  if (to) {
    if (!rep?.from_email) {
      throw new Error(
        "You do not have a sending address yet. Ask Chad to add your name@nectarpayaz.com alias, then this works.",
      );
    }
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Sending is not configured on this deployment yet");

    const text = `Looking forward to getting you set up.

There are two things worth doing before I come out. They take the install from an afternoon down to a few minutes, and one of them needs a few days to clear, so it is worth starting now:

${url}

The page also shows exactly how the money gets from a sale to your bank account, which is the question everybody asks me second.

Anything at all, call me.

${repName}
${rep.cell ?? ""}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${repName} <${rep.from_email}>`,
        to: [to],
        reply_to: rep.from_email,
        subject: `Before we set you up - ${shop}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error("resend:", res.status, await res.text());
      throw new Error("The mail service rejected that message");
    }
  }

  await logActivity({
    type: "email",
    subject: to ? "Email sent: Getting ready for the install" : "Setup link created",
    body: to
      ? `Sent to ${to}. Exchange account, NectarPay account, and what to have ready.\n${url}`
      : `No email on file - give the merchant this link.\n${url}`,
    account_id: deal.account_id,
    contact_id: contactId,
    deal_id: input.dealId,
  });

  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath(`/accounts/${deal.account_id}`);

  return { ok: true, url, sent: !!to };
}
