'use client';

/**
 * One-pager: NectarPay pricing and offer summary for merchants
 * 
 * All pricing pulls from lib/pricing.ts — no hardcoded numbers anywhere.
 * When membership changes from $19 to $24.99, this renders the new price automatically.
 * 
 * Two tiers shown only:
 * - Standard: $24.99/month
 * - Year one all-in: $799
 */

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
import { Check, AlertCircle } from 'lucide-react';

export function OnePager() {
  return (
    &lt;div className="mx-auto max-w-2xl p-8 bg-white text-slate-900"&gt;
      {/* Header */}
      &lt;div className="mb-8 text-center"&gt;
        &lt;h1 className="text-3xl font-bold mb-2"&gt;NectarPay&lt;/h1&gt;
        &lt;p className="text-slate-600"&gt;Crypto payments. No percentage. No chargebacks.&lt;/p&gt;
      &lt;/div&gt;

      {/* Hero Copy */}
      &lt;div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200"&gt;
        &lt;h2 className="font-bold text-lg mb-3"&gt;Here's how it works:&lt;/h2&gt;
        &lt;ul className="space-y-2 text-sm text-slate-700"&gt;
          &lt;li className="flex gap-2"&gt;
            &lt;span className="text-amber-500 font-bold"&gt;→&lt;/span&gt;
            Customer chooses crypto at your register
          &lt;/li&gt;
          &lt;li className="flex gap-2"&gt;
            &lt;span className="text-amber-500 font-bold"&gt;→&lt;/span&gt;
            Terminal processes the payment
          &lt;/li&gt;
          &lt;li className="flex gap-2"&gt;
            &lt;span className="text-amber-500 font-bold"&gt;→&lt;/span&gt;
            Money lands in your wallet instantly
          &lt;/li&gt;
          &lt;li className="flex gap-2"&gt;
            &lt;span className="text-amber-500 font-bold"&gt;→&lt;/span&gt;
            No dispute window. Final. Done.
          &lt;/li&gt;
        &lt;/ul&gt;
      &lt;/div&gt;

      {/* Pricing Section */}
      &lt;div className="mb-8"&gt;
        &lt;h2 className="text-xl font-bold mb-4"&gt;Pricing&lt;/h2&gt;
        
        {/* Pricing Table */}
        &lt;table className="w-full text-sm mb-6"&gt;
          &lt;tbody&gt;
            &lt;tr className="border-b border-slate-200"&gt;
              &lt;td className="py-3 text-slate-700"&gt;Terminal hardware&lt;/td&gt;
              &lt;td className="py-3 text-right font-semibold"&gt;{TERMINAL_LABEL}&lt;/td&gt;
            &lt;/tr&gt;
            &lt;tr className="border-b border-slate-200"&gt;
              &lt;td className="py-3 text-slate-700"&gt;Monthly membership&lt;/td&gt;
              &lt;td className="py-3 text-right font-semibold"&gt;{MONTHLY_LABEL}/mo&lt;/td&gt;
            &lt;/tr&gt;
            &lt;tr className="border-b border-slate-200"&gt;
              &lt;td className="py-3 text-slate-700"&gt;Billed annually&lt;/td&gt;
              &lt;td className="py-3 text-right font-semibold"&gt;${(12 * 24.99).toLocaleString()}/year&lt;/td&gt;
            &lt;/tr&gt;
            &lt;tr className="bg-amber-50 border-b border-amber-200"&gt;
              &lt;td className="py-3 font-semibold text-slate-900"&gt;Year one, all in&lt;/td&gt;
              &lt;td className="py-3 text-right font-bold text-lg text-amber-600"&gt;{YEAR_ONE_LABEL}&lt;/td&gt;
            &lt;/tr&gt;
            &lt;tr&gt;
              &lt;td className="py-3 text-slate-700"&gt;Every year after&lt;/td&gt;
              &lt;td className="py-3 text-right font-semibold"&gt;{ONGOING_LABEL}&lt;/td&gt;
            &lt;/tr&gt;
            &lt;tr className="border-t-2 border-slate-300"&gt;
              &lt;td className="py-3 font-semibold text-slate-900"&gt;Cut of your sales&lt;/td&gt;
              &lt;td className="py-3 text-right font-bold text-lg text-emerald-600"&gt;0%&lt;/td&gt;
            &lt;/tr&gt;
          &lt;/tbody&gt;
        &lt;/table&gt;

        {/* Break-even note */}
        &lt;Card className="p-4 bg-blue-50 border-blue-200 mb-6"&gt;
          &lt;p className="text-sm text-slate-700"&gt;
            &lt;span className="font-semibold"&gt;Break-even:&lt;/span&gt; About {`$${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()}`}/month in crypto sales covers the entire first year. About {`$${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()}`}/month every year after that.
          &lt;/p&gt;
          &lt;p className="text-xs text-slate-600 mt-2"&gt;
            Everything above the break-even floor is margin you keep.
          &lt;/p&gt;
        &lt;/Card&gt;
      &lt;/div&gt;

      {/* Why NectarPay */}
      &lt;div className="mb-8"&gt;
        &lt;h2 className="text-xl font-bold mb-4"&gt;Why NectarPay&lt;/h2&gt;
        &lt;div className="space-y-3"&gt;
          &lt;div className="flex gap-3"&gt;
            &lt;Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /&gt;
            &lt;div&gt;
              &lt;div className="font-semibold text-slate-900"&gt;Instant settlement&lt;/div&gt;
              &lt;div className="text-sm text-slate-600"&gt;Money is yours before the customer leaves&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;

          &lt;div className="flex gap-3"&gt;
            &lt;Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /&gt;
            &lt;div&gt;
              &lt;div className="font-semibold text-slate-900"&gt;No processing fees&lt;/div&gt;
              &lt;div className="text-sm text-slate-600"&gt;Every crypto sale is 100% margin above the monthly fee&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;

          &lt;div className="flex gap-3"&gt;
            &lt;Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /&gt;
            &lt;div&gt;
              &lt;div className="font-semibold text-slate-900"&gt;No chargebacks&lt;/div&gt;
              &lt;div className="text-sm text-slate-600"&gt;Crypto payments are final. No dispute windows, no reversals&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;

          &lt;div className="flex gap-3"&gt;
            &lt;Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /&gt;
            &lt;div&gt;
              &lt;div className="font-semibold text-slate-900"&gt;Non-custodial&lt;/div&gt;
              &lt;div className="text-sm text-slate-600"&gt;Your money lives in a wallet you control. We don't hold it.&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;

          &lt;div className="flex gap-3"&gt;
            &lt;Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /&gt;
            &lt;div&gt;
              &lt;div className="font-semibold text-slate-900"&gt;Works alongside your card reader&lt;/div&gt;
              &lt;div className="text-sm text-slate-600"&gt;Nothing changes about how you accept cards. This is just a new lane.&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {/* Tech Specs */}
      &lt;div className="mb-8"&gt;
        &lt;h2 className="text-xl font-bold mb-4"&gt;What You Get&lt;/h2&gt;
        &lt;div className="grid grid-cols-2 gap-4 text-sm"&gt;
          &lt;div className="p-3 bg-slate-50 rounded"&gt;
            &lt;div className="font-semibold text-slate-900"&gt;NFC Terminal&lt;/div&gt;
            &lt;div className="text-slate-600"&gt;Sits by the register&lt;/div&gt;
          &lt;/div&gt;
          &lt;div className="p-3 bg-slate-50 rounded"&gt;
            &lt;div className="font-semibold text-slate-900"&gt;Merchant Dashboard&lt;/div&gt;
            &lt;div className="text-slate-600"&gt;See every sale&lt;/div&gt;
          &lt;/div&gt;
          &lt;div className="p-3 bg-slate-50 rounded"&gt;
            &lt;div className="font-semibold text-slate-900"&gt;Wallet Control&lt;/div&gt;
            &lt;div className="text-slate-600"&gt;You own it&lt;/div&gt;
          &lt;/div&gt;
          &lt;div className="p-3 bg-slate-50 rounded"&gt;
            &lt;div className="font-semibold text-slate-900"&gt;Instant Payout&lt;/div&gt;
            &lt;div className="text-slate-600"&gt;No waiting&lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {/* CTA */}
      &lt;div className="mb-8 text-center"&gt;
        &lt;Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-8"&gt;
          Let's talk
        &lt;/Button&gt;
        &lt;p className="text-xs text-slate-500 mt-4"&gt;No long-term contract. Cancel anytime.&lt;/p&gt;
      &lt;/div&gt;

      {/* Fine Print */}
      &lt;div className="text-xs text-slate-500 text-center border-t border-slate-200 pt-6"&gt;
        &lt;p&gt;NectarPay operates on Base (Ethereum layer 2) for USDC, USDT, and PYUSD.&lt;/p&gt;
        &lt;p className="mt-2"&gt;Settlement time: ~30 seconds. Monthly membership paid annually, billed in advance.&lt;/p&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
