"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Mail,
  MessageSquareText,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Send as SendIcon,
} from "lucide-react";
import {
  FIELD_TEMPLATES,
  FIELD_TEMPLATE_GROUPS,
  renderFieldTemplate,
  type FieldTemplate,
  type FieldTokens,
} from "@/lib/field-templates";
import {
  buildEmailUrl,
  buildSmsUrl,
  MAIL_APPS,
  type MailApp,
} from "@/lib/mail-links";
import {
  logFieldMessage,
  saveMailApp,
  sendFieldMessageNow,
  type SendChannel,
} from "../../actions";

type Person = { id: string; label: string; email: string | null; phone: string | null };

type Props = {
  account: { id: string; name: string; city: string | null };
  contact: { id: string; email: string | null; phone: string | null; display: string } | null;
  people: Person[];
  tokens: FieldTokens;
  initialMailApp: MailApp;
  initialTemplateId: string | null;
  /** Where the rep came from. "call" returns them to the live script. */
  from?: string | null;
};

const CHANNELS: { id: SendChannel; label: string; icon: typeof Mail }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "text", label: "Text", icon: MessageSquareText },
  { id: "copy", label: "Copy", icon: Copy },
];

const BLANK_ID = "__blank__";

export function SendSheet({
  account,
  contact,
  people,
  tokens,
  initialMailApp,
  initialTemplateId,
  from,
}: Props) {
  const fromCall = from === "call";
  const backHref = fromCall ? `/call/${account.id}` : `/accounts/${account.id}`;
  const first =
    (initialTemplateId ? FIELD_TEMPLATES.find((t) => t.id === initialTemplateId) : null) ??
    FIELD_TEMPLATES[0];

  const [templateId, setTemplateId] = useState<string>(first.id);
  const [channel, setChannel] = useState<SendChannel>(
    contact?.email ? "email" : contact?.phone ? "text" : "copy",
  );
  const [mailApp, setMailApp] = useState<MailApp>(initialMailApp);
  const [recipientId, setRecipientId] = useState<string | null>(contact?.id ?? null);
  // An override the rep types in. Null means "use whatever is on the contact",
  // which is the common case; a shop where the owner gives you a different
  // address at the door is the reason this exists at all.
  const [toOverride, setToOverride] = useState<{ email: string | null; phone: string | null }>({
    email: null,
    phone: null,
  });
  const [draft, setDraft] = useState<{ key: string; subject: string; body: string } | null>(null);
  const [followUp, setFollowUp] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sentKey, setSentKey] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const blank = templateId === BLANK_ID;

  const template: FieldTemplate =
    FIELD_TEMPLATES.find((t) => t.id === templateId) ?? FIELD_TEMPLATES[0];

  const recipient = people.find((p) => p.id === recipientId) ?? null;

  // Text has no subject line, so copy and text share the text-length body
  const rendered = useMemo(
    () =>
      blank
        ? { subject: "", body: "" }
        : renderFieldTemplate(template, channel === "email" ? "email" : "text", tokens),
    [blank, template, channel, tokens],
  );

  // The draft is keyed by template and channel rather than reset in an effect.
  // Picking a different template shows that template's words; edits stick as
  // long as the rep stays on the one they are editing. No setState in an
  // effect, which this repo's lint purity rule flags.
  const draftKey = `${blank ? BLANK_ID : template.id}:${channel === "email" ? "email" : "text"}`;
  const onDraft = draft?.key === draftKey;
  const subject = onDraft ? draft.subject : rendered.subject;
  const body = onDraft ? draft.body : rendered.body;
  const sent = sentKey === draftKey;

  const setSubject = (v: string) => setDraft({ key: draftKey, subject: v, body });
  const setBody = (v: string) => setDraft({ key: draftKey, subject, body: v });

  const contactEmail = recipient?.email ?? null;
  const contactPhone = recipient?.phone ?? null;
  const toEmail = toOverride.email !== null ? toOverride.email.trim() || null : contactEmail;
  const toPhone = toOverride.phone !== null ? toOverride.phone.trim() || null : contactPhone;
  const overridden =
    channel === "email"
      ? toOverride.email !== null && toEmail !== contactEmail
      : toOverride.phone !== null && toPhone !== contactPhone;

  const href =
    channel === "email"
      ? buildEmailUrl(mailApp, { to: toEmail, subject, body })
      : channel === "text"
        ? buildSmsUrl(toPhone, body)
        : null;

  const blocked =
    channel === "email" && !toEmail
      ? "No email address yet. Type one below, or text it instead."
      : channel === "text" && !toPhone
        ? "No phone number yet. Type one below, or email it instead."
        : channel === "email" && mailApp === "copy"
          ? "Your mail app is set to copy only. Copy the message and paste it yourself."
          : null;

  const missingPulse = template.wantsPulse && !tokens.pulseUrl;
  // A one-pager message with no link is just a paragraph about a link.
  const missingSheet = template.wantsSheet && !tokens.onePagerUrl;

  const copyAll = () => {
    const text = channel === "email" && subject ? `${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const log = (used: SendChannel) => {
    startTransition(async () => {
      await logFieldMessage({
        accountId: account.id,
        contactId: recipient?.id ?? contact?.id ?? null,
        templateLabel: template.label,
        channel: used,
        subject: used === "email" ? subject : "",
        body,
        followUpDays: followUp ? 3 : null,
      });
      setSentKey(draftKey);
    });
  };

  // Sending from the CRM guarantees the From line. The nectarpayaz.com
  // addresses are forwarding aliases, not mailboxes, so a Gmail compose
  // window physically cannot send as one of them.
  const canSendDirect = channel === "email" && !!toEmail && !!tokens.repEmail;

  const sendDirect = () => {
    setSendError(null);
    startTransition(async () => {
      try {
        await sendFieldMessageNow({
          accountId: account.id,
          contactId: recipient?.id ?? contact?.id ?? null,
          to: toEmail!,
          templateLabel: template.label,
          subject,
          body,
          followUpDays: followUp ? 3 : null,
        });
        setSentKey(draftKey);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "That did not send");
      }
    });
  };

  const chooseMailApp = (app: MailApp) => {
    setMailApp(app);
    startTransition(async () => {
      try {
        await saveMailApp(app);
      } catch {
        // The setting is a convenience. A failed save must not block sending.
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 py-4">
        <div className="flex items-center gap-3">
          {/* Back goes where they CAME FROM. A rep who tapped "send me
              something" mid-call is still on that call - dropping them on the
              account page means finding their way back to the script while
              somebody is talking. */}
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground"
            title={fromCall ? "Back to the call" : "Back to the shop"}
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="text-lg font-extrabold">{account.name}</div>
            <div className="text-xs text-muted-foreground">
              {account.city ?? "Send a message"}
              {contact?.display ? ` · ${contact.display}` : ""}
            </div>
          </div>
        </div>
        <Link
          href={`/call/${account.id}/sheet`}
          className="rounded-lg border border-border/40 px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/50"
        >
          📄 Sheet
        </Link>
      </div>

      <div className="grid gap-5 py-5 lg:grid-cols-[300px_1fr]">
        {/* ---------------- template picker ---------------- */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setTemplateId(BLANK_ID)}
            className={cn(
              "mb-4 w-full rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors",
              blank
                ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                : "border-border/40 hover:bg-sidebar-accent/40",
            )}
          >
            <div className="font-bold">Write my own</div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Blank {channel === "email" ? "email" : "message"}, still sent and logged from here.
            </div>
          </button>

          {FIELD_TEMPLATE_GROUPS.map((group) => {
            const items = FIELD_TEMPLATES.filter((t) => t.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {group.label}
                </div>
                <div className="mb-2 text-[11px] leading-snug text-muted-foreground/70">
                  {group.blurb}
                </div>
                <div className="space-y-1">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                        t.id === templateId
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                          : "border-border/40 hover:bg-sidebar-accent/40",
                      )}
                    >
                      <div className="font-bold">{t.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t.when}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------------- draft ---------------- */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                  c.id === channel
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                    : "border-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </button>
            ))}

            {people.length > 1 && (
              <select
                value={recipientId ?? ""}
                onChange={(e) => setRecipientId(e.target.value || null)}
                className="ml-auto rounded-lg border border-border/40 bg-background px-2.5 py-1.5 text-xs [color-scheme:dark]"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {channel === "email" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Opens with</span>
              {MAIL_APPS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.note}
                  onClick={() => chooseMailApp(m.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-bold transition-colors",
                    m.id === mailApp
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                      : "border-border/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {missingPulse && (
            <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-[12px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This shop has no Pulse page yet, so the line offering one was left out. The rest
                of the message is complete.
              </span>
            </div>
          )}

          {missingSheet && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[12px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This shop has no one-pager link, so the message points at nothing. It needs to be
                synced to the lead pool first - Sync on the account page.
              </span>
            </div>
          )}

          {/* Who it actually goes to. Typed here, it overrides the contact
              for this send only - useful when the owner hands you a different
              address at the door and you have not updated the record yet. */}
          {channel !== "copy" && (
            <div className="rounded-lg border border-border/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {channel === "email" ? "Send to" : "Text to"}
                </span>
                {overridden && (
                  <button
                    type="button"
                    onClick={() => setToOverride({ email: null, phone: null })}
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Use the one on file
                  </button>
                )}
              </div>
              <input
                type={channel === "email" ? "email" : "tel"}
                inputMode={channel === "email" ? "email" : "tel"}
                autoComplete="off"
                value={
                  channel === "email"
                    ? (toOverride.email ?? contactEmail ?? "")
                    : (toOverride.phone ?? contactPhone ?? "")
                }
                onChange={(e) =>
                  setToOverride((cur) =>
                    channel === "email"
                      ? { ...cur, email: e.target.value }
                      : { ...cur, phone: e.target.value },
                  )
                }
                placeholder={channel === "email" ? "name@shop.com" : "(602) 555-0134"}
                className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
              />
              {overridden && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Sending here this once. The contact record is unchanged.
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border/40 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {channel === "email" ? "Email draft" : "Text draft"} · edit before you send
            </div>

            {channel === "email" && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="mb-2 w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
              />
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === "email" ? 16 : 6}
              className="w-full resize-y rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm leading-relaxed"
            />

            {channel !== "email" && (
              <div className="mt-1 text-right text-[11px] text-muted-foreground">
                {body.length} characters
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-500"
            />
            Remind me to follow up in 3 days
          </label>

          {blocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-2.5 text-[12px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{blocked}</span>
            </div>
          )}

          {sendError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] p-2.5 text-[12px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canSendDirect && (
              <button
                type="button"
                disabled={pending || sent}
                onClick={sendDirect}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <SendIcon className="h-4 w-4" />
                {sent ? "Sent" : `Send as ${tokens.repEmail}`}
              </button>
            )}

            {href && !blocked ? (
              <a
                href={href}
                target={channel === "email" && mailApp !== "device" ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={() => log(channel)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold",
                  canSendDirect
                    ? "border border-border/40 hover:bg-sidebar-accent/50"
                    : "bg-amber-500 font-extrabold text-slate-950 hover:bg-amber-400",
                )}
              >
                <ExternalLink className="h-4 w-4" />
                {channel === "email"
                  ? `Open in ${MAIL_APPS.find((m) => m.id === mailApp)?.label ?? "email"}`
                  : "Open Messages"}
              </a>
            ) : null}

            <button
              type="button"
              onClick={copyAll}
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-sm font-bold hover:bg-sidebar-accent/50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy
                </>
              )}
            </button>

            <button
              type="button"
              disabled={pending || sent}
              onClick={() => log(channel === "copy" ? "copy" : channel)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-sm font-bold hover:bg-sidebar-accent/50 disabled:opacity-50"
            >
              {sent ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Logged
                </>
              ) : (
                "Log it without opening"
              )}
            </button>
          </div>

          {sent && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] p-2.5 text-[12.5px] text-emerald-200">
              Logged to the timeline{followUp ? ", and a follow-up task is on your calendar for three days out" : ""}.{" "}
              <Link href={backHref} className="underline">
                {fromCall ? "Back to the call" : `Back to ${account.name}`}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
