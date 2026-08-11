"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";

/**
 * The handbook tells reps to ask for the quote and the two names at the
 * moment a merchant says "this is great". Nothing captured the answer, so
 * the best-converting channel you have lived in people's heads.
 */
export async function captureTestimonial(input: {
  accountId: string;
  quote: string;
  attribution: string | null;
  canUsePublicly: boolean;
}) {
  const quote = input.quote.trim();
  if (!quote) return { ok: false as const, message: "Type what they said" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false as const, message: "No profile" };

  const { error } = await supabase.from("testimonials").insert({
    org_id: profile.org_id,
    account_id: input.accountId,
    quote,
    attribution: input.attribution?.trim() || null,
    can_use_publicly: input.canUsePublicly,
    captured_by: user.id,
  });
  if (error) return { ok: false as const, message: error.message };

  await logActivity({
    type: "note",
    subject: "Testimonial captured",
    body: `"${quote}"${input.attribution ? ` - ${input.attribution}` : ""}${
      input.canUsePublicly ? "\n\nOK to use publicly." : "\n\nNot cleared for public use."
    }`,
    account_id: input.accountId,
  });

  revalidatePath(`/accounts/${input.accountId}`);
  return { ok: true as const };
}

/**
 * A referred name becomes a real account with the source recorded, so
 * referral-sourced deals can be counted rather than guessed at.
 */
export async function captureReferral(input: {
  fromAccountId: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  city: string | null;
  note: string | null;
}) {
  const name = input.businessName.trim();
  if (!name) return { ok: false as const, message: "Give the business a name" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false as const, message: "No profile" };

  // Owned by whoever took the referral - it is their lead to work.
  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      org_id: profile.org_id,
      name,
      city: input.city?.trim() || null,
      owner_id: user.id,
      referred_by_account_id: input.fromAccountId,
      notes: input.note?.trim() || null,
      tags: ["Referral"],
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, message: error.message };

  if (input.contactName?.trim() || input.phone?.trim()) {
    const parts = (input.contactName ?? "").trim().split(/\s+/);
    await supabase.from("contacts").insert({
      org_id: profile.org_id,
      account_id: created.id,
      first_name: parts[0] || name,
      last_name: parts.slice(1).join(" ") || null,
      title: parts[0] ? null : "Business",
      phone: input.phone?.trim() || null,
      owner_id: user.id,
    });
  }

  const { data: source } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", input.fromAccountId)
    .maybeSingle();

  await logActivity({
    type: "note",
    subject: `Referred ${name}`,
    body: input.note?.trim() || null,
    account_id: input.fromAccountId,
  });

  await logActivity({
    type: "task",
    subject: `Call ${name} - referred by ${source?.name ?? "a happy merchant"}`,
    body: "Lead with who sent you. A warm name beats anything cold.",
    account_id: created.id,
  });

  revalidatePath(`/accounts/${input.fromAccountId}`);
  revalidatePath("/accounts");
  return { ok: true as const, accountId: created.id as string };
}
