// NectarPay pricing, in one place.
//
// The August 2026 correction: the $19.99 is NOT a flat platform fee. It is a
// per-device subscription on the handheld scanner, and a shop can run several.
// The $499 buys the touchscreen terminal that sits by the register, once.
//
// Every quoted total below assumes ONE scanner, which is the common case and
// the one the napkin math is built on. Anything that needs a different count
// should call the helpers rather than hardcode a number.

export const TERMINAL_ONCE = 499;
export const SCANNER_MONTHLY = 19.99;

/** What a shop pays in the first twelve months. */
export function yearOne(scanners = 1): number {
  return TERMINAL_ONCE + SCANNER_MONTHLY * 12 * scanners;
}

/** What it costs every year after the hardware is bought. */
export function ongoingYear(scanners = 1): number {
  return SCANNER_MONTHLY * 12 * scanners;
}

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** ~$739 with one scanner. Rounded, because it is a napkin. */
export const YEAR_ONE_ROUNDED = Math.round(yearOne());
export const ONGOING_ROUNDED = Math.round(ongoingYear());

/** The line a rep says out loud. */
export const PRICE_LINE =
  "$499 once for the touchscreen terminal, then $19.99 a month for each handheld scanner";

/** The compact version for footers and chips. */
export const PRICE_SHORT = "$499 terminal · $19.99/mo per scanner";
