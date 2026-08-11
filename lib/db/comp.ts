// NectarPay rep compensation.
//
// Base salary plus a WEEKLY bonus ladder that resets every week. The ladder is
// MARGINAL, like tax brackets: each sale pays the rate of the bracket it lands
// in, and reaching a higher bracket never repays earlier sales at the new rate.
// That is what "the bonuses are not retroactive" means.
//
//   sales 1-5    $0 each
//   sales 6-10   $100 each
//   sales 11-15  $150 each
//   sales 16-20  $200 each
//   sales 21+    $250 each
//
// So 12 sales in a week = (5 x $0) + (5 x $100) + (2 x $150) = $800.

export type CompTier = {
  /** First sale number in this bracket, 1-based. */
  fromSale: number;
  bonusCents: number;
};

export const DEFAULT_BASE_WEEKLY_CENTS = 135000; // $1,350

export const DEFAULT_TIERS: CompTier[] = [
  { fromSale: 1, bonusCents: 0 },
  { fromSale: 6, bonusCents: 10000 },
  { fromSale: 11, bonusCents: 15000 },
  { fromSale: 16, bonusCents: 20000 },
  { fromSale: 21, bonusCents: 25000 },
];

/** The rate a single sale earns, given its position in the week. */
export function rateForSale(saleNumber: number, tiers: CompTier[] = DEFAULT_TIERS): number {
  let rate = 0;
  for (const t of [...tiers].sort((a, b) => a.fromSale - b.fromSale)) {
    if (saleNumber >= t.fromSale) rate = t.bonusCents;
  }
  return rate;
}

/** Total bonus for a week with this many sales. */
export function weeklyBonusCents(sales: number, tiers: CompTier[] = DEFAULT_TIERS): number {
  let total = 0;
  for (let n = 1; n <= sales; n++) total += rateForSale(n, tiers);
  return total;
}

/**
 * What the next sale is worth, and how far the bracket after that is. This is
 * the number that actually changes behaviour on a Thursday afternoon.
 */
export function nextSaleOutlook(
  sales: number,
  tiers: CompTier[] = DEFAULT_TIERS,
): { nextSaleCents: number; salesToNextTier: number | null; nextTierCents: number | null } {
  const nextSaleCents = rateForSale(sales + 1, tiers);

  const sorted = [...tiers].sort((a, b) => a.fromSale - b.fromSale);
  const upcoming = sorted.find((t) => t.fromSale > sales + 1);

  return {
    nextSaleCents,
    salesToNextTier: upcoming ? upcoming.fromSale - (sales + 1) : null,
    nextTierCents: upcoming ? upcoming.bonusCents : null,
  };
}

/** Every bracket with what it pays and how much of it this week has reached. */
export function ladderProgress(sales: number, tiers: CompTier[] = DEFAULT_TIERS) {
  const sorted = [...tiers].sort((a, b) => a.fromSale - b.fromSale);
  return sorted.map((t, i) => {
    const next = sorted[i + 1];
    const upper = next ? next.fromSale - 1 : null;
    const width = upper ? upper - t.fromSale + 1 : Math.max(1, sales - t.fromSale + 1);
    const filled = Math.max(0, Math.min(width, sales - t.fromSale + 1));
    return {
      label: upper ? `${t.fromSale}-${upper}` : `${t.fromSale}+`,
      bonusCents: t.bonusCents,
      filled,
      width,
      reached: sales >= t.fromSale,
    };
  });
}
