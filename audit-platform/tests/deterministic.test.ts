import assert from "node:assert/strict";
import { checkStatement, crossCheck, buildTrialBalance, describeFailures } from "../src/lib/audit/extraction";
import { firmMateriality, isaMateriality, suggestProfile } from "../src/lib/audit/materiality";
import { buildEtb, type TbLineInput } from "../src/lib/audit/etb";
import { taxOnChargeableIncome } from "../src/lib/audit/tax";
import { formatRM, toCents } from "../src/lib/audit/money";
import { sampleBS, samplePL } from "./fixtures/sample-client";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

t("balance sheet arithmetic re-performs to the sen", () => {
  const r = checkStatement(sampleBS);
  assert.deepEqual(describeFailures(r), []);
  assert.ok(r.length >= 8);
});
t("P&L arithmetic and retained-profit roll", () => {
  const r = checkStatement(samplePL);
  assert.deepEqual(describeFailures(r), []);
});
t("retained profit c/f ties P&L to balance sheet", () => {
  assert.ok(crossCheck(sampleBS, samplePL).every((c) => c.passed));
});
t("a mistranscribed figure is caught", () => {
  const bad = structuredClone(sampleBS);
  bad.lines.find((l) => l.label === "CASH IN HAND")!.cy = 1836.65; // transposed digits
  const f = describeFailures(checkStatement(bad));
  assert.ok(f.length >= 2, f.join("\n"));
});
t("trial balance built from BS + P&L nets to zero", () => {
  const tb = buildTrialBalance([sampleBS, samplePL]);
  assert.equal(tb.balance, 0);
  assert.equal(tb.balancePy, 0);
  const tax = tb.lines.find((l) => l.account_name === "PROVISION FOR TAXATION")!;
  assert.equal(tax.cy, toCents(25280.61)); // negative liability = debit (tax recoverable)
  assert.ok(!tb.lines.some((l) => l.account_name === "RETAINED EARNING"));
  assert.equal(tb.lines.find((l) => l.account_name.startsWith("RETAINED PROFIT"))!.cy, -toCents(2197693.74));
});
t("firm AB2 materiality reproduced (draft)", () => {
  const m = firmMateriality({ turnover: toCents(200880), pbt: toCents(146862.75), grossAssets: toCents(2685679.29) });
  assert.equal(m.basis[0].rate, 0.03);
  assert.equal(m.basis[2].rate, 0.015);
  assert.equal(m.basis[0].result, toCents(6026.4));
  assert.equal(m.basis[1].result, toCents(14686.28));
  assert.equal(m.basis[2].result, toCents(40285.19));
  assert.equal(m.materiality, toCents(40300));
  assert.equal(m.performance, toCents(36270));
  assert.equal(m.sad, toCents(2015));
});
t("ISA 320 view picks total assets for a property-letting company", () => {
  const i = { turnover: toCents(200880), pbt: toCents(146862.75), grossAssets: toCents(2685679.29) };
  const p = suggestProfile(i, "Property letting");
  assert.equal(p, "asset_holding");
  const m = isaMateriality(i, p, "low");
  assert.equal(m.materiality, toCents(26800));
  assert.equal(m.performance, toCents(20100));
});
t("ETB posts accepted AJEs only and stays balanced", () => {
  const tb = buildTrialBalance([sampleBS, samplePL]);
  const cap: Record<string, [string, TbLineInput["fs_group"], string]> = {
    "INVESTMENT PROPERTY": ["Investment property", "Non-current assets", "A1"],
    "EXTENSION OF LAND LEASE": ["Investment property", "Non-current assets", "A1"],
    "BANK A/C": ["Cash and bank balances", "Current assets", "F"],
    "CASH IN HAND": ["Cash and bank balances", "Current assets", "F"],
    ACCRUALS: ["Accruals", "Current liabilities", "K"],
    "PROVISION FOR TAXATION": ["Tax recoverable", "Current assets", "M"],
    "DIRECTOR'S ACCOUNT - DIRECTOR A": ["Amount due to directors", "Current liabilities", "K"],
    "DIRECTOR'S ACCOUNT - DIRECTOR B": ["Amount due to directors", "Current liabilities", "K"],
    "TENANCY DEPOSIT": ["Deposits received", "Current liabilities", "K"],
    "UTILITY DEPOSIT": ["Deposits received", "Current liabilities", "K"],
    CAPITAL: ["Share capital", "Equity", "H"],
    "RETAINED PROFIT/(LOSS) B/F": ["Retained earnings", "Equity", "H"],
    "RENTAL INCOME": ["Rental income", "Revenue", "O"],
  };
  const lines: TbLineInput[] = tb.lines.map((l, i) => {
    const c = cap[l.account_name] ?? [l.account_name, "Operating expenses", "Q"];
    return { id: String(i), line_no: i, account_name: l.account_name, cy: l.cy, py_client: l.py, fs_caption: c[0], fs_group: c[1], wp_ref: c[2] };
  });
  const etb = buildEtb(
    lines,
    [
      { ref: "AJE 1", kind: "AJE", description: "Audit fee accrual", status: "accepted", lines: [
        { account: "Audit fee", fs_caption: "Auditors' remuneration", fs_group: "Operating expenses", wp_ref: "Q", dr: toCents(1400), cr: 0 },
        { account: "Accruals", fs_caption: "Accruals", fs_group: "Current liabilities", wp_ref: "K", dr: 0, cr: toCents(1400) },
      ] },
      { ref: "AJE 2", kind: "AJE", description: "Depreciation", status: "accepted", lines: [
        { account: "Depreciation", fs_caption: "Depreciation of investment property", fs_group: "Operating expenses", wp_ref: "A1", dr: toCents(44639.57), cr: 0 },
        { account: "Accumulated depreciation", fs_caption: "Investment property", fs_group: "Non-current assets", wp_ref: "A1", dr: 0, cr: toCents(44639.57) },
      ] },
      { ref: "AJE 9", kind: "AJE", description: "Rejected one", status: "rejected", lines: [
        { account: "x", fs_caption: "Accruals", fs_group: "Current liabilities", wp_ref: "K", dr: 100, cr: 0 },
        { account: "y", fs_caption: "Rental income", fs_group: "Revenue", wp_ref: "O", dr: 0, cr: 100 },
      ] },
    ],
    [],
    { sad: toCents(2015), pm: toCents(36270) },
  );
  assert.ok(etb.balanced);
  assert.ok(etb.adjustmentsBalanced);
  assert.equal(etb.totals.adj_dr, toCents(46039.57));
  assert.equal(etb.totals.revenue_audited, toCents(200880));
  assert.equal(etb.totals.pbt_client, toCents(146862.75));
  assert.equal(etb.totals.pbt_audited, toCents(146862.75 - 1400 - 44639.57));
  const ip = etb.rows.find((r) => r.fs_caption === "Investment property")!;
  assert.equal(ip.cy_audited, toCents(2678374 - 44639.57));
  assert.equal(formatRM(ip.cy_audited), "2,633,734.43");
});
t("SME tax scale", () => {
  const r = taxOnChargeableIncome(toCents(200000), "sme");
  assert.equal(r.tax, toCents(150000 * 0.15 + 50000 * 0.17));
});

console.log(`\n${passed} deterministic checks passed`);
