"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, Send, CheckCircle2, FileSignature, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvoice, sendInvoice, markInvoicePaid } from "../invoice-actions";

export type InvoiceRow = {
  id: string;
  number: string;
  token: string;
  total_cents: number;
  status: string;
  sent_at: string | null;
  paid_at: string | null;
  paid_method: string | null;
};

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const METHODS = ["Crypto", "Card", "ACH", "Check", "Cash"];

/**
 * The paperwork half of a close: what they signed, what they owe, what they
 * paid. A paid invoice is the receipt, so there is no third document.
 */
export function PaperworkPanel({
  dealId,
  hasItems,
  hasPurchaseAgreement,
  invoices,
  siteUrl,
}: {
  dealId: string;
  hasItems: boolean;
  hasPurchaseAgreement: boolean;
  invoices: InvoiceRow[];
  siteUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState(METHODS[0]);

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not work");
      }
    });

  const open = invoices.find((i) => i.status !== "paid");

  return (
    <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-sky-500/60" />
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider">
        <Receipt className="h-4 w-4 text-sky-400" /> PAPERWORK
      </h2>

      {/* the agreement */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {hasPurchaseAgreement ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Purchase agreement signed
          </span>
        ) : (
          <Link href={`/deals/${dealId}/agreement?kind=purchase`}>
            <Button size="sm" variant="outline" className="font-display tracking-wider">
              <FileSignature className="mr-1.5 h-3.5 w-3.5" /> Sign the purchase agreement
            </Button>
          </Link>
        )}
      </div>

      {/* invoices */}
      {invoices.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasItems
              ? "No invoice yet. It is built from the line items above and freezes those prices."
              : "Add what they are getting above first - an invoice needs line items."}
          </p>
          <Button
            size="sm"
            disabled={pending || !hasItems}
            onClick={() => run(() => createInvoice({ dealId }), "Invoice created")}
            className="font-display tracking-wider btn-glow"
          >
            Create the invoice
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {inv.number} · {usd(inv.total_cents)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {inv.status === "paid"
                    ? `Paid${inv.paid_method ? ` by ${inv.paid_method}` : ""} - this link is now the receipt`
                    : inv.sent_at
                      ? "Sent, awaiting payment"
                      : "Issued, not sent yet"}
                </div>
              </div>
              <a
                href={`${siteUrl}/invoice/${inv.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-bold hover:bg-sidebar-accent/50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
              {inv.status !== "paid" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => sendInvoice({ invoiceId: inv.id }), "Invoice sent")}
                  className="shrink-0 font-display tracking-wider"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> {inv.sent_at ? "Send again" : "Send"}
                </Button>
              )}
            </div>
          ))}

          {open && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm [color-scheme:dark]"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => markInvoicePaid({ invoiceId: open.id, method }),
                    "Marked paid - the link is now a receipt",
                  )
                }
                className="font-display tracking-wider btn-glow"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark {open.number} paid
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
