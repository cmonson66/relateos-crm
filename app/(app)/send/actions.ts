"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/app/(app)/activities/actions";
import { isMailApp, type MailApp } from "@/lib/mail-links";

export type SendChannel = "email" | "text" | "copy";

const CHANNEL_LABEL: Record<SendChannel, string> = {
  email: "Email",
  text: "Text",
  copy: "Copied",
};

/**
 * A sent field message becomes a timeline entry, and optionally a follow-up
 * task so nothing sent goes unfollowed (same rule as the call dispositions).
 *
 * Logged as type 'email' on purpose, including texts. The dashboard counts
 * calls and meetings as "doors worked" and emails as "touches logged" - a
 * text is a touch, not a door, and logging it as a call would inflate the
 * one KPI NectarPay leadership actually watches.
 */
export async function logFieldMessage(input: {
  accountId: string;
  contactId: string | null;
  templateLabel: string;
  channel: SendChannel;
  subject: string;
  body: string;
  followUpDays?: number | null;
}) {
  const label = CHANNEL_LABEL[input.channel];

  await logActivity({
    type: "email",
    subject: `${label}: ${input.templateLabel}`,
    body: [
      input.channel === "email" && input.subject ? `Subject: ${input.subject}` : "",
      input.body.trim(),
    ]
      .filter(Boolean)
      .join("\n\n"),
    account_id: input.accountId,
    contact_id: input.contactId,
  });

  if (input.followUpDays && input.followUpDays > 0) {
    const due = new Date(Date.now() + input.followUpDays * 86400000);
    due.setUTCHours(16, 0, 0, 0); // ~9 AM Phoenix
    await logActivity({
      type: "task",
      subject: `Follow up: ${input.templateLabel} - did they answer?`,
      account_id: input.accountId,
      contact_id: input.contactId,
      scheduled_at: due.toISOString(),
    });
  }

  return { ok: true };
}

/** Remembered per rep, so the wrong-mail-app problem is fixed once. */
export async function saveMailApp(app: MailApp) {
  if (!isMailApp(app)) throw new Error("Unknown mail app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_mail_app: app })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  return { ok: true };
}
