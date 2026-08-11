'use client';

// The leave-behind, rendered in-app so it carries the rep's own name and
// cell and never drifts from the PDF sitting in someone's texts.
export function OnePager({ rep }: { rep: { first: string; cell: string; email: string } }) {
  return (
    <div className="one-pager rounded-md border border-border/40 bg-white p-6 text-black sm:p-8 print:border-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-2xl font-extrabold leading-none">
            Nectar<span className="text-amber-600">Pay</span>
          </div>
          <div className="text-[11px] italic text-neutral-600">Sweeten Every Transaction.</div>
        </div>
        <div className="text-right text-xs text-neutral-600">
          Independent Ambassadors<br />Phoenix, AZ
        </div>
      </div>

      {/* Photo beside the promise, matching the PDF. An owner who has never
          seen one pictures a card reader until they see the real thing. */}
      <div className="mb-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="mb-1 text-xl font-extrabold leading-tight">
            Accept crypto with zero processing fees -<br />money in your wallet the second they pay.
          </h1>
          <p className="text-sm text-neutral-700">
            A small terminal by the register. Your card reader keeps working - this is the no-fee lane beside it.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/NPterminal.png"
          alt="The NectarPay terminal by the register, showing a scan-to-pay code"
          width={252}
          height={222}
          className="w-24 shrink-0 rounded border border-neutral-300 sm:w-28 print:w-28"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
        {[
          ['1', 'Enter the amount', 'Type the sale into the terminal'],
          ['2', 'Customer scans', 'QR appears, they scan with their wallet'],
          ['3', 'Confirm & pay', 'Network verifies in seconds'],
          ['4', 'Funds settle', 'Lands in YOUR wallet. No reversal'],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded border border-neutral-300 p-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">{n}</span>
              <span className="text-[10px] font-bold">{t}</span>
            </div>
            <div className="text-[9px] leading-tight text-neutral-600">{d}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-neutral-300 p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">The napkin math</div>
          <div className="mb-1 text-xs text-neutral-600">A shop doing $10,000/month on cards:</div>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">Lost to card fees / year (~3%)</td><td className="py-1 text-right font-bold text-red-700">-$3,600</td></tr>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">NectarPay year one, all in</td><td className="py-1 text-right">$727</td></tr>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">Every year after</td><td className="py-1 text-right">$228</td></tr>
              <tr><td className="py-1 font-bold">Stays in the shop, year one</td><td className="py-1 text-right font-extrabold text-green-700">+$2,873</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded bg-neutral-900 p-3 text-white">
          <div className="flex gap-5">
            <div>
              <div className="text-2xl font-extrabold text-amber-400">$499</div>
              <div className="text-[10px]">terminal, one-time</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">$19</div>
              <div className="text-[10px]">/month, billed annually</div>
            </div>
          </div>
          <div className="mt-2 border-t border-neutral-700 pt-2 text-xs">
            Year one, all in: <b>~$727</b> · then ~$228/year
          </div>
          <div className="mt-1.5 text-[11px] font-bold text-amber-400">
            No percentage of your sales. Ever.
          </div>
          <div className="mt-1.5 border-t border-neutral-700 pt-1.5 text-[10px] leading-snug text-neutral-300">
            Want us picking up the phone? White-glove support is $99/mo.
          </div>
        </div>
      </div>

      <div className="mb-4 rounded border border-neutral-300 bg-neutral-50 p-2.5">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Good to know</div>
        <div className="grid gap-x-4 gap-y-0.5 text-[10.5px] leading-snug text-neutral-700 sm:grid-cols-2">
          <div><b>One-year warranty.</b> Fails on its own, we replace it. Break it yourself and you buy another.</div>
          <div><b>Receipt printer built in.</b> You supply thermal paper - a few dollars anywhere.</div>
          <div><b>Your Wi-Fi.</b> There is a SIM slot too if you want it mobile.</div>
          <div><b>No hardware? No problem.</b> The Nectar.Pay app runs on your phone - you just skip the printer and handheld.</div>
          <div className="sm:col-span-2"><b>There is a free software-only tier</b>, but it does not run the terminal. The $19 membership is what powers the hardware.</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Why owners say yes</div>
        <div className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
          {[
            ['Zero fees on crypto', 'The 2-4% card networks take simply is not there.'],
            ['Instant settlement', 'Money lands in seconds, not business days.'],
            ['No chargebacks', 'A delivered sale stays sold.'],
            ['Non-custodial', 'Funds go straight to a wallet YOU own.'],
            ['Cards keep working', 'This adds a lane - nothing else changes.'],
            ['Ready for what is next', 'Crypto customers pick shops that take it.'],
          ].map(([t, d]) => (
            <div key={t}><b>{t}:</b> <span className="text-neutral-700">{d}</span></div>
          ))}
        </div>
      </div>

      <div className="rounded bg-neutral-900 p-3 text-white">
        <div className="text-sm font-bold">Want to see it live? Ten minutes at your shop.</div>
        <div className="mt-1 text-xs text-amber-400">
          {rep.first} · NectarPay Ambassador, Phoenix{rep.cell && ` · ${rep.cell}`}
          {rep.email && <span className="text-neutral-300"> · {rep.email}</span>}
        </div>
      </div>
    </div>
  );
}
