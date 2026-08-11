"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronLeft, Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTerms } from "@/lib/trial-agreement";
import { addDays, TRIAL_LENGTH_OPTIONS } from "@/lib/db/trials";
import { signTrialAgreement } from "../agreement-actions";

export function AgreementForm(props: {
  dealId: string;
  accountId: string;
  contactId: string | null;
  businessName: string;
  businessAddress: string | null;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  serial: string;
  startDate: string;
  days: number;
  repName: string;
  kind: "trial" | "purchase";
}) {
  const router = useRouter();
  const [pending, startPending] = useTransition();

  const [businessName, setBusinessName] = useState(props.businessName);
  const [businessAddress, setBusinessAddress] = useState(props.businessAddress ?? "");
  const [signerName, setSignerName] = useState(props.signerName);
  const [signerTitle, setSignerTitle] = useState(props.signerTitle);
  const [signerEmail, setSignerEmail] = useState(props.signerEmail);
  const [serial, setSerial] = useState(props.serial);
  const [startDate, setStartDate] = useState(props.startDate);
  const [days, setDays] = useState(props.days);
  const [consent, setConsent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const end = addDays(startDate, days);
  const terms = buildTerms({
    businessName,
    businessAddress,
    serial,
    start: startDate,
    end,
    days,
    repName: props.repName,
  });

  // Plain pointer events. A signature pad is forty lines, and a dependency
  // that only runs on one screen is not worth a lockfile change.
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const up = () => {
    drawing.current = false;
  };

  const clearInk = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const submit = () => {
    const c = canvasRef.current;
    if (!c || !hasInk) return toast.error("The merchant needs to sign the box");
    if (!consent) return toast.error("Check the electronic signature box first");
    if (!signerName.trim()) return toast.error("Type the merchant's full name");

    startPending(async () => {
      try {
        const res = await signTrialAgreement({
          dealId: props.dealId,
          accountId: props.accountId,
          contactId: props.contactId,
          businessName: businessName.trim(),
          businessAddress: businessAddress.trim() || null,
          signerName,
          signerTitle: signerTitle || null,
          signerEmail: signerEmail || null,
          serial: serial || null,
          startDate,
          days,
          signaturePng: c.toDataURL("image/png"),
          consent,
          kind: props.kind,
        });
        setDone(res.url);
        toast.success("Signed. Copy is on its way.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not save");
      }
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="font-display text-3xl tracking-wider">SIGNED</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {businessName} is on a {days} day trial through {end}. A copy went to{" "}
          {signerEmail || "the merchant"} and the trial is now running on the deal.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={done}>
            <Button variant="outline" size="sm">View the signed copy</Button>
          </Link>
          <Link href={`/deals/${props.dealId}`}>
            <Button size="sm" className="font-display tracking-wider btn-glow">Back to the deal</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20">
      <div className="flex items-center gap-3 border-b border-border/40 py-4">
        <Link href={`/deals/${props.dealId}`} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="text-lg font-extrabold">
            {props.kind === "purchase" ? "Purchase agreement" : "Trial agreement"}
          </div>
          <div className="text-xs text-muted-foreground">
            Hand the phone over when you get to the signature box
          </div>
        </div>
      </div>

      <div className="space-y-4 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business" value={businessName} onChange={setBusinessName} />
          <Field label="Address" value={businessAddress} onChange={setBusinessAddress} placeholder="Street, city, state" />
          <Field label="Terminal serial" value={serial} onChange={setSerial} placeholder="Off the back of the unit" />
          <div>
            <Label>Starts</Label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        {/* A purchase has no trial clock, so the length picker is trial-only */}
        {props.kind === "trial" && (
        <div>
          <Label>Length - ends {end}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {TRIAL_LENGTH_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                  d === days
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                    : "border-border/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {d} days
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
              className="w-20 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
        )}

        <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            The agreement
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-foreground/90">
            {terms}
          </pre>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Signer name" value={signerName} onChange={setSignerName} />
          <Field label="Title" value={signerTitle} onChange={setSignerTitle} placeholder="Owner" />
          <Field label="Email for the copy" value={signerEmail} onChange={setSignerEmail} placeholder="name@shop.com" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>Signature</Label>
            <button
              type="button"
              onClick={clearInk}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <Eraser className="h-3 w-3" /> Clear
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={900}
            height={280}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className="h-40 w-full touch-none rounded-lg border border-border/40 bg-white"
          />
          {!hasInk && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <PenLine className="h-3 w-3" /> Sign with a finger
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-[12.5px] leading-snug text-muted-foreground">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
          />
          I agree to sign this electronically, that my electronic signature counts the same as
          a handwritten one, and to receive a copy by email.
        </label>

        <Button
          disabled={pending}
          onClick={submit}
          className="w-full font-display tracking-wider btn-glow"
        >
          {pending ? "Signing..." : "Sign and send the copy"}
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
      />
    </div>
  );
}
