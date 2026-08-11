// NectarPay pricing, in one place, matching the published /price page.
//
// The terminal is a one-time hardware purchase and includes the receipt
// printer and the rugged handheld. The membership is the SERVICE, one per
// merchant - it is not a per-device charge.
//
// A correction worth remembering: an earlier pass modelled the monthly as a
// per-scanner subscription at $19.99. It is not. It is $19/month, billed a
// year at a time.

export const TERMINAL_ONCE = 499;
export const MEMBERSHIP_MONTHLY = 19;
export const WHITE_GLOVE_MONTHLY = 99;

/** Standard membership is paid up front for the year. */
export const MEMBERSHIP_YEAR = MEMBERSHIP_MONTHLY * 12; // 228

export function yearOne(monthly: number = MEMBERSHIP_MONTHLY): number {
  return TERMINAL_ONCE + monthly * 12;
}

export function ongoingYear(monthly: number = MEMBERSHIP_MONTHLY): number {
  return monthly * 12;
}

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export const YEAR_ONE_ROUNDED = yearOne();      // 727
export const ONGOING_ROUNDED = ongoingYear();   // 228

/** The line a rep says out loud. */
export const PRICE_LINE =
  "$499 once for the terminal, then $19 a month for the membership, paid up front for the year";

/** The compact version for footers and chips. */
export const PRICE_SHORT = "$499 terminal · $19/mo membership · zero processing fee";

/**
 * The two facts a rep will get asked about and should not improvise:
 * there is a higher support tier, and there is a free tier that cannot
 * drive the terminal.
 */
export const WHITE_GLOVE_LINE =
  "Want us picking up the phone? White-glove support is $99 a month.";
export const FREE_TIER_LINE =
  "There is a free software-only tier, but it does not run the terminal hardware.";
