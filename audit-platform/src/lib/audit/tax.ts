import { type Cents } from "./money";

/**
 * Malaysian corporate income tax scale. Rates live in data so the firm can update
 * them when the Finance Act changes; every computation is flagged for reviewer sign-off.
 * SME scale: first RM150,000 at 15%, next RM450,000 at 17%, remainder at 24%
 * (for resident companies with paid-up capital <= RM2.5m, gross business income <= RM50m,
 * and, from YA 2024, not more than 20% held by foreign companies or non-Malaysian citizens).
 * Standard rate: 24%.
 */
export const TAX_SCALES = {
  sme: [
    { band: 150_000_00, rate: 0.15 },
    { band: 450_000_00, rate: 0.17 },
    { band: null, rate: 0.24 },
  ],
  standard: [{ band: null, rate: 0.24 }],
} as const;

export type RateBasis = keyof typeof TAX_SCALES;

export function taxOnChargeableIncome(ci: Cents, basis: RateBasis): { tax: Cents; bands: { amount: Cents; rate: number; tax: Cents }[] } {
  let remaining = Math.max(0, ci);
  const bands: { amount: Cents; rate: number; tax: Cents }[] = [];
  for (const b of TAX_SCALES[basis]) {
    if (remaining <= 0) break;
    const amt = b.band === null ? remaining : Math.min(remaining, b.band);
    const tax = Math.round(amt * b.rate);
    bands.push({ amount: amt, rate: b.rate, tax });
    remaining -= amt;
  }
  return { tax: bands.reduce((a, x) => a + x.tax, 0), bands };
}
