"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";

/**
 * Manually added and imported shops are created with status FIELD, which the
 * sender skips on purpose - a shop a rep is already walking should not also be
 * cold-emailed. But reps also add genuinely cold leads, and those should be
 * eligible. This lets a rep say which is which.
 *
 * All CRM-side access to nectarpay_leads goes through a security-definer RPC:
 * that table's RLS gives app users nothing, and the engine only works because
 * it uses the service key.
 */
export async function setCampaignEligibility(input: {
  accountId: string;
  include: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  // legacy_id is the bridge to the lead row; a contact carries it after the
  // account has been synced.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("legacy_id, email")
    .eq("account_id", input.accountId);

  const rows = contacts ?? [];
  const legacyId = rows.map((c) => c.legacy_id as string | null).find(Boolean) ?? null;

  if (!legacyId) {
    return {
      ok: false as const,
      message:
        "This shop is not linked to the lead pool yet. Use the Sync button on the account first, then try again.",
    };
  }

  const email =
    rows.map((c) => (c.email as string | null)?.trim()).find((e) => !!e) ?? null;

  if (input.include && !email) {
    return {
      ok: false as const,
      message: "Add an email address to a contact first - there is nowhere to send.",
    };
  }

  const { data, error } = await supabase.rpc("set_campaign_eligibility", {
    p_legacy_id: legacyId,
    p_include: input.include,
    p_email: email,
  });
  if (error) return { ok: false as const, message: error.message };

  const result = (data ?? {}) as { ok?: boolean; reason?: string };
  if (result.ok === false) {
    return { ok: false as const, message: result.reason ?? "That shop could not be changed" };
  }

  await logActivity({
    type: "note",
    subject: input.include ? "Added to the campaign" : "Removed from the campaign",
    body: input.include
      ? `Cold emails will start going to ${email} on the next run.`
      : "This shop will not receive campaign emails.",
    account_id: input.accountId,
  });

  revalidatePath(`/accounts/${input.accountId}`);
  return { ok: true as const };
}
