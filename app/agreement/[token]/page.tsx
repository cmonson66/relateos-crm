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

// Read-only, no login. This is the merchant's retainable copy, which is what
// makes the electronic signature consent meaningful. Served through a
// security-definer RPC so the table itself stays closed.
//
// Palette matches the Pulse card exactly (navy #0c1a2c, honey #f2a71b,
// cream #f8f4ea) so a merchant who saw the Pulse page recognizes this one.
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

  // Terms arrive as numbered plain text. Split on the numbered headings so
  // each clause can be typeset rather than dumped into a <pre>.
  const parts = a.terms_snapshot.split(/\n(?=\d+\.\s+[A-Z])/);
  const preamble = parts[0] ?? "";
  const clauses = parts.slice(1).map((block) => {
    const nl = block.indexOf("\n");
    const head = nl === -1 ? block : block.slice(0, nl);
    const body = nl === -1 ? "" : block.slice(nl + 1).trim();
    const m = head.match(/^(\d+)\.\s+(.*)$/);
    return { n: m ? m[1] : "", title: m ? m[2] : head, body };
  });

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <div className="bg-[#0c1a2c] print:bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-7">
          <div>
            <div className="text-2xl font-extrabold leading-none text-white print:text-[#0c1a2c]">
              Nectar<span className="text-[#f2a71b]">Pay</span>
            </div>
            <div className="mt-1 text-[11px] italic text-white/60 print:text-[#47566b]">
              Sweeten Every Transaction.
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#f2a71b]">
              Trial Terminal Agreement
            </div>
            <div className="text-[11px] text-white/60 print:text-[#47566b]">
              Signed {signedOn} Phoenix time
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-9 print:px-0 print:py-4">
        <div className="mb-8 flex flex-wrap items-start gap-6 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5 shadow-sm print:shadow-none">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
              This agreement covers
            </div>
            <div className="mt-1 text-2xl font-extrabold leading-tight">{a.business_name}</div>
            {a.business_address && (
              <div className="text-sm text-[#47566b]">{a.business_address}</div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact k="Trial starts" v={a.trial_start} />
              <Fact k="Trial ends" v={a.trial_end} />
              <Fact k="Length" v={`${a.trial_days} days`} />
              <Fact k="Terminal" v={a.terminal_serial || "recorded at delivery"} />
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/NPterminal.png"
            alt="The NectarPay terminal by the register, showing a scan-to-pay code"
            width={252}
            height={222}
            className="w-28 shrink-0 rounded-xl border border-[#0c1a2c]/10"
          />
        </div>

        <div className="mb-4 border-b-2 border-[#f2a71b] pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#47566b]">
          The terms
        </div>

        {preamble && (
          <p className="mb-6 whitespace-pre-wrap text-[13px] leading-relaxed text-[#47566b]">
            {preamble.replace(/^TRIAL TERMINAL AGREEMENT\s*/i, "").trim()}
          </p>
        )}

        <ol className="mb-10 space-y-4">
          {clauses.map((c) => (
            <li key={c.n} className="flex break-inside-avoid gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2a71b] text-[11px] font-extrabold text-[#0c1a2c]">
                {c.n}
              </span>
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold uppercase tracking-wide">{c.title}</div>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[#47566b]">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="break-inside-avoid rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">Signed</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.signature_png}
            alt={`Signature of ${a.signer_name}`}
            className="mt-2 h-24 w-auto"
          />
          <div className="mt-1 border-t border-[#0c1a2c]/15 pt-2 text-sm">
            <div className="font-bold">{a.signer_name}</div>
            {a.signer_title && <div className="text-[#47566b]">{a.signer_title}</div>}
            <div className="text-[#47566b]">{a.business_name}</div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-[12px]">
            <Fact k="Signed" v={signedOn} />
            <Fact k="Delivered by" v={a.rep_name || "-"} />
          </dl>
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-[#47566b]">
          Agreement version {a.terms_version}. This page is the merchant&apos;s copy and stays
          available at this address. Print it for your records.
        </p>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#47566b]">{k}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-bold">{v}</dd>
    </div>
  );
}
