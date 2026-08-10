"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/db/audit";
import { logActivity } from "@/app/(app)/activities/actions";
import {
  TRIAL_STAGE_SLUG,
  addDays,
  conversionDate,
  midpointDate,
  phxMorningIso,
} from "@/lib/db/trials";

async function stageBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/** Won and lost stages are found by flag, not slug - the taxonomy was
 *  reshaped in place and only the flags are guaranteed stable. */
async function stageByFlag(flag: "is_won" | "is_lost") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq(flag, true)
    .order("position")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function startTrial(input: {
  dealId: string;
  startDate: string; // YYYY-MM-DD
  days: number;
  serial: string | null;
}) {
  const { dealId, startDate, days, serial } = input;
  if (!startDate || !days || days < 1) throw new Error("A trial needs a start date and a length");

  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, account_id, primary_contact_id")
    .eq("id", dealId)
    .single();
  if (!deal) throw new Error("Deal not found");

  const stageId = await stageBySlug(TRIAL_STAGE_SLUG);

  const { error } = await supabase
    .from("deals")
    .update({
      trial_start: startDate,
      trial_days: days,
      terminal_serial: serial?.trim() || null,
      trial_outcome: null,
      ...(stageId ? { stage_id: stageId } : {}),
    })
    .eq("id", dealId);
  if (error) throw new Error(error.message);

  await logAudit({ entityType: "deal", entityId: dealId, action: "updated" });

  // The two conversations that decide a trial. Created up front so they
  // land on the calendar instead of depending on a rep remembering.
  await logActivity({
    type: "task",
    subject: `Trial check-in: ${deal.name} - halfway, is it getting used?`,
    body: "Are they running payments on it? Does the team know how? Fix snags now, not at the end.",
    account_id: deal.account_id,
    contact_id: deal.primary_contact_id,
    deal_id: dealId,
    scheduled_at: phxMorningIso(midpointDate(startDate, days)),
  });

  await logActivity({
    type: "task",
    subject: `Trial ends in 2 days: ${deal.name} - ask for the yes`,
    body: `Trial ends ${addDays(startDate, days)}. Convert to paid, extend, or collect the terminal.`,
    account_id: deal.account_id,
    contact_id: deal.primary_contact_id,
    deal_id: dealId,
    scheduled_at: phxMorningIso(conversionDate(startDate, days)),
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTrial(input: {
  dealId: string;
  startDate: string;
  days: number;
  serial: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({
      trial_start: input.startDate,
      trial_days: input.days,
      terminal_serial: input.serial?.trim() || null,
    })
    .eq("id", input.dealId);
  if (error) throw new Error(error.message);

  await logAudit({ entityType: "deal", entityId: input.dealId, action: "updated" });
  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

export async function endTrial(input: {
  dealId: string;
  outcome: "converted" | "returned";
  note?: string | null;
}) {
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, account_id, primary_contact_id")
    .eq("id", input.dealId)
    .single();
  if (!deal) throw new Error("Deal not found");

  const stageId = await stageByFlag(input.outcome === "converted" ? "is_won" : "is_lost");

  const { error } = await supabase
    .from("deals")
    .update({
      trial_outcome: input.outcome,
      ...(stageId ? { stage_id: stageId } : {}),
    })
    .eq("id", input.dealId);
  if (error) throw new Error(error.message);

  await logActivity({
    type: "note",
    subject:
      input.outcome === "converted"
        ? `Trial converted to paid: ${deal.name}`
        : `Trial ended without a sale: ${deal.name}`,
    body: input.note?.trim() || null,
    account_id: deal.account_id,
    contact_id: deal.primary_contact_id,
    deal_id: input.dealId,
  });

  await logAudit({ entityType: "deal", entityId: input.dealId, action: "updated" });
  revalidatePath(`/deals/${input.dealId}`);
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  return { ok: true };
}
