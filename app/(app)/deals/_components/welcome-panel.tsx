"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Copy, Check, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendWelcome } from "../welcome-actions";

/**
 * Two different teams phone the merchant after a close. Telling them that up
 * front is the difference between "organized" and "who keeps calling me".
 */
export function WelcomePanel({
  dealId,
  existingUrl,
}: {
  dealId: string;
  existingUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(existingUrl);
  const [copied, setCopied] = useState(false);

  const send = () =>
    start(async () => {
      try {
        const res = await sendWelcome({ dealId });
        setUrl(res.url);
        toast.success(
          res.sent ? "Sent, and logged to the timeline" : "Link created - no email on file",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not send");
      }
    });

  return (
    <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-emerald-500/60" />
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg tracking-wider">
        <PhoneCall className="h-4 w-4 text-emerald-400" /> WHAT HAPPENS NEXT
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Sends the merchant a page explaining the two calls coming their way - NectarPay support
        for the wallet, then CryptoPop for the listing and specials.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={send}
          className="font-display tracking-wider btn-glow"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {url ? "Send it again" : "Send it"}
        </Button>

        {url && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border/40 px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/50"
            >
              Preview
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-2 text-xs font-bold hover:bg-sidebar-accent/50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </>
              )}
            </button>
          </>
        )}
      </div>

      {url && (
        <div className="mt-3 break-all rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {url}
        </div>
      )}
    </div>
  );
}
