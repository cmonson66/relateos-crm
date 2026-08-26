import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MoneyFlow } from '@/components/marketing/money-flow';
import { SetupChecklist, type StepId } from './setup-client';

export const dynamic = 'force-dynamic';

/**
 * Before the install visit.
 *
 * Public, no login - the merchant will never have a CRM account. Reached from
 * a link the rep sends the moment the install is booked.
 *
 * WHY THIS EXISTS: the two slowest parts of an install are the two a rep
 * cannot do for them. An exchange account is days of KYC. A NectarPay account
 * needs their email and a magic link they have to open. Doing both with a rep
 * standing at the register is how a forty-minute install happens.
 *
 * WHAT IS DELIBERATELY MISSING: the wallet. It pairs from the physical coin
 * the rep brings, so it is not homework - it happens on the day, with them.
 * Putting it here would ask an owner to do something they cannot finish.
 */

type Setup = {
  business_name: string;
  city: string;
  owner_first: string | null;
  is_trial: boolean;
  steps: Record<string, string | null>;
  rep: { first: string; cell: string; email: string };
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await load(token);
  return {
    title: s ? `Getting ready - ${s.business_name}` : 'NectarPay',
    description: 'Two things to do before your terminal goes in.',
    robots: { index: false, follow: false },
  };
}

async function load(token: string): Promise<Setup | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_merchant_setup', { p_token: token });
  return (data as Setup | null) ?? null;
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener"
    className="font-bold text-[#b45309] underline underline-offset-2"
  >
    {children}
  </a>
);

export default async function MerchantSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const s = await load(token);
  if (!s) notFound();

  const steps: { id: StepId; n: string; title: string; time: string; body: React.ReactNode }[] = [
    {
      id: 'exchange',
      n: '1',
      title: 'Open an exchange account',
      time: 'Start today \u00b7 approval takes days',
      body: (
        <>
          <p>
            This is the account that turns crypto into dollars in your bank. It is the slow one -
            it needs your ID, your business details and a bank link, and approval is not instant.
            Everything else on this page takes minutes.
          </p>
          <p>
            <A href="https://www.coinbase.com/">Coinbase</A>,{' '}
            <A href="https://www.kraken.com/">Kraken</A> and{' '}
            <A href="https://www.gemini.com/">Gemini</A> all work. Pick whichever you like - this
            is your account, not ours, and we do not get anything from it.
          </p>
          <p className="rounded-lg border border-[#f2a71b]/50 bg-[#fffbeb] px-3 py-2 text-[13px]">
            Ask for a <b>business</b> account if the shop is a company, and use the same bank
            account you already take deposits into. Getting that wrong means redoing it later.
          </p>
        </>
      ),
    },
    {
      id: 'account',
      n: '2',
      title: 'Create your NectarPay account',
      time: 'About two minutes',
      body: (
        <>
          <p>
            Go to <A href="https://nectar-pay.com">nectar-pay.com</A> and click{' '}
            <b>Start free</b> in the top right. It emails you a link to sign in - no password to
            invent.
          </p>
          <p>
            Use the email <b>you</b> check, not a shared inbox nobody opens. Enter the business
            name exactly the way customers know it, because it prints on receipts.
          </p>
          <p className="text-[#47566b]">
            That is all we need before the visit. {s.rep.first} handles the rest with you.
          </p>
        </>
      ),
    },
    {
      id: 'ready',
      n: '3',
      title: 'Be set for the visit',
      time: 'Five minutes of thinking',
      body: (
        <>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>The owner needs to be there.</b> The wallet has to belong to whoever owns the
              business - it cannot be set up in a manager&apos;s name.
            </li>
            <li>
              <b>Your Wi-Fi password</b>, somewhere you can find it.
            </li>
            <li>
              <b>A couple of dollars</b> for a real test payment at the end.
            </li>
            <li>
              <b>An hour you are not slammed.</b> Never during a rush.
            </li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <div className="bg-[#0c1a2c]">
        <div className="mx-auto max-w-2xl px-6 py-9">
          <div className="text-2xl font-extrabold leading-none text-white">
            Nectar<span className="text-[#f2a71b]">Pay</span>
          </div>
          <div className="mt-1 text-[11px] italic text-white/60">Sweeten Every Transaction.</div>

          <div className="mt-7 text-[10px] uppercase tracking-[0.22em] text-[#f2a71b]">
            Before your terminal goes in
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {s.business_name}
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/75">
            {s.owner_first ? `${s.owner_first}, there` : 'There'} are two things worth doing before{' '}
            {s.rep.first} comes out. Do them and the install takes minutes instead of an
            afternoon. Tick each one off here so {s.rep.first} knows where you are.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-9">
        <SetupChecklist token={token} initial={s.steps} steps={steps} />

        <div className="mt-8 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
            Where your money actually goes
          </div>
          <MoneyFlow compactHeading />
        </div>

        <div className="mt-8 rounded-2xl border border-[#f2a71b]/40 bg-[#f2a71b]/10 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
            In the meantime
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed">
            Keep taking cards exactly as you do now. Nothing about your current processing
            changes.
            {s.is_trial
              ? ' The trial costs you nothing while it runs, and I will check in partway through.'
              : ''}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-[#0c1a2c]/10 bg-white p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">
            Stuck on any of it
          </div>
          <div className="mt-1.5 text-lg font-extrabold">{s.rep.first}</div>
          <div className="text-[14px] text-[#47566b]">
            {s.rep.cell && <div>{s.rep.cell}</div>}
            {s.rep.email && <div>{s.rep.email}</div>}
          </div>
          <p className="mt-2 text-[13px] text-[#47566b]">
            Do not spend an evening fighting with it. Call me and we will do it together.
          </p>
        </div>
      </div>
    </div>
  );
}
