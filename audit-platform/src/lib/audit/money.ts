/**
 * All arithmetic is done in integer sen (cents) to avoid floating-point drift.
 * Sign convention for ledger amounts: Debit = positive, Credit = negative.
 */

export type Cents = number;

export function toCents(value: number | string | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (!Number.isFinite(n)) throw new Error(`Not a valid amount: ${String(value)}`);
  return Math.round(n * 100);
}

export function fromCents(cents: Cents): number {
  return Math.round(cents) / 100;
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

/** Accounting format: 1,234.56 / (1,234.56) / "-" for nil. */
export function formatRM(cents: Cents | null | undefined, opts: { dashForZero?: boolean } = {}): string {
  if (cents === null || cents === undefined) return "";
  const { dashForZero = true } = opts;
  if (cents === 0 && dashForZero) return "-";
  const abs = Math.abs(cents) / 100;
  const s = abs.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `(${s})` : s;
}

/** Whole-ringgit display used in planning documents. */
export function formatRM0(cents: Cents): string {
  const abs = Math.round(Math.abs(cents) / 100);
  const s = abs.toLocaleString("en-MY");
  return cents < 0 ? `(${s})` : s;
}

export function pct(numerator: Cents, denominator: Cents): number | null {
  if (denominator === 0) return null;
  return numerator / Math.abs(denominator);
}

/** Tolerance for "agrees" checks: exactly equal to the sen. */
export const AGREES = (a: Cents, b: Cents) => Math.abs(a - b) <= 0;
