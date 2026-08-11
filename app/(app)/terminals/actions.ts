"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/app/(app)/activities/actions";

export type TerminalStatus =
  | "in_stock"
  | "with_rep"
  | "deployed"
  | "returned"
  | "damaged"
  | "lost";

export const TERMINAL_STATUS_LABEL: Record<TerminalStatus, string> = {
  in_stock: "In stock",
  with_rep: "With a rep",
  deployed: "In a shop",
  returned: "Came back",
  damaged: "Damaged",
  lost: "Lost",
};

async function orgId() {
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
  return { supabase, userId: user.id, org: profile.org_id as string };
}

/** Every status change is recorded, so a serial has a history, not just a state. */
async function trail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  terminalId: string,
  org: string,
  userId: string,
  event: string,
  note?: string | null,
) {
  await supabase.from("terminal_events").insert({
    org_id: org,
    terminal_id: terminalId,
    event,
    note: note?.trim() || null,
    by_profile_id: userId,
  });
}

/** Serials arrive in batches from NectarPay. One per line. */
export async function receiveTerminals(input: { serials: string; model?: string | null }) {
  const { supabase, userId, org } = await orgId();

  const serials = Array.from(
    new Set(
      input.serials
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
  if (serials.length === 0) throw new Error("Paste at least one serial");
  if (serials.length > 200) throw new Error("That is more than 200 serials - split the batch");

  const rows = serials.map((serial) => ({
    org_id: org,
    serial,
    model: input.model?.trim() || "Nectar.Pay Terminal",
    status: "in_stock" as const,
  }));

  const { data, error } = await supabase
    .from("terminals")
    .upsert(rows, { onConflict: "org_id,serial", ignoreDuplicates: true })
    .select("id, serial");
  if (error) throw new Error(error.message);

  for (const t of data ?? []) {
    await trail(supabase, t.id as string, org, userId, "received");
  }

  revalidatePath("/terminals");
  return { ok: true, added: (data ?? []).length, submitted: serials.length };
}

/** A rep carrying stock is the state nobody tracks and everybody forgets. */
export async function assignTerminal(input: { terminalId: string; profileId: string | null }) {
  const { supabase, userId, org } = await orgId();

  const { error } = await supabase
    .from("terminals")
    .update({
      held_by_profile_id: input.profileId,
      status: input.profileId ? "with_rep" : "in_stock",
      account_id: null,
      deal_id: null,
      deployed_at: null,
    })
    .eq("id", input.terminalId);
  if (error) throw new Error(error.message);

  await trail(
    supabase,
    input.terminalId,
    org,
    userId,
    input.profileId ? "assigned to rep" : "back to stock",
  );

  revalidatePath("/terminals");
  return { ok: true };
}

/** Placing a unit in a shop. Called by hand, or by the deal flow. */
export async function deployTerminal(input: {
  serial: string;
  accountId: string;
  dealId?: string | null;
  note?: string | null;
}) {
  const { supabase, userId, org } = await orgId();
  const serial = input.serial.trim();
  if (!serial) throw new Error("Which serial?");

  const { data: existing } = await supabase
    .from("terminals")
    .select("id, status, account_id")
    .eq("serial", serial)
    .maybeSingle();

  // A serial typed on a deal that inventory has never seen still needs to be
  // tracked - better a row created late than a unit that exists nowhere.
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data: created, error } = await supabase
      .from("terminals")
      .insert({
        org_id: org,
        serial,
        model: "Nectar.Pay Terminal",
        status: "in_stock",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = created.id as string;
    await trail(supabase, id, org, userId, "created from a deal", `Serial ${serial} was not in stock`);
  } else if (existing?.status === "deployed" && existing.account_id !== input.accountId) {
    throw new Error(`${serial} is already recorded as being in another shop`);
  }

  const { error: upErr } = await supabase
    .from("terminals")
    .update({
      status: "deployed",
      account_id: input.accountId,
      deal_id: input.dealId ?? null,
      deployed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upErr) throw new Error(upErr.message);

  await trail(supabase, id, org, userId, "deployed", input.note);

  await logActivity({
    type: "note",
    subject: `Terminal ${serial} placed`,
    account_id: input.accountId,
    deal_id: input.dealId ?? null,
  });

  revalidatePath("/terminals");
  revalidatePath(`/accounts/${input.accountId}`);
  return { ok: true };
}

/** Coming back off a trial, or coming back broken. */
export async function returnTerminal(input: {
  terminalId: string;
  outcome: "returned" | "damaged" | "lost";
  note?: string | null;
}) {
  const { supabase, userId, org } = await orgId();

  const { data: t } = await supabase
    .from("terminals")
    .select("serial, account_id")
    .eq("id", input.terminalId)
    .maybeSingle();

  const { error } = await supabase
    .from("terminals")
    .update({
      status: input.outcome,
      account_id: null,
      deal_id: null,
      deployed_at: null,
      // A returned unit goes back into sellable stock. Damaged and lost do not.
      ...(input.outcome === "returned" ? { status: "in_stock" as const } : {}),
    })
    .eq("id", input.terminalId);
  if (error) throw new Error(error.message);

  await trail(supabase, input.terminalId, org, userId, input.outcome, input.note);

  if (t?.account_id) {
    await logActivity({
      type: "note",
      subject: `Terminal ${t.serial} ${input.outcome === "returned" ? "came back" : input.outcome}`,
      body: input.note?.trim() || null,
      account_id: t.account_id as string,
    });
  }

  revalidatePath("/terminals");
  return { ok: true };
}
