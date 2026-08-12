import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CryptoPopPreview } from "@/components/marketing/cryptopop-preview";

export const dynamic = "force-dynamic";

type Welcome = {
  business_name: string;
  signer_name: string | null;
  terminal_serial: string | null;
  trial_start: string | null;
  trial_end: string | null;
  is_trial: boolean;
  rep_name: string | null;
  rep_cell: string | null;
  rep_email: string | null;
};

// Public, no login - the merchant will never have a CRM account. Reached from
// the "what happens next" email a rep sends the moment a deal closes.
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_deal_welcome", { p_token: token });
  const w = data as Welcome | null;
  if (!w) notFound();

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <div className="bg-[#0c1a2c]">
        <div className="mx-auto max-w-2xl px-6 py-9">
          <div className="text-2xl font-extrabold leading-none text-white">
            Nectar<span className="text-[#f2a71b]">Pay</span>
          </div>
          <div className="mt-1 text-[11px] italic text-white/60">Sweeten Every Transaction.</div>

          <div className="mt-7 text-[10px] uppercase tracking-[0.22em] text-[#f2a71b]">
            What happens next
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {w.business_name}
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/75">
            {w.signer_name ? `${w.signer_name}, you` : "You"} are set up. Two short phone calls
            get you taking payments and listed for new customers. Here is exactly what each one
            is for, so nothing catches you off guard.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-9">
        <div className="mb-8 flex flex-wrap items-start gap-5 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
          <div className="min-w-0 flex-1">
            <dl className="grid grid-cols-2 gap-4">
              <Fact k="Terminal" v={w.terminal_serial || "recorded at delivery"} />
              {w.is_trial && w.trial_end ? (
                <Fact k="Trial runs through" v={w.trial_end} />
              ) : (
                <Fact k="Status" v="Purchased" />
              )}
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/NPterminal.png"
            alt="The NectarPay terminal by the register"
            width={252}
            height={222}
            className="w-24 shrink-0 rounded-xl border border-[#0c1a2c]/10"
          />
        </div>

        <Step
          n="1"
          title="A call from NectarPay support"
          lead="Getting your wallet set up and answering anything you want to ask."
          points={[
            "They walk you through creating the wallet your money lands in. You own it and you control it - NectarPay never holds your funds.",
            "They confirm the terminal is paired and watch a test payment settle with you.",
            "Bring any question you did not want to ask in front of customers. Nothing is too basic.",
          ]}
          have="Have handy: a phone or computer for the wallet setup, and about twenty minutes somewhere you are not being interrupted."
        />

        <Step
          n="2"
          title="A call about CryptoPop"
          lead="Getting your shop on the map and showing you how to run specials."
          points={[
            "CryptoPop is the directory where people who pay in crypto find the businesses that take it. Your shop gets listed.",
            "They set up your account and show you how to post a special or an offer yourself.",
            "You control what runs and when. Change it, pause it, or leave it alone.",
          ]}
          have="Have handy: your business hours, a photo or two of the shop, and any offer you would want to lead with."
        />

        {/* Step 2 promises a CryptoPop call. This is what that call is about. */}
        <div className="mt-8 rounded-2xl bg-[#0c1a2c] p-5 sm:p-7">
          <CryptoPopPreview shopName={w.business_name} />
        </div>

        <div className="mt-8 rounded-2xl border border-[#f2a71b]/40 bg-[#f2a71b]/10 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
            In the meantime
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed">
            Keep taking cards exactly as you do now. Nothing about your current processing changes.
            {w.is_trial
              ? " The trial costs you nothing while it runs, and I will check in partway through."
              : ""}
          </p>
        </div>

        {w.rep_name && (
          <div className="mt-8 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
              Anything at all, before or after those calls
            </div>
            <div className="mt-1.5 text-lg font-extrabold">{w.rep_name}</div>
            <div className="text-[14px] text-[#47566b]">
              {w.rep_cell && <div>{w.rep_cell}</div>}
              {w.rep_email && <div>{w.rep_email}</div>}
            </div>
            <p className="mt-2 text-[13px] text-[#47566b]">
              I answer my own phone. If something is not working, call me first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  lead,
  points,
  have,
}: {
  n: string;
  title: string;
  lead: string;
  points: string[];
  have: string;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2a71b] text-sm font-extrabold text-[#0c1a2c]">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
          <p className="mt-0.5 text-[14px] text-[#47566b]">{lead}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 pl-11">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-[14px] leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#f2a71b]" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="ml-11 mt-3 border-t border-[#0c1a2c]/10 pt-2.5 text-[13px] text-[#47566b]">
        {have}
      </p>
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
