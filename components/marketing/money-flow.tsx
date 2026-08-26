/**
 * Where the money actually goes.
 *
 * Every merchant-facing surface stopped at "it lands in your wallet", which is
 * true and is also the exact point an owner starts wondering how it becomes
 * dollars in their bank. Answering that badly - or not at all - is what makes
 * a non-custodial product feel like a trick.
 *
 * The honest shape, and the reason this is one component rather than three:
 *
 *   customer -> TERMINAL (NectarPay's only step) -> WALLET -> EXCHANGE -> BANK
 *
 * Everything after the terminal is the merchant's own account. NectarPay does
 * not move money to a bank and must never be drawn as if it does.
 *
 * Two variants:
 *   MoneyFlow      - the full vertical explainer (install guide, setup page)
 *   MoneyFlowStrip - five compact tiles (the one-pager, where space is a page)
 *
 * Colours are hardcoded NectarPay brand rather than theme tokens: every
 * surface using this is a white sheet that gets printed.
 */

const NAVY = '#0c1a2c';
const AMBER = '#f2a71b';
const AMBER_TEXT = '#b45309';

type Row = {
  n: string;
  title: string;
  sub: string;
  who: string;
  /** The one step NectarPay runs. Drawn differently on purpose. */
  ours?: boolean;
};

const ROWS: Row[] = [
  {
    n: '1',
    title: 'Your customer pays',
    sub: 'They scan the code at your register with their own wallet app.',
    who: 'Your customer',
  },
  {
    n: '2',
    title: 'The NectarPay terminal',
    sub: 'Prices the sale, shows the code, confirms the payment, prints the receipt.',
    who: 'NectarPay',
    ours: true,
  },
  {
    n: '3',
    title: 'Your wallet',
    sub: 'The money lands here in seconds. Your keys, your funds - nobody can freeze it or take it back.',
    who: 'Yours',
  },
  {
    n: '4',
    title: 'Your exchange account',
    sub: 'When you want dollars, you move funds here and cash out. Coinbase, Kraken, whichever you prefer.',
    who: 'Yours, not NectarPay',
  },
  {
    n: '5',
    title: 'Your bank account',
    sub: 'Withdraw to the same business account you already use. Usually one to three business days.',
    who: 'Your existing bank',
  },
];

export function MoneyFlow({ compactHeading = false }: { compactHeading?: boolean }) {
  return (
    <div className="money-flow">
      {!compactHeading && (
        <h3 className="mb-1 text-[15px] font-extrabold" style={{ color: NAVY }}>
          How the money reaches your bank
        </h3>
      )}
      <p className="mb-3 text-[12.5px] leading-snug text-neutral-600">
        NectarPay runs one step of this. Everything after it is an account in your name.
      </p>

      <ol className="space-y-0">
        {ROWS.map((r, i) => (
          <li key={r.n} className="avoid-break">
            <div
              className="flex items-start gap-3 rounded-sm border p-2.5"
              style={{
                borderColor: r.ours ? AMBER : '#d4d4d4',
                background: r.ours ? '#fffbeb' : '#ffffff',
              }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: r.ours ? AMBER : NAVY,
                  color: r.ours ? NAVY : '#ffffff',
                }}
              >
                {r.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <b className="text-[13px]" style={{ color: NAVY }}>
                    {r.title}
                  </b>
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: r.ours ? AMBER_TEXT : '#71717a' }}
                  >
                    {r.who}
                  </span>
                </div>
                <div className="text-[12px] leading-snug text-neutral-600">{r.sub}</div>
              </div>
            </div>

            {i < ROWS.length - 1 && (
              <div className="ml-[19px] h-3 w-0 border-l-2 border-dotted border-neutral-400" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 space-y-1.5 border-t border-neutral-300 pt-2.5 text-[11.5px] leading-snug text-neutral-700">
        <p>
          <b>If you settle in stablecoins, step 4 is not a trade.</b> A dollar-pegged coin is
          worth a dollar, so cashing out is a conversion and a withdrawal, not a bet on a price.
          If you switch other coins on, their value can move between the sale and the cash-out -
          that is your choice, made coin by coin.
        </p>
        <p>
          <b>Set the exchange account up early.</b> It needs ID, your business details and a bank
          link, and approval takes days rather than minutes. Doing it before your terminal goes in
          means your first payment has somewhere to go.
        </p>
        <p className="text-neutral-500">
          Cashing out has tax and record-keeping consequences like any other income. Your
          accountant should see this page - we are not able to advise on it.
        </p>
      </div>
    </div>
  );
}

/**
 * The one-pager version. Replaces the old four-tile strip, which stopped at
 * "lands in YOUR wallet" and left the obvious next question unanswered on the
 * sheet the owner keeps.
 */
export function MoneyFlowStrip() {
  return (
    <div className="avoid-break">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 print:grid-cols-5">
        {ROWS.map((r) => (
          <div
            key={r.n}
            className="rounded border p-2"
            style={{
              borderColor: r.ours ? AMBER : '#d4d4d4',
              background: r.ours ? '#fffbeb' : '#ffffff',
            }}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  background: r.ours ? AMBER : NAVY,
                  color: r.ours ? NAVY : '#ffffff',
                }}
              >
                {r.n}
              </span>
              <span className="text-[10px] font-bold leading-tight">{r.title}</span>
            </div>
            <div className="text-[9px] leading-tight text-neutral-600">{r.sub}</div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[9.5px] leading-snug text-neutral-500">
        Steps 3 to 5 are accounts in your name. NectarPay never holds your money and never moves
        it to your bank - which is the same reason nobody can freeze it or reverse a sale. Talk to
        your accountant about how you record it.
      </p>
    </div>
  );
}
