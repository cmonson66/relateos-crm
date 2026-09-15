'use client';

import {
  BREAK_EVEN_YEAR_ONE_MONTHLY,
  BREAK_EVEN_ONGOING_MONTHLY,
  TERMINAL_LABEL,
  MONTHLY_LABEL,
  YEAR_ONE_LABEL,
  ONGOING_LABEL,
} from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';

export function OnePager() {
  return (
    <div className="mx-auto max-w-2xl p-8 bg-white text-slate-900">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">NectarPay</h1>
        <p className="text-slate-600">Crypto payments. No percentage. No chargebacks.</p>
      </div>

      <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
        <h2 className="font-bold text-lg mb-3">Here's how it works:</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="text-amber-500 font-bold">→</span>
            Customer chooses crypto at your register
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 font-bold">→</span>
            Terminal processes the payment
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 font-bold">→</span>
            Money lands in your wallet instantly
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 font-bold">→</span>
            No dispute window. Final. Done.
          </li>
        </ul>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Pricing</h2>
        
        <table className="w-full text-sm mb-6">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-3 text-slate-700">Terminal hardware</td>
              <td className="py-3 text-right font-semibold">{TERMINAL_LABEL}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-3 text-slate-700">Monthly membership</td>
              <td className="py-3 text-right font-semibold">{MONTHLY_LABEL}/mo</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-3 text-slate-700">Billed annually</td>
              <td className="py-3 text-right font-semibold">${(12 * 24.99).toLocaleString()}/year</td>
            </tr>
            <tr className="bg-amber-50 border-b border-amber-200">
              <td className="py-3 font-semibold text-slate-900">Year one, all in</td>
              <td className="py-3 text-right font-bold text-lg text-amber-600">{YEAR_ONE_LABEL}</td>
            </tr>
            <tr>
              <td className="py-3 text-slate-700">Every year after</td>
              <td className="py-3 text-right font-semibold">{ONGOING_LABEL}</td>
            </tr>
            <tr className="border-t-2 border-slate-300">
              <td className="py-3 font-semibold text-slate-900">Cut of your sales</td>
              <td className="py-3 text-right font-bold text-lg text-emerald-600">0%</td>
            </tr>
          </tbody>
        </table>

        <Card className="p-4 bg-blue-50 border-blue-200 mb-6">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Break-even:</span> About ${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()}/month in crypto sales covers the entire first year. About ${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()}/month every year after that.
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Everything above the break-even floor is margin you keep.
          </p>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Why NectarPay</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Instant settlement</div>
              <div className="text-sm text-slate-600">Money is yours before the customer leaves</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">No processing fees</div>
              <div className="text-sm text-slate-600">Every crypto sale is 100% margin above the monthly fee</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">No chargebacks</div>
              <div className="text-sm text-slate-600">Crypto payments are final. No dispute windows, no reversals</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Non-custodial</div>
              <div className="text-sm text-slate-600">Your money lives in a wallet you control. We don't hold it.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Works alongside your card reader</div>
              <div className="text-sm text-slate-600">Nothing changes about how you accept cards. This is just a new lane.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">What You Get</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded">
            <div className="font-semibold text-slate-900">NFC Terminal</div>
            <div className="text-slate-600">Sits by the register</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="font-semibold text-slate-900">Merchant Dashboard</div>
            <div className="text-slate-600">See every sale</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="font-semibold text-slate-900">Wallet Control</div>
            <div className="text-slate-600">You own it</div>
          </div>
          <div className="p-3 bg-slate-50 rounded">
            <div className="font-semibold text-slate-900">Instant Payout</div>
            <div className="text-slate-600">No waiting</div>
          </div>
        </div>
      </div>

      <div className="mb-8 text-center">
        <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-8">
          Let's talk
        </Button>
        <p className="text-xs text-slate-500 mt-4">No long-term contract. Cancel anytime.</p>
      </div>

      <div className="text-xs text-slate-500 text-center border-t border-slate-200 pt-6">
        <p>NectarPay operates on Base (Ethereum layer 2) for USDC, USDT, and PYUSD.</p>
        <p className="mt-2">Settlement time: ~30 seconds. Monthly membership paid annually, billed in advance.</p>
      </div>
    </div>
  );
}
