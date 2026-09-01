// NectarPay pricing, in one place, matching the published /price page.
//
// The terminal is a one-time hardware purchase and includes the receipt
// printer and the rugged handheld. The membership is the SERVICE, one per
// merchant - it is not a per-device charge.
//
// A correction worth remembering: an earlier pass modelled the monthly as a
// per-scanner subscription at $19.99. It is not. It is one membership per
// merchant, billed a year at a time.
//
// PRICE CHANGE: the membership moved from $19 to $24.99. Everything below
// derives from MEMBERSHIP_MONTHLY, so nothing else needs editing when it
// moves again - and nothing anywhere should hardcode a price. Use
// MONTHLY_LABEL, YEAR_ONE_LABEL and ONGOING_LABEL for display, because the
// monthly is no longer a whole number and toLocaleString() on 24.99 is wrong
// in half the places it would land.

export const TERMINAL_ONCE = 499;
export const MEMBERSHIP_MONTHLY = 24.99;
export const WHITE_GLOVE_MONTHLY = 99;

/** Standard membership is paid up front for the year. */
export const MEMBERSHIP_YEAR = MEMBERSHIP_MONTHLY * 12; // 299.88

export function yearOne(monthly: number = MEMBERSHIP_MONTHLY): number {
  return TERMINAL_ONCE + monthly * 12;
}

export function ongoingYear(monthly: number = MEMBERSHIP_MONTHLY): number {
  return monthly * 12;
}

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export const YEAR_ONE_ROUNDED = Math.round(yearOne());      // 799
export const ONGOING_ROUNDED = Math.round(ongoingYear());   // 300

/**
 * Display strings. The monthly carries cents, the annual figures do not, so
 * these exist to stop $24.99 rendering as "$25" on a leave-behind and to stop
 * $799 rendering as "$798.88" on a signed agreement.
 */
export const MONTHLY_LABEL = `$${MEMBERSHIP_MONTHLY.toFixed(2)}`;         // $24.99
export const TERMINAL_LABEL = usd(TERMINAL_ONCE);                        // $499
export const YEAR_ONE_LABEL = usd(YEAR_ONE_ROUNDED);                     // $799
export const ONGOING_LABEL = usd(ONGOING_ROUNDED);                       // $300

/** The line a rep says out loud. */
export const PRICE_LINE =
  `${TERMINAL_LABEL} once for the terminal, then ${MONTHLY_LABEL} a month for the membership, paid up front for the year`;

/** The compact version for footers and chips. */
export const PRICE_SHORT = `${TERMINAL_LABEL} terminal · ${MONTHLY_LABEL}/mo membership · zero processing fee`;

/**
 * BREAK-EVEN, which is the number to say out loud instead of a savings figure.
 *
 * The napkin math on the one-pager compares a shop's whole card volume against
 * the cost of the terminal, which quietly assumes every dollar moves to
 * crypto. It will not, and an owner spots that in about four seconds - at
 * which point the rest of the sheet is suspect too.
 *
 * Break-even survives the objection because it asks for far less: how much
 * crypto volume before this pays for itself. Year one is the harder number and
 * every year after is the one that closes.
 */
export const CARD_FEE_PCT = 0.03;

const monthlyBreakEven = (annualCost: number) =>
  Math.round(annualCost / CARD_FEE_PCT / 12 / 10) * 10;

export const BREAK_EVEN_YEAR_ONE_MONTHLY = monthlyBreakEven(YEAR_ONE_ROUNDED); // ~2,220
export const BREAK_EVEN_ONGOING_MONTHLY = monthlyBreakEven(ONGOING_ROUNDED);   // ~830

export const BREAK_EVEN_LINE =
  `About $${BREAK_EVEN_YEAR_ONE_MONTHLY.toLocaleString()}/month in crypto sales pays for year one. ` +
  `After that it is about $${BREAK_EVEN_ONGOING_MONTHLY.toLocaleString()}/month.`;

/**
 * Facts a rep will get asked about and should not improvise.
 *
 * THE FREE SOFTWARE TIER IS NOT IN HERE, ON PURPOSE. It exists, and a rep who
 * is asked outright can say so - it does not drive the terminal. But it is
 * never volunteered, and it must never be printed: a leave-behind sits on the
 * owner's desk after the rep has gone, with nobody there to reframe it, and it
 * argues them out of the hardware the whole pitch is about. The trial is the
 * answer to hesitation.
 *
 * It used to live here as an exported string and drifted onto the one-pager
 * anyway. A constant nobody renders is just an invitation, so there isn't one.
 */
export const WHITE_GLOVE_LINE =
  `Want us picking up the phone? White-glove support is $${WHITE_GLOVE_MONTHLY} a month.`;
