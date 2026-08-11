"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Quote, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureTestimonial, captureReferral } from "../referral-actions";

export function ReferralPanel({
  accountId,
  testimonials,
}: {
  accountId: string;
  testimonials: { id: string; quote: string; attribution: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"none" | "quote" | "referral">("none");

  const [quote, setQuote] = useState("");
  const [attribution, setAttribution] = useState("");
  const [publicOk, setPublicOk] = useState(true);

  const [biz, setBiz] = useState("");
  const [who, setWho] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.message ?? "That did not save");
        return;
      }
      toast.success(ok);
      setOpen("none");
      router.refresh();
    });

  return (
    <div className="card-lit relative rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-emerald-500/50" />
      <h2 className="mb-3 font-display text-lg tracking-wider">PROOF &amp; REFERRALS</h2>

      {testimonials.length > 0 && (
        <div className="mb-4 space-y-2">
          {testimonials.map((t) => (
            <blockquote
              key={t.id}
              className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-[13px] italic"
            >
              &ldquo;{t.quote}&rdquo;
              {t.attribution && (
                <footer className="mt-1 text-[11px] not-italic text-muted-foreground">
                  {t.attribution}
                </footer>
              )}
            </blockquote>
          ))}
        </div>
      )}

      {open === "none" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen("quote")}>
            <Quote className="mr-1.5 h-3.5 w-3.5" /> They said something good
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("referral")}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> They gave me a name
          </Button>
        </div>
      )}

      {open === "quote" && (
        <div className="space-y-2.5">
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={3}
            placeholder="What did they actually say? Their words, not yours."
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
          />
          <input
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            placeholder="Who said it - name and role"
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input
              type="checkbox"
              checked={publicOk}
              onChange={(e) => setPublicOk(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            They are fine with us using this publicly
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    captureTestimonial({
                      accountId,
                      quote,
                      attribution: attribution || null,
                      canUsePublicly: publicOk,
                    }),
                  "Saved",
                )
              }
            >
              Save it
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {open === "referral" && (
        <div className="space-y-2.5">
          <input
            value={biz}
            onChange={(e) => setBiz(e.target.value)}
            placeholder="Business name"
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Owner, if known"
              className="rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
            />
          </div>
          <p className="text-[12px] text-muted-foreground">
            This creates the shop as your account, tagged Referral, with a call task so the name
            does not go cold.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    captureReferral({
                      fromAccountId: accountId,
                      businessName: biz,
                      contactName: who || null,
                      phone: phone || null,
                      city: city || null,
                      note: null,
                    }),
                  "Referral added, and a call task is on your list",
                )
              }
            >
              Add the shop
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
