import { type Cents } from "./money";

/**
 * Two views of planning materiality:
 *  1. FIRM method, reproducing AB2 "Planning materiality" exactly:
 *     turnover x band %, profit before tax x 10%, gross assets x band %,
 *     take the highest, round UP to the nearest RM100; performance materiality = 90%;
 *     SAD (clearly trivial) threshold = 5%.
 *  2. ISA 320 benchmark view (Big 4 practice): one benchmark chosen for the entity's
 *     profile, a documented percentage, performance materiality 50-75% by risk.
 */

export const FIRM_BANDS: { upTo: number | null; rate: number; label: string }[] = [
  { upTo: 500_000, rate: 0.03, label: "0 - 500,000" },
  { upTo: 1_000_000, rate: 0.025, label: "500,001 - 1,000,000" },
  { upTo: 2_000_000, rate: 0.02, label: "1,000,001 - 2,000,000" },
  { upTo: 5_000_000, rate: 0.015, label: "2,000,001 - 5,000,000" },
  { upTo: null, rate: 0.01, label: "Over 5,000,000" },
];
export const FIRM_PBT_RATE = 0.1;

export function bandRate(amountCents: Cents): number {
  const rm = Math.abs(amountCents) / 100;
  for (const b of FIRM_BANDS) if (b.upTo === null || rm <= b.upTo) return b.rate;
  return 0.01;
}

export interface MaterialityInputs {
  turnover: Cents;
  pbt: Cents;
  grossAssets: Cents;
}

export interface FirmMateriality {
  method: "firm";
  basis: { name: "Turnover" | "Result before tax" | "Gross assets"; amount: Cents; rate: number; result: Cents | null }[];
  highest: Cents;
  materiality: Cents;
  anticipatedMisstatements: Cents;
  performance: Cents;
  sad: Cents;
}

export function firmMateriality(i: MaterialityInputs): FirmMateriality {
  const basis: FirmMateriality["basis"] = [
    { name: "Turnover", amount: i.turnover, rate: bandRate(i.turnover), result: i.turnover > 0 ? Math.round(i.turnover * bandRate(i.turnover)) : null },
    { name: "Result before tax", amount: i.pbt, rate: FIRM_PBT_RATE, result: i.pbt > 0 ? Math.round(i.pbt * FIRM_PBT_RATE) : null },
    { name: "Gross assets", amount: i.grossAssets, rate: bandRate(i.grossAssets), result: i.grossAssets > 0 ? Math.round(i.grossAssets * bandRate(i.grossAssets)) : null },
  ];
  const highest = Math.max(0, ...basis.map((b) => b.result ?? 0));
  const materiality = Math.ceil(highest / 10_000) * 10_000; // ROUNDUP(x, -2) in ringgit = 10,000 sen
  const anticipated = -Math.round(materiality * 0.1);
  return {
    method: "firm",
    basis,
    highest,
    materiality,
    anticipatedMisstatements: anticipated,
    performance: materiality + anticipated,
    sad: Math.round(materiality * 0.05),
  };
}

export type EntityProfile = "profit_oriented" | "asset_holding" | "loss_or_breakeven";

export interface IsaMateriality {
  method: "isa320";
  profile: EntityProfile;
  benchmark: "Profit before tax" | "Total assets" | "Revenue";
  benchmarkAmount: Cents;
  rate: number;
  materiality: Cents;
  performanceRate: number;
  performance: Cents;
  clearlyTrivial: Cents;
  rationale: string;
}

/**
 * Suggested profile: property-letting and investment-holding entities are judged on
 * their asset base; trading entities with stable profits on PBT; entities at or near
 * break-even on revenue.
 */
export function suggestProfile(i: MaterialityInputs, principalActivity: string | null): EntityProfile {
  const act = (principalActivity ?? "").toLowerCase();
  if (/(investment holding|property (letting|investment|holding)|letting of|rental)/.test(act)) return "asset_holding";
  if (i.pbt <= 0 || (i.turnover > 0 && i.pbt / i.turnover < 0.02)) return "loss_or_breakeven";
  return "profit_oriented";
}

export function isaMateriality(i: MaterialityInputs, profile: EntityProfile, risk: "low" | "moderate" | "high"): IsaMateriality {
  const performanceRate = risk === "low" ? 0.75 : risk === "moderate" ? 0.65 : 0.5;
  let benchmark: IsaMateriality["benchmark"];
  let amount: Cents;
  let rate: number;
  let rationale: string;
  if (profile === "asset_holding") {
    benchmark = "Total assets";
    amount = i.grossAssets;
    rate = 0.01;
    rationale = "Users of an asset-holding entity's financial statements focus on the carrying amount of its assets; 1% of total assets is at the conservative end of the 1-2% range commonly applied.";
  } else if (profile === "profit_oriented") {
    benchmark = "Profit before tax";
    amount = i.pbt;
    rate = 0.05;
    rationale = "Profit is the primary measure for users of a profit-oriented entity; 5% of profit before tax is the commonly applied percentage.";
  } else {
    benchmark = "Revenue";
    amount = i.turnover;
    rate = 0.01;
    rationale = "Profit is volatile or near nil, so revenue is a more stable benchmark; 1% of revenue is at the upper end of the 0.5-1% range.";
  }
  const materiality = Math.floor((Math.max(0, amount) * rate) / 10_000) * 10_000; // round DOWN for prudence
  return {
    method: "isa320",
    profile,
    benchmark,
    benchmarkAmount: amount,
    rate,
    materiality,
    performanceRate,
    performance: Math.floor((materiality * performanceRate) / 100) * 100,
    clearlyTrivial: Math.round(materiality * 0.05),
    rationale,
  };
}

export interface MaterialityRecord {
  draft: FirmMateriality;
  final: FirmMateriality | null;
  isa: IsaMateriality;
  selected: "firm" | "isa320";
  selectedReason: string | null;
  riskLevel: "low" | "moderate" | "high";
}

export function thresholds(m: MaterialityRecord): { materiality: Cents; pm: Cents; sad: Cents } {
  const f = m.final ?? m.draft;
  if (m.selected === "isa320") return { materiality: m.isa.materiality, pm: m.isa.performance, sad: m.isa.clearlyTrivial };
  return { materiality: f.materiality, pm: f.performance, sad: f.sad };
}
