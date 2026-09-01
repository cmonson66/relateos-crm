import { TERMINAL_ONCE, MEMBERSHIP_MONTHLY } from '@/lib/pricing';

// The trial agreement, as text.
//
// The signed record stores a SNAPSHOT of what buildTerms() returned on the
// day it was signed, plus this version string. Editing the wording below
// therefore never rewrites an agreement somebody already signed - bump the
// version and history stays honest.
//
// EDIT THESE TWO before Eric hands one to a merchant: the counterparty is
// NectarPay corporate, so the legal name and address have to be theirs.
export const COMPANY = {
  name: "NectarPay",
  address: "[NectarPay legal address - confirm with Tim Blake]",
};

// BUMPED for the membership price change. Signed rows keep their own terms
// snapshot, so nothing already executed is altered by this.
export const TERMS_VERSION = "v2-2026-08";

export type TermsInput = {
  businessName: string;
  businessAddress?: string | null;
  serial?: string | null;
  start: string; // YYYY-MM-DD
  end: string;
  days: number;
  repName: string;
};

export function buildTerms(t: TermsInput): string {
  const serial = t.serial?.trim() || "recorded at delivery";
  const address = t.businessAddress?.trim() || "";

  return `TRIAL TERMINAL AGREEMENT

Between ${COMPANY.name} ("${COMPANY.name}") and ${t.businessName}${address ? `, ${address}` : ""} ("the Merchant").
Delivered by ${t.repName}.

1. WHAT IS PROVIDED
${COMPANY.name} loans the Merchant one payment terminal, serial ${serial}, for a trial. The terminal includes its built-in receipt printer and handheld. The Merchant supplies the internet connection and the thermal receipt paper.

2. HOW LONG
The trial runs ${t.start} through ${t.end} (${t.days} days). Either party may end it earlier by telling the other.

3. WHAT IT COSTS
Nothing. No terminal charge, no monthly subscription, and no percentage of any sale for the length of the trial.

4. WHO OWNS THE TERMINAL
The terminal remains the property of ${COMPANY.name} throughout the trial. Ownership does not pass to the Merchant unless and until the Merchant purchases it.

5. THE MERCHANT'S MONEY
Payments settle directly to a cryptocurrency wallet the Merchant owns and controls. ${COMPANY.name} does not hold, custody, or have access to those funds at any point. Cryptocurrency payments are final and cannot be reversed or charged back.

6. TAKING CARE OF IT
The Merchant agrees to keep the terminal powered and reasonably secure, not to open or modify it, and to tell ${COMPANY.name} promptly if it is lost, stolen, or damaged.

7. WARRANTY, AND IF IT IS NOT RETURNED
The terminal carries a one-year warranty. If it stops working on its own, ${COMPANY.name} replaces it at no cost to the Merchant. The warranty does not cover damage the Merchant causes. If the terminal is not returned at the end of the trial, or comes back damaged beyond normal use, the Merchant agrees to pay the ${TERMINAL_ONCE} replacement cost.

8. WHEN THE TRIAL ENDS
The Merchant either continues on the standard terms (${TERMINAL_ONCE} for the terminal, plus ${MEMBERSHIP_MONTHLY.toFixed(2)} per month for the membership paid up front for the year, flat, with no percentage of sales) or returns the terminal within five business days.

9. NO ADVICE
${COMPANY.name} does not provide tax, legal, or investment advice. The value of cryptocurrency can change. The Merchant decides what to hold and what to convert.

10. EXISTING CARD PROCESSING
This trial does not change or replace the Merchant's current card processing. Cards keep working exactly as they do today.

11. SIGNING ELECTRONICALLY
By signing below the Merchant agrees to sign this agreement electronically, agrees that the electronic signature has the same effect as a handwritten one, and agrees to receive a copy by email. A copy remains available at the link in that email.`;
}
