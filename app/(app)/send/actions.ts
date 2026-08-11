"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/app/(app)/activities/actions";
import { isMailApp, type MailApp } from "@/lib/mail-links";

async function resendSend(from: string, to: string[], subject: string, text: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Sending is not configured on this deployment yet");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("resend:", res.status, detail);
    throw new Error("The mail service rejected that message");
  }
  return true;
}

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
  /** True when the CRM delivered it, false when we only opened a mail app. */
  viaCrm?: boolean;
}) {
  const label = input.viaCrm ? "Email sent" : CHANNEL_LABEL[input.channel];

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

/**
 * Send the message from the CRM instead of handing it to the rep's mail app.
 *
 * The nectarpayaz.com addresses are ImprovMX aliases, not mailboxes, so a
 * Gmail compose window can never send AS one of them. Going through Resend
 * server-side is the only way the From line is guaranteed right - and it
 * means the timeline records what was actually delivered rather than what a
 * rep may or may not have pressed send on.
 */
export async function sendFieldMessageNow(input: {
  accountId: string;
  contactId: string | null;
  to: string;
  templateLabel: string;
  subject: string;
  body: string;
  followUpDays?: number | null;
}) {
  const to = input.to.trim();
  if (!to) throw new Error("No email address to send to");
  if (!input.subject.trim()) throw new Error("Give it a subject line");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: rep } = await supabase
    .from("reps")
    .select("first_name, from_email")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!rep?.from_email) {
    throw new Error(
      "You do not have a sending address yet. Ask Chad to add your name@nectarpayaz.com alias, then this works.",
    );
  }

  const name = profile?.full_name ?? rep.first_name ?? "NectarPay";
  await resendSend(`${name} <${rep.from_email}>`, [to], input.subject.trim(), input.body, rep.from_email);

  await logFieldMessage({
    accountId: input.accountId,
    contactId: input.contactId,
    templateLabel: input.templateLabel,
    channel: "email",
    subject: input.subject,
    body: input.body,
    followUpDays: input.followUpDays ?? null,
    viaCrm: true,
  });

  return { ok: true, from: rep.from_email };
}
