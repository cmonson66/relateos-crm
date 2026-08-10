// How a rep's phone actually opens a composed message.
//
// mailto: is decided by the operating system, not by us. On a phone that was
// once set up with a work Exchange account, mailto: opens that dead account
// and the message is never sent. So the mail app is a per-rep setting, stored
// on profiles (not on reps - a rep can have a mail preference before they
// ever have a sending alias).
export type MailApp = "gmail" | "outlook" | "device" | "copy";

export const MAIL_APPS: { id: MailApp; label: string; note: string }[] = [
  { id: "gmail", label: "Gmail", note: "Opens the Gmail app or gmail.com" },
  { id: "outlook", label: "Outlook", note: "Opens Outlook on the web" },
  { id: "device", label: "Phone default", note: "Whatever your phone opens for email" },
  { id: "copy", label: "Copy only", note: "Never opens anything - copy and paste it yourself" },
];

export const DEFAULT_MAIL_APP: MailApp = "gmail";

export function isMailApp(v: unknown): v is MailApp {
  return v === "gmail" || v === "outlook" || v === "device" || v === "copy";
}

/**
 * A compose URL for the rep's chosen mail app, or null when they have chosen
 * copy-only (or there is no address to send to).
 *
 * The Gmail URL pins /u/0/ deliberately. Reps signed into more than one Google
 * account otherwise compose from whichever one Gmail last used, which for our
 * reps is usually their personal address rather than their NectarPay one.
 */
export function buildEmailUrl(
  app: MailApp,
  msg: { to: string | null; subject: string; body: string },
): string | null {
  const to = (msg.to ?? "").trim();
  if (!to || app === "copy") return null;

  const su = encodeURIComponent(msg.subject);
  const body = encodeURIComponent(msg.body);
  const addr = encodeURIComponent(to);

  switch (app) {
    case "gmail":
      return `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${addr}&su=${su}&body=${body}`;
    case "outlook":
      return `https://outlook.office.com/mail/deeplink/compose?to=${addr}&subject=${su}&body=${body}`;
    case "device":
    default:
      return `mailto:${to}?subject=${su}&body=${body}`;
  }
}

/** Digits only, so a number stored as "(602) 555-0123" still dials. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return (plus ? "+" : "") + digits;
}

/**
 * The ?&body= shape is the cross-platform one: iOS wants sms:number&body=,
 * Android wants sms:number?body=, and this satisfies both. Same form already
 * used by the Text-it button in Call Mode.
 */
export function buildSmsUrl(phone: string | null | undefined, body: string): string | null {
  const num = normalizePhone(phone);
  if (!num) return null;
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}
