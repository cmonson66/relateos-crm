"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";
import { logAudit } from "@/lib/db/audit";

function mintToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

async function sendMail(from: string, to: string[], subject: string, text: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY missing - document saved but not emailed");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) console.error("resend:", res.status, await res.text());
  return res.ok;
}

/**
 * An invoice is built from the deal's line items, then FROZEN. The prices on
 * it are a snapshot, exactly like the agreement terms - editing the catalogue
 * next quarter must never change what someone was billed.
 *
 * A paid invoice is the receipt. Same document, same link, different header.
 * That is how it works on paper and it halves the surface area.
 */
export async function createInvoice(input: { dealId: string; dueDays?: number }) {
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

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, account_id, primary_contact_id")
    .eq("id", input.dealId)
    .single();
  if (!deal) throw new Error("Deal not found");

  const { data: items } = await supabase
    .from("deal_items")
    .select("qty, unit_price_cents, billing, serial_number, products(name, sku)")
    .eq("deal_id", input.dealId)
    .order("created_at");

  const rows = items ?? [];
  if (rows.length === 0) {
    throw new Error("Add what they are getting to the deal first - an invoice needs line items");
  }

  const lines = rows.map((r) => {
    const p = r.products as unknown as { name?: string; sku?: string } | null;
    return {
      name: p?.name ?? "Item",
      sku: p?.sku ?? "",
      qty: r.qty as number,
      unit_cents: r.unit_price_cents as number,
      billing: r.billing as "one_time" | "monthly",
      serial: (r.serial_number as string | null) ?? null,
    };
  });

  // Year one is what the merchant actually pays now: hardware plus twelve
  // months of membership, because membership is billed a year at a time.
  const oneTime = lines
    .filter((l) => l.billing === "one_time")
    .reduce((n, l) => n + l.unit_cents * l.qty, 0);
  const monthly = lines
    .filter((l) => l.billing === "monthly")
    .reduce((n, l) => n + l.unit_cents * l.qty, 0);
  const total = oneTime + monthly * 12;

  const { data: account } = await supabase
    .from("accounts")
    .select("name, city, state")
    .eq("id", deal.account_id)
    .maybeSingle();

  const token = mintToken();
  const due = new Date(Date.now() + (input.dueDays ?? 14) * 86400000);

  const { data: inserted, error } = await supabase
    .from("invoices")
    .insert({
      org_id: profile.org_id,
      deal_id: deal.id,
      account_id: deal.account_id,
      contact_id: deal.primary_contact_id,
      token,
      bill_to_name: account?.name ?? deal.name,
      bill_to_address: [account?.city, account?.state].filter(Boolean).join(", ") || null,
      lines_snapshot: lines,
      one_time_cents: oneTime,
      monthly_cents: monthly,
      total_cents: total,
      status: "issued",
      due_at: due.toISOString(),
      issued_by: user.id,
      issued_by_name: profile.full_name ?? null,
    })
    .select("id, number, token")
    .single();
  if (error) throw new Error(error.message);

  await logActivity({
    type: "note",
    subject: `Invoice ${inserted.number} issued`,
    body: `${(total / 100).toFixed(2)} due. First twelve months, all in.`,
    account_id: deal.account_id,
    contact_id: deal.primary_contact_id,
    deal_id: deal.id,
  });

  await logAudit({ entityType: "deal", entityId: deal.id, action: "updated" });
  revalidatePath(`/deals/${deal.id}`);
  return { ok: true, id: inserted.id, number: inserted.number, token: inserted.token };
}

export async function sendInvoice(input: { invoiceId: string; to?: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, number, token, total_cents, deal_id, account_id, contact_id, status")
    .eq("id", input.invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  let to = input.to?.trim() || null;
  if (!to && inv.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("email")
      .eq("id", inv.contact_id)
      .maybeSingle();
    to = c?.email ?? null;
  }
  if (!to) throw new Error("No email on file for this shop");

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
  if (!rep?.from_email) throw new Error("You do not have a sending address yet");

  const name = profile?.full_name ?? rep.first_name ?? "NectarPay";
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const url = `${base}/invoice/${inv.token}`;

  await sendMail(
    `${name} <${rep.from_email}>`,
    [to],
    `Invoice ${inv.number} - NectarPay`,
    `Here is invoice ${inv.number} for $${(inv.total_cents / 100).toFixed(2)}, covering the terminal and the first year of membership:

${url}

That page stays up, and it turns into your receipt the moment it is paid.

Anything at all, call me.

${name}
${rep.cell ?? ""}`,
    rep.from_email,
  );

  await supabase.from("invoices").update({ sent_at: new Date().toISOString() }).eq("id", inv.id);

  await logActivity({
    type: "email",
    subject: `Email sent: Invoice ${inv.number}`,
    body: `Sent to ${to}.\n${url}`,
    account_id: inv.account_id,
    contact_id: inv.contact_id,
    deal_id: inv.deal_id,
  });

  revalidatePath(`/deals/${inv.deal_id}`);
  return { ok: true, url };
}

/** Marking paid is what turns the invoice into a receipt. */
export async function markInvoicePaid(input: { invoiceId: string; method: string }) {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, number, deal_id, account_id, contact_id, total_cents")
    .eq("id", input.invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_method: input.method,
    })
    .eq("id", input.invoiceId);
  if (error) throw new Error(error.message);

  // Paid is the moment the deal is genuinely live. Found by FLAG, never by
  // slug - the 036 reshape's slugs are not in this repo.
  const { data: wonStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("is_won", true)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (wonStage?.id && inv.deal_id) {
    await supabase.from("deals").update({ stage_id: wonStage.id }).eq("id", inv.deal_id);
  }

  await logActivity({
    type: "note",
    subject: `Invoice ${inv.number} paid - deal is live`,
    body: `$${(inv.total_cents / 100).toFixed(2)} by ${input.method}. Receipt is live at the same link, and the deal moved to live.`,
    account_id: inv.account_id,
    contact_id: inv.contact_id,
    deal_id: inv.deal_id,
  });

  await logAudit({ entityType: "deal", entityId: inv.deal_id, action: "updated" });
  revalidatePath(`/deals/${inv.deal_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
