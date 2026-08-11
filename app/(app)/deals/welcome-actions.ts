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
 * "What happens next" - sent the moment a deal closes or a trial terminal
 * goes in. Two calls are coming at the merchant from two different places;
 * this is what keeps that from feeling like chaos.
 */
export async function sendWelcome(input: { dealId: string; to?: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: deal } = await supabase
    .from("deals_with_stage")
    .select("id, name, account_id, primary_contact_id, welcome_token, trial_start, trial_end")
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
  const url = base ? `${base}/start/${token}` : `/start/${token}`;

  // Recipient: whatever the rep passed, else the deal's contact
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
  const shop = deal.name;

  if (to) {
    if (!rep?.from_email) {
      throw new Error(
        "You do not have a sending address yet. Ask Chad to add your name@nectarpayaz.com alias, then this works.",
      );
    }
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Sending is not configured on this deployment yet");

    const text = `Thanks again.

Two short phone calls are coming, and I wrote down what each one is for so nothing catches you off guard:

${url}

The first is NectarPay support, getting your wallet set up and answering anything you want to ask. The second is about CryptoPop, getting your shop listed and showing you how to run your own specials.

Keep taking cards exactly as you do now. Nothing about that changes.

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
        subject: `What happens next - ${shop}`,
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
    subject: to ? "Email sent: What happens next" : "What happens next link created",
    body: to
      ? `Sent to ${to}. Two onboarding calls explained.\n${url}`
      : `No email on file - give the merchant this link.\n${url}`,
    account_id: deal.account_id,
    contact_id: contactId,
    deal_id: input.dealId,
  });

  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath(`/accounts/${deal.account_id}`);

  return { ok: true, url, sent: !!to };
}
