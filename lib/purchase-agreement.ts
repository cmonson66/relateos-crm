// The purchase agreement, as text.
//
// Same rules as the trial: the signed record stores a SNAPSHOT of what this
// returned on the day it was signed, plus a version string. Editing the
// wording here never rewrites an agreement somebody already signed.
//
// The counterparty details live in lib/trial-agreement.ts (COMPANY) so both
// documents can never drift apart on who the merchant is contracting with.
import { COMPANY } from "./trial-agreement";

export const PURCHASE_TERMS_VERSION = "purchase-v1-2026-08";

export type PurchaseLine = {
  name: string;
  qty: number;
  unitCents: number;
  billing: "one_time" | "monthly";
  serial?: string | null;
};

export type PurchaseTermsInput = {
  businessName: string;
  businessAddress?: string | null;
  lines: PurchaseLine[];
  repName: string;
  signedOn: string; // YYYY-MM-DD
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function buildPurchaseTerms(t: PurchaseTermsInput): string {
  const address = t.businessAddress?.trim() || "";

  const oneTime = t.lines.filter((l) => l.billing === "one_time");
  const monthly = t.lines.filter((l) => l.billing === "monthly");

  const oneTimeTotal = oneTime.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const monthlyTotal = monthly.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const yearOne = oneTimeTotal + monthlyTotal * 12;

  const list = t.lines
    .map(
      (l) =>
        `  - ${l.qty} x ${l.name} at ${usd(l.unitCents)}${
          l.billing === "monthly" ? " per month" : " one time"
        }${l.serial ? ` (serial ${l.serial})` : ""}`,
    )
    .join("\n");

  return `PURCHASE AGREEMENT

Between ${COMPANY.name} ("${COMPANY.name}") and ${t.businessName}${address ? `, ${address}` : ""} ("the Merchant"), dated ${t.signedOn}.
Sold by ${t.repName}.

1. WHAT THE MERCHANT IS BUYING
${list}

Paid today: ${usd(oneTimeTotal)}. Membership: ${usd(monthlyTotal)} per month, paid up front for the year. First twelve months, all in: ${usd(yearOne)}.

2. NO PERCENTAGE OF SALES
${COMPANY.name} takes no percentage of any sale, ever. The membership price above is the whole cost of the service.

3. THE MERCHANT'S MONEY
Payments settle directly to a cryptocurrency wallet the Merchant owns and controls. ${COMPANY.name} does not hold, custody, or have access to those funds at any point. Cryptocurrency payments are final and cannot be reversed or charged back.

4. WHAT THE TERMINAL INCLUDES
The terminal ships with its built-in receipt printer and handheld. The Merchant supplies the internet connection and the thermal receipt paper.

5. OWNERSHIP AND WARRANTY
The terminal belongs to the Merchant once paid for. It carries a one-year warranty from the date of this agreement: if it stops working on its own, ${COMPANY.name} replaces it at no cost. The warranty does not cover damage the Merchant causes.

6. THE MEMBERSHIP
The membership is what powers the terminal hardware and is billed a year at a time. If the membership lapses, the terminal stops processing. The Merchant may move to a higher support tier at any time.

7. CANCELLING
The Merchant may stop the membership at the end of any paid year by telling ${COMPANY.name} before it renews. The terminal is the Merchant's to keep. Payments already settled to the Merchant's wallet are unaffected.

8. NO ADVICE
${COMPANY.name} does not provide tax, legal, or investment advice. The value of cryptocurrency can change. The Merchant decides what to hold and what to convert.

9. EXISTING CARD PROCESSING
This purchase does not change or replace the Merchant's current card processing. Cards keep working exactly as they do today.

10. SIGNING ELECTRONICALLY
By signing below the Merchant agrees to sign this agreement electronically, agrees that the electronic signature has the same effect as a handwritten one, and agrees to receive a copy by email. A copy remains available at the link in that email.`;
}
