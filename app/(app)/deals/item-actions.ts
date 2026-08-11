"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/db/audit";
import { deployTerminal } from "@/app/(app)/terminals/actions";

/**
 * value_cents stays on deals because the kanban, dashboard and pipeline all
 * read it. It is now DERIVED from the line items rather than typed by hand:
 * one-time charges plus twelve months of every subscription line, which is
 * the year-one figure the whole pitch is built on.
 */
async function resyncDealValue(dealId: string) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("deal_items")
    .select("qty, unit_price_cents, billing")
    .eq("deal_id", dealId);

  const rows = items ?? [];
  const total = rows.reduce((n, i) => {
    const line = i.unit_price_cents * i.qty;
    return n + (i.billing === "monthly" ? line * 12 : line);
  }, 0);

  await supabase.from("deals").update({ value_cents: total }).eq("id", dealId);
  return total;
}

export async function addDealItem(input: {
  dealId: string;
  productId: string;
  qty: number;
  serial?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("No profile");

  const { data: product } = await supabase
    .from("products")
    .select("id, unit_price_cents, billing")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) throw new Error("Product not found");

  // Price is SNAPSHOT onto the line. A price change next quarter must never
  // rewrite what a merchant already agreed to - same rule as terms_snapshot.
  const { error } = await supabase.from("deal_items").insert({
    org_id: profile.org_id,
    deal_id: input.dealId,
    product_id: product.id,
    qty: Math.max(1, Math.min(50, input.qty)),
    unit_price_cents: product.unit_price_cents,
    billing: product.billing,
    serial_number: input.serial?.trim() || null,
  });
  if (error) throw new Error(error.message);

  // A serial on a line item means a physical unit went somewhere. Register
  // it so inventory and the deal can never disagree about where it is.
  if (input.serial?.trim()) {
    const { data: deal } = await supabase
      .from("deals")
      .select("account_id")
      .eq("id", input.dealId)
      .maybeSingle();
    if (deal?.account_id) {
      try {
        await deployTerminal({
          serial: input.serial,
          accountId: deal.account_id as string,
          dealId: input.dealId,
        });
      } catch (err) {
        // Inventory is a record, not a gate - never block adding a line item
        console.error("deployTerminal:", err);
      }
    }
  }

  await resyncDealValue(input.dealId);
  await logAudit({ entityType: "deal", entityId: input.dealId, action: "updated" });
  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

export async function removeDealItem(input: { itemId: string; dealId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("deal_items").delete().eq("id", input.itemId);
  if (error) throw new Error(error.message);

  await resyncDealValue(input.dealId);
  await logAudit({ entityType: "deal", entityId: input.dealId, action: "updated" });
  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}
