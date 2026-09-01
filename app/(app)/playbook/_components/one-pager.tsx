'use client';

import {
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  BREAK_EVEN_ONGOING_MONTHLY,
  MONTHLY_LABEL,
  YEAR_ONE_LABEL,
  ONGOING_LABEL,
} from '@/lib/pricing';
import { MoneyFlowStrip } from '@/components/marketing/money-flow';

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

      {/* Was four tiles that stopped at "lands in YOUR wallet" - which is the
          exact moment an owner starts wondering how it becomes dollars. Now
          five, carrying it all the way to their bank, and marking which single
          step NectarPay runs. Replacing rather than adding keeps this on one
          printed page. */}
      <div className="mb-4">
        <MoneyFlowStrip />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-neutral-300 p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">The napkin math</div>
          <div className="mb-1 text-xs text-neutral-600">A shop doing $10,000/month on cards:</div>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">Lost to card fees / year (~3%)</td><td className="py-1 text-right font-bold text-red-700">-$3,600</td></tr>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">NectarPay year one, all in</td><td className="py-1 text-right">{YEAR_ONE_LABEL}</td></tr>
              <tr className="border-b border-dashed border-neutral-300"><td className="py-1">Every year after</td><td className="py-1 text-right">{ONGOING_LABEL}</td></tr>
              <tr><td className="py-1 font-bold">Stays in the shop, year one</td><td className="py-1 text-right font-extrabold text-green-700">+$2,873</td></tr>
            </tbody>
          </table>
          {/* The honest floor. The table above compares the whole card volume
              against the cost, which assumes every dollar moves to crypto - an
              owner spots that in about four seconds, and then the rest of the
              sheet is suspect too. Break-even asks for far less and survives
              the objection. */}
          <div className="mt-2 border-t border-neutral-300 pt-2 text-[10.5px] leading-snug text-neutral-700">
            <b>It does not take all of that to be worth it.</b> About
            <b> ${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()}/month</b> in crypto sales covers year
            one, and about <b>${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()}/month</b> every year after.
          </div>
        </div>
        <div className="rounded bg-neutral-900 p-3 text-white">
          <div className="flex gap-5">
            <div>
              <div className="text-2xl font-extrabold text-amber-400">$499</div>
              <div className="text-[10px]">terminal, one-time</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">{MONTHLY_LABEL}</div>
              <div className="text-[10px]">/month, billed annually</div>
            </div>
          </div>
          <div className="mt-2 border-t border-neutral-700 pt-2 text-xs">
            Year one, all in: <b>~{YEAR_ONE_LABEL}</b> · then ~{ONGOING_LABEL}/year
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

      {/* CryptoPop band. After the proven reasons, before the ask, and worded so
          a rep never says "you will be listed". */}
      <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
            Coming next
          </span>
          <b className="text-[13px]">CryptoPop</b>
          <span className="text-[11px] text-neutral-600">
            the map that sends crypto customers to your door
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-start gap-3 sm:flex-nowrap">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-neutral-700">
            NectarPay is building a directory showing people who pay in crypto which businesses
            near them accept it, and what each one is running that week. When it launches,
            merchants taking crypto get listed and post their own specials. A card reader takes
            money - this is the part that brings someone in.
          </p>

          {/* Drawn as a phone, entirely in SVG: a floating map reads as a
              diagram, the same map inside a handset reads as an app the
              merchant's customers will open. SVG rather than HTML so the pins
              and the frame survive a black-and-white print. */}
          <div className="w-[124px] shrink-0 print:w-[124px]">
            <svg viewBox="0 0 124 208" className="block w-full" aria-hidden="true">
              {/* handset */}
              <rect x="1" y="1" width="122" height="206" rx="18" fill="#0b0b0d" />
              <rect x="6" y="6" width="112" height="196" rx="14" fill="#eef0f2" />

              {/* app chrome */}
              <rect x="6" y="6" width="112" height="30" rx="14" fill="#ffffff" />
              <rect x="6" y="24" width="112" height="12" fill="#ffffff" />
              <text x="13" y="18" fontSize="5.5" fontWeight="700" fill="#111827">5:11</text>
              <text x="97" y="18" fontSize="5.5" fill="#6b7280">Near you</text>
              <text x="13" y="31" fontSize="9" fontWeight="800" fill="#111827">Crypto</text>
              <text x="43" y="31" fontSize="9" fontWeight="800" fill="#b8760a">Pop</text>

              {/* category tabs */}
              <rect x="6" y="36" width="112" height="13" fill="#ffffff" />
              <text x="13" y="45" fontSize="5.5" fontWeight="700" fill="#b8760a">All</text>
              <rect x="12" y="46.5" width="9" height="1.6" fill="#f2a71b" />
              <text x="27" y="45" fontSize="5.5" fill="#6b7280">Coffee</text>
              <text x="50" y="45" fontSize="5.5" fill="#6b7280">Food</text>
              <text x="70" y="45" fontSize="5.5" fill="#6b7280">Retail</text>
              <text x="92" y="45" fontSize="5.5" fill="#6b7280">More</text>
              <line x1="6" y1="49" x2="118" y2="49" stroke="#eceff2" strokeWidth="1" />

              {/* map */}
              <rect x="6" y="49" width="112" height="112" fill="#eef0f2" />
              <g fill="#e6e2d8">
                <rect x="10" y="53" width="34" height="20" />
                <rect x="78" y="55" width="36" height="18" />
                <rect x="10" y="132" width="32" height="24" />
                <rect x="80" y="130" width="34" height="26" />
              </g>
              <g fill="#cfe4cd">
                <rect x="50" y="134" width="24" height="22" rx="2" />
                <rect x="50" y="52" width="22" height="16" rx="2" />
              </g>
              <g stroke="#d0d4d8" strokeWidth="6">
                <path d="M4 80 H120" /><path d="M4 122 H120" />
                <path d="M46 47 V163" /><path d="M78 47 V163" />
              </g>
              <g stroke="#ffffff" strokeWidth="4">
                <path d="M4 80 H120" /><path d="M4 122 H120" />
                <path d="M46 47 V163" /><path d="M78 47 V163" />
              </g>

              {/* offer pins */}
              <rect x="10" y="62" width="38" height="12" rx="6" fill="#fff" stroke="#c9cdd2" strokeWidth=".7" />
              <circle cx="16.5" cy="68" r="3.6" fill="#3b7dc4" />
              <text x="23" y="70.5" fontSize="6.2" fontWeight="700" fill="#111827">8% back</text>

              <rect x="74" y="88" width="42" height="12" rx="6" fill="#fff" stroke="#c9cdd2" strokeWidth=".7" />
              <circle cx="80.5" cy="94" r="3.6" fill="#2f7d4f" />
              <text x="87" y="96.5" fontSize="6.2" fontWeight="700" fill="#111827">10% back</text>

              <rect x="26" y="108" width="52" height="14" rx="7" fill="#0c1a2c" />
              <circle cx="34" cy="115" r="4.2" fill="#f2a71b" />
              <text x="41" y="117.5" fontSize="6.4" fontWeight="700" fill="#ffffff">Your shop</text>
              <circle cx="52" cy="130" r="3.6" fill="#2563eb" stroke="#fff" strokeWidth="1.4" />

              {/* the merchant's own listing */}
              <rect x="11" y="166" width="102" height="30" rx="6" fill="#ffffff" stroke="#e3e6e9" strokeWidth=".8" />
              <rect x="16" y="171" width="20" height="20" rx="4" fill="#0c1a2c" />
              <text x="22" y="185" fontSize="9" fontWeight="800" fill="#f2a71b">Y</text>
              <text x="41" y="179" fontSize="6.6" fontWeight="700" fill="#111827">Your shop</text>
              <text x="41" y="187" fontSize="6" fontWeight="700" fill="#1f8a5b">Your special goes here</text>
            </svg>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-neutral-500">
          In development, no launch date yet. The terminal pays for itself on fees either way.
        </p>
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
