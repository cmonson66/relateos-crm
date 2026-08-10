import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Agreement = {
  business_name: string;
  business_address: string | null;
  signer_name: string;
  signer_title: string | null;
  terminal_serial: string | null;
  trial_start: string;
  trial_end: string;
  trial_days: number;
  terms_snapshot: string;
  terms_version: string;
  signature_png: string;
  signed_at: string;
  rep_name: string | null;
};

// Read-only, no login. This is the copy the merchant keeps, which is what
// makes the electronic signature consent meaningful. Served through a
// security-definer RPC so the table itself stays closed.
export default async function SignedAgreementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_trial_agreement", { p_token: token });
  const a = data as Agreement | null;
  if (!a) notFound();

  const signedOn = new Date(a.signed_at).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Phoenix",
  });

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
          {a.terms_snapshot}
        </pre>

        <div className="mt-10 border-t border-slate-300 pt-6">
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Signed
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.signature_png}
            alt={`Signature of ${a.signer_name}`}
            className="mt-2 h-24 w-auto"
          />
          <div className="mt-2 text-sm">
            <div className="font-semibold">{a.signer_name}</div>
            {a.signer_title && <div className="text-slate-600">{a.signer_title}</div>}
            <div className="text-slate-600">{a.business_name}</div>
            {a.business_address && <div className="text-slate-600">{a.business_address}</div>}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-[12px] sm:grid-cols-4">
            <Item k="Signed" v={signedOn} />
            <Item k="Trial" v={`${a.trial_start} to ${a.trial_end}`} />
            <Item k="Terminal" v={a.terminal_serial || "recorded at delivery"} />
            <Item k="Delivered by" v={a.rep_name || "-"} />
          </dl>

          <p className="mt-8 text-[11px] text-slate-500">
            Agreement version {a.terms_version}. This page is the merchant&apos;s copy and stays
            available at this address. Print it for your records.
          </p>
        </div>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}
