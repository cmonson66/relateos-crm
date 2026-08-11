"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";
import { logAudit } from "@/lib/db/audit";
import { startTrial } from "./trial-actions";
import { buildTerms, COMPANY, TERMS_VERSION } from "@/lib/trial-agreement";
import { buildPurchaseTerms, PURCHASE_TERMS_VERSION } from "@/lib/purchase-agreement";
import { addDays } from "@/lib/db/trials";

function token(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}

async function sendEmail(from: string, to: string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY missing - agreement saved but not emailed");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) console.error("resend:", res.status, await res.text());
  return res.ok;
}

export async function signTrialAgreement(input: {
  dealId: string;
  accountId: string;
  contactId: string | null;
  businessName: string;
  businessAddress: string | null;
  signerName: string;
  signerTitle: string | null;
  signerEmail: string | null;
  serial: string | null;
  startDate: string;
  days: number;
  signaturePng: string;
  consent: boolean;
  /** 'trial' loans a terminal; 'purchase' sells one. */
  kind?: "trial" | "purchase";
}) {
  if (!input.consent) throw new Error("The merchant has to agree to sign electronically");
  if (!input.signerName.trim()) throw new Error("The merchant has to type their name");
  if (!input.signaturePng.startsWith("data:image/png")) throw new Error("Signature is missing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");

  const { data: repRow } = await supabase
    .from("reps")
    .select("first_name, from_email, cell")
    .eq("profile_id", user.id)
    .maybeSingle();

  const repName = profile.full_name ?? repRow?.first_name ?? "your rep";
  const end = addDays(input.startDate, input.days);
  const kind = input.kind ?? "trial";

  // A purchase agreement lists what was actually bought, straight off the
  // deal, so the signed document and the invoice can never disagree.
  let lines: { name: string; qty: number; unitCents: number; billing: "one_time" | "monthly"; serial?: string | null }[] = [];
  if (kind === "purchase") {
    const { data: itemRows } = await supabase
      .from("deal_items")
      .select("qty, unit_price_cents, billing, serial_number, products(name)")
      .eq("deal_id", input.dealId)
      .order("created_at");
    lines = (itemRows ?? []).map((r) => {
      const p = r.products as unknown as { name?: string } | null;
      return {
        name: p?.name ?? "Item",
        qty: r.qty as number,
        unitCents: r.unit_price_cents as number,
        billing: r.billing as "one_time" | "monthly",
        serial: (r.serial_number as string | null) ?? null,
      };
    });
    if (lines.length === 0) {
      throw new Error("Add what they are getting to the deal before signing a purchase agreement");
    }
  }

  const terms =
    kind === "purchase"
      ? buildPurchaseTerms({
          businessName: input.businessName,
          businessAddress: input.businessAddress,
          lines,
          repName,
          signedOn: input.startDate,
        })
      : buildTerms({
          businessName: input.businessName,
          businessAddress: input.businessAddress,
          serial: input.serial,
          start: input.startDate,
          end,
          days: input.days,
          repName,
        });

  const t = token();

  const { error } = await supabase.from("trial_agreements").insert({
    org_id: profile.org_id,
    deal_id: input.dealId,
    account_id: input.accountId,
    contact_id: input.contactId,
    token: t,
    business_name: input.businessName,
    business_address: input.businessAddress,
    signer_name: input.signerName.trim(),
    signer_title: input.signerTitle?.trim() || null,
    signer_email: input.signerEmail?.trim() || null,
    terminal_serial: input.serial?.trim() || null,
    trial_start: input.startDate,
    trial_days: input.days,
    trial_end: end,
    kind,
    items_snapshot: kind === "purchase" ? lines : null,
    terms_version: kind === "purchase" ? PURCHASE_TERMS_VERSION : TERMS_VERSION,
    terms_snapshot: terms,
    signature_png: input.signaturePng,
    consent_ack: true,
    rep_id: user.id,
    rep_name: repName,
  });
  if (error) throw new Error(error.message);

  // Only a TRIAL signature starts a trial clock. A purchase signature must
  // not move the deal into a trial stage or schedule check-in tasks.
  if (kind === "trial") {
  // The signature is what starts the clock: trial fields, stage, and the
  // midpoint + T-2 tasks all come from the one existing code path.
  await startTrial({
    dealId: input.dealId,
    startDate: input.startDate,
    days: input.days,
    serial: input.serial,
  });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const copyUrl = base ? `${base}/agreement/${t}` : `/agreement/${t}`;

  await logActivity({
    type: "note",
    subject: `Trial agreement signed by ${input.signerName.trim()}`,
    body: `${input.businessName} - ${input.days} day trial, ${input.startDate} through ${end}.\nTerminal ${input.serial?.trim() || "serial not recorded"}.\nSigned copy: ${copyUrl}`,
    account_id: input.accountId,
    contact_id: input.contactId,
    deal_id: input.dealId,
  });

  const from = repRow?.from_email
    ? `${repName} <${repRow.from_email}>`
    : "NectarPay <crm@nectarpayaz.com>";

  const recipients = [
    input.signerEmail?.trim(),
    repRow?.from_email,
    process.env.AGREEMENT_COPY_TO,
  ].filter((x): x is string => !!x);

  if (recipients.length > 0) {
    await sendEmail(
      from,
      recipients,
      `Your ${COMPANY.name} trial terminal agreement - ${input.businessName}`,
      `${input.signerName.trim()},

Thanks for taking a terminal for a run. Your signed agreement is here, and it stays there if you need it later:

${copyUrl}

The short version: the trial runs ${input.startDate} through ${end}, it costs nothing while it runs, and at the end you either continue at $499 for the terminal plus $19 a month for the membership, or hand the equipment back.

Anything at all, call me.

${repName}
${repRow?.cell ?? ""}`,
    );
  }

  await logAudit({ entityType: "deal", entityId: input.dealId, action: "updated" });
  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath(`/accounts/${input.accountId}`);

  return { ok: true, token: t, url: copyUrl };
}
