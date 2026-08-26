"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Copy, Check, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendSetupLink } from "../setup-actions";

/**
 * What the merchant has actually done before install day.
 *
 * The point is not the checklist, it is the answer to "is this visit going to
 * work". An exchange account that has not cleared means their first payment
 * has nowhere to go, and that is worth knowing in the car rather than at the
 * register.
 */

const STEPS: { id: string; label: string; note: string }[] = [
  { id: "exchange", label: "Exchange account", note: "The slow one. Days of KYC, not minutes." },
  { id: "account", label: "NectarPay account", note: "Their email, their magic link." },
  { id: "ready", label: "Ready for the visit", note: "Owner present, Wi-Fi, a quiet hour." },
];

export function SetupPanel({
  dealId,
  existingUrl,
  steps,
}: {
  dealId: string;
  existingUrl: string | null;
  steps: Record<string, string | null>;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(existingUrl);
  const [copied, setCopied] = useState(false);

  const doneCount = STEPS.filter((s) => steps[s.id]).length;

  const send = () =>
    start(async () => {
      try {
        const res = await sendSetupLink({ dealId });
        setUrl(res.url);
        toast.success(
          res.sent ? "Sent, and logged to the timeline" : "Link created - no email on file",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not send");
      }
    });

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-amber-500/60" />
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider">
        <ClipboardList className="h-4 w-4 text-amber-400" /> BEFORE THE INSTALL
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Sends them what you cannot do for them - an exchange account, which takes days to clear,
        their NectarPay account, and what to have ready on the day. Send it when you book the
        install, not the night before.
      </p>

      <div className="mb-4 space-y-1.5">
        {STEPS.map((s) => {
          const at = steps[s.id];
          return (
            <div key={s.id} className="flex items-start gap-2.5 text-sm">
              <span
                className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  at ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                }`}
              >
                {at ? "\u2713" : ""}
              </span>
              <div className="min-w-0">
                <span className={at ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                {at ? (
                  <span className="ml-2 text-xs text-emerald-400">
                    {new Date(at).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-muted-foreground">{s.note}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {doneCount < STEPS.length && url && (
        <p className="mb-3 text-xs text-amber-400/90">
          {doneCount === 0
            ? "Nothing ticked off yet. Worth a call before you drive out."
            : "Not everything is done. The exchange account is the one that stalls an install."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={send} disabled={pending}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {pending ? "Sending..." : url ? "Send again" : "Send the setup link"}
        </Button>
        {url && (
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
