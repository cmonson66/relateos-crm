import { TERMINAL_LABEL, bestTierFor, membershipMonthlyFor } from '@/lib/pricing';

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
export const TERMS_VERSION = "v3-2026-09";

export type TermsInput = {
  /** How many terminals are being loaned. Defaults to one. */
  terminals?: number;
  /** Set when the merchant has asked for preferred service. */
  wantsPreferred?: boolean;
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

  // A multi-location trial is a real case now, and section 8 is the clause a
  // merchant is held to. Quoting the single-terminal rate to a group that will
  // continue on the flat tier is a wrong number in a signed document, so the
  // continuation price is derived from how many terminals are actually loaned.
  const units = Math.max(1, Math.floor(t.terminals ?? 1));
  const tier = bestTierFor(units, t.wantsPreferred ?? false);
  const monthlyLabel = `$${membershipMonthlyFor(units, tier).toFixed(2)}`;
  const membershipClause =
    tier === 'multi'
      ? `${monthlyLabel} per month for the group membership covering all terminals, preferred service included`
      : units > 1
        ? `${monthlyLabel} per month total for ${units} memberships`
        : `${monthlyLabel} per month for the membership`;
  const provided =
    units === 1
      ? `one payment terminal, serial ${serial},`
      : `${units} payment terminals, serials ${serial},`;

  return `TRIAL TERMINAL AGREEMENT

Between ${COMPANY.name} ("${COMPANY.name}") and ${t.businessName}${address ? `, ${address}` : ""} ("the Merchant").
Delivered by ${t.repName}.

1. WHAT IS PROVIDED
${COMPANY.name} loans the Merchant ${provided} for a trial. Each terminal includes its built-in receipt printer and handheld. The Merchant supplies the internet connection and the thermal receipt paper.

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
The terminal carries a one-year warranty. If it stops working on its own, ${COMPANY.name} replaces it at no cost to the Merchant. The warranty does not cover damage the Merchant causes. If the terminal is not returned at the end of the trial, or comes back damaged beyond normal use, the Merchant agrees to pay the ${TERMINAL_LABEL} replacement cost.

8. WHEN THE TRIAL ENDS
The Merchant either continues on the standard terms (${TERMINAL_LABEL} for each terminal, plus ${membershipClause}, paid up front for the year, flat, with no percentage of sales) or returns the ${units === 1 ? 'terminal' : 'terminals'} within five business days.

9. NO ADVICE
${COMPANY.name} does not provide tax, legal, or investment advice. The value of cryptocurrency can change. The Merchant decides what to hold and what to convert.

10. EXISTING CARD PROCESSING
This trial does not change or replace the Merchant's current card processing. Cards keep working exactly as they do today.

11. SIGNING ELECTRONICALLY
By signing below the Merchant agrees to sign this agreement electronically, agrees that the electronic signature has the same effect as a handwritten one, and agrees to receive a copy by email. A copy remains available at the link in that email.`;
}
