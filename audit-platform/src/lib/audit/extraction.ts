import { z } from "zod";
import { type Cents, toCents, sum, formatRM } from "./money";

/**
 * Shape the AI must return when reading a client statement. Amounts are exactly
 * as printed: bracketed figures are negative, blanks are null. The AI never
 * computes totals; it only transcribes. All arithmetic is re-done here.
 */
export const SECTIONS = [
  "non_current_assets",
  "current_assets",
  "current_liabilities",
  "non_current_liabilities",
  "equity",
  "revenue",
  "cost_of_sales",
  "other_income",
  "expenses",
  "finance_costs",
  "taxation",
  "retained_earnings",
  "trial_balance",
] as const;
export type Section = (typeof SECTIONS)[number];

export const LINE_KEYS = [
  "none",
  "section_total",
  "net_current_assets",
  "net_assets",
  "total_equity",
  "gross_profit",
  "total_expenses",
  "profit_before_tax",
  "net_profit",
  "re_bf",
  "re_cf",
  "dividend",
  "tb_total",
] as const;

export const ExtractedLine = z.object({
  page: z.number(),
  label: z.string(),
  section: z.enum(SECTIONS),
  role: z.enum(["account", "subtotal", "heading"]),
  key: z.enum(LINE_KEYS),
  cy: z.number().nullable(),
  py: z.number().nullable(),
});
export type ExtractedLine = z.infer<typeof ExtractedLine>;

export const StatementExtraction = z.object({
  entity_name: z.string(),
  registration_no: z.string().nullable(),
  period_end: z.string().nullable(),
  statement_type: z.enum(["balance_sheet", "profit_and_loss", "trial_balance"]),
  currency: z.string(),
  current_column_label: z.string(),
  prior_column_label: z.string().nullable(),
  lines: z.array(ExtractedLine),
  signatory_block_present: z.boolean(),
  transcription_notes: z.array(z.string()),
});
export type StatementExtraction = z.infer<typeof StatementExtraction>;

export interface CheckResult {
  id: string;
  label: string;
  column: "cy" | "py";
  expected: Cents;
  actual: Cents;
  passed: boolean;
}

const ASSET_SECTIONS: Section[] = ["non_current_assets", "current_assets"];
const LIAB_SECTIONS: Section[] = ["current_liabilities", "non_current_liabilities"];

function accounts(lines: ExtractedLine[], section: Section) {
  return lines.filter((l) => l.role === "account" && l.section === section);
}
function col(l: ExtractedLine, c: "cy" | "py"): Cents {
  return toCents(l[c]);
}
function hasColumn(lines: ExtractedLine[], c: "cy" | "py") {
  return lines.some((l) => l[c] !== null);
}

/** Recompute every printed total from its components and compare to the sen. */
export function checkStatement(ex: StatementExtraction): CheckResult[] {
  const out: CheckResult[] = [];
  const cols: ("cy" | "py")[] = hasColumn(ex.lines, "py") ? ["cy", "py"] : ["cy"];
  const push = (id: string, label: string, column: "cy" | "py", expected: Cents, actual: Cents) =>
    out.push({ id: `${id}:${column}`, label, column, expected, actual, passed: expected === actual });

  for (const c of cols) {
    // 1. Section subtotals agree to their components
    for (const st of ex.lines.filter((l) => l.role === "subtotal" && l.key === "section_total")) {
      if (st[c] === null) continue;
      const comp = sum(accounts(ex.lines, st.section).map((l) => col(l, c)));
      push(`section:${st.section}:${st.label}`, `${st.label} agrees to sum of ${st.section.replace(/_/g, " ")} lines`, c, col(st, c), comp);
    }

    if (ex.statement_type === "balance_sheet") {
      const assets = sum(ASSET_SECTIONS.flatMap((s) => accounts(ex.lines, s)).map((l) => col(l, c)));
      const liabs = sum(LIAB_SECTIONS.flatMap((s) => accounts(ex.lines, s)).map((l) => col(l, c)));
      const equity = sum(accounts(ex.lines, "equity").map((l) => col(l, c)));
      push("bs:balances", "Total assets less total liabilities equals equity", c, equity, assets - liabs);

      const nca = ex.lines.find((l) => l.key === "net_current_assets");
      if (nca && nca[c] !== null) {
        const ca = sum(accounts(ex.lines, "current_assets").map((l) => col(l, c)));
        const cl = sum(accounts(ex.lines, "current_liabilities").map((l) => col(l, c)));
        push("bs:nca", "Net current assets = current assets - current liabilities", c, col(nca, c), ca - cl);
      }
      for (const na of ex.lines.filter((l) => l.key === "net_assets")) {
        if (na[c] === null) continue;
        push(`bs:net_assets:${na.label}`, `${na.label} = total assets - total liabilities`, c, col(na, c), assets - liabs);
      }
      const te = ex.lines.find((l) => l.key === "total_equity" && l.role === "subtotal");
      if (te && te[c] !== null) push("bs:total_equity", "Total equity agrees to equity lines", c, col(te, c), equity);
    }

    if (ex.statement_type === "profit_and_loss") {
      const rev = sum(accounts(ex.lines, "revenue").map((l) => col(l, c)));
      const cos = sum(accounts(ex.lines, "cost_of_sales").map((l) => col(l, c)));
      const oi = sum(accounts(ex.lines, "other_income").map((l) => col(l, c)));
      const exp = sum(accounts(ex.lines, "expenses").map((l) => col(l, c)));
      const fin = sum(accounts(ex.lines, "finance_costs").map((l) => col(l, c)));
      const tax = sum(accounts(ex.lines, "taxation").map((l) => col(l, c)));
      const gp = ex.lines.find((l) => l.key === "gross_profit");
      if (gp && gp[c] !== null) push("pl:gp", "Gross profit = revenue - cost of sales", c, col(gp, c), rev - cos);
      const te = ex.lines.find((l) => l.key === "total_expenses");
      if (te && te[c] !== null) push("pl:total_expenses", "Total expenses agrees to expense lines", c, col(te, c), exp);
      const pbt = ex.lines.find((l) => l.key === "profit_before_tax");
      if (pbt && pbt[c] !== null) push("pl:pbt", "Profit before tax = income - expenses", c, col(pbt, c), rev - cos + oi - exp - fin);
      const np = ex.lines.find((l) => l.key === "net_profit");
      if (np && np[c] !== null) push("pl:np", "Net profit = income - expenses - tax", c, col(np, c), rev - cos + oi - exp - fin - tax);
      const bf = ex.lines.find((l) => l.key === "re_bf");
      const cf = ex.lines.find((l) => l.key === "re_cf");
      if (bf && cf && np && cf[c] !== null) {
        const div = sum(ex.lines.filter((l) => l.key === "dividend").map((l) => Math.abs(col(l, c))));
        push("pl:re_roll", "Retained profit c/f = b/f + net profit - dividends", c, col(cf, c), col(bf, c) + col(np, c) - div);
      }
    }

    if (ex.statement_type === "trial_balance") {
      const lines = ex.lines.filter((l) => l.role === "account");
      push("tb:balances", "Trial balance debits equal credits (net to zero)", c, 0, sum(lines.map((l) => col(l, c))));
    }
  }
  return out;
}

/** Cross-statement tie-outs between BS and P&L. */
export function crossCheck(bs: StatementExtraction, pl: StatementExtraction): CheckResult[] {
  const out: CheckResult[] = [];
  for (const c of ["cy", "py"] as const) {
    const plCf = pl.lines.find((l) => l.key === "re_cf");
    const bsRe = bs.lines.find((l) => l.key === "re_cf" && l.section === "equity");
    if (plCf && bsRe && plCf[c] !== null && bsRe[c] !== null) {
      const e = toCents(plCf[c]);
      const a = toCents(bsRe[c]);
      out.push({ id: `cross:re:${c}`, label: "Retained profit c/f per P&L agrees to balance sheet", column: c, expected: e, actual: a, passed: e === a });
    }
  }
  return out;
}

export function describeFailures(results: CheckResult[]): string[] {
  return results
    .filter((r) => !r.passed)
    .map((r) => `${r.label} [${r.column.toUpperCase()}]: printed ${formatRM(r.expected, { dashForZero: false })}, recomputed ${formatRM(r.actual, { dashForZero: false })}, difference ${formatRM(r.expected - r.actual, { dashForZero: false })}`);
}

/** Ledger sign for a transcribed amount (Dr +, Cr -). */
const SECTION_SIGN: Record<Section, 1 | -1> = {
  non_current_assets: 1,
  current_assets: 1,
  current_liabilities: -1,
  non_current_liabilities: -1,
  equity: -1,
  revenue: -1,
  cost_of_sales: 1,
  other_income: -1,
  expenses: 1,
  finance_costs: 1,
  taxation: 1,
  retained_earnings: -1,
  trial_balance: 1,
};

export interface DraftTbLine {
  account_name: string;
  statement: "BS" | "PL";
  section: Section;
  cy: Cents;
  py: Cents | null;
  source: "balance_sheet" | "profit_and_loss" | "trial_balance";
}

/**
 * Build a balanced trial balance from the client's statements.
 * Balance sheet retained earnings (c/f) is replaced by retained earnings b/f
 * plus the individual P&L accounts, which is how the firm's DB-1 / DB-2 present it.
 */
export function buildTrialBalance(docs: StatementExtraction[]): { lines: DraftTbLine[]; balance: Cents; balancePy: Cents | null } {
  const tb = docs.find((d) => d.statement_type === "trial_balance");
  const lines: DraftTbLine[] = [];
  if (tb) {
    for (const l of tb.lines.filter((x) => x.role === "account")) {
      lines.push({
        account_name: l.label.trim(),
        statement: ["revenue", "cost_of_sales", "other_income", "expenses", "finance_costs", "taxation"].includes(l.section) ? "PL" : "BS",
        section: l.section,
        cy: toCents(l.cy),
        py: l.py === null ? null : toCents(l.py),
        source: "trial_balance",
      });
    }
  } else {
    const bs = docs.find((d) => d.statement_type === "balance_sheet");
    const pl = docs.find((d) => d.statement_type === "profit_and_loss");
    if (!bs || !pl) throw new Error("A balance sheet and a profit and loss account (or a trial balance) are required.");
    for (const l of bs.lines.filter((x) => x.role === "account")) {
      if (l.section === "equity" && l.key === "re_cf") continue; // replaced by b/f + P&L
      lines.push({
        account_name: l.label.trim(),
        statement: "BS",
        section: l.section,
        cy: SECTION_SIGN[l.section] * toCents(l.cy),
        py: l.py === null ? null : SECTION_SIGN[l.section] * toCents(l.py),
        source: "balance_sheet",
      });
    }
    for (const l of pl.lines.filter((x) => x.role === "account")) {
      if (l.section === "retained_earnings") {
        if (l.key === "re_bf") {
          lines.push({ account_name: l.label.trim(), statement: "BS", section: "equity", cy: -toCents(l.cy), py: l.py === null ? null : -toCents(l.py), source: "profit_and_loss" });
        } else if (l.key === "dividend") {
          lines.push({ account_name: l.label.trim(), statement: "BS", section: "equity", cy: Math.abs(toCents(l.cy)), py: l.py === null ? null : Math.abs(toCents(l.py)), source: "profit_and_loss" });
        }
        continue;
      }
      lines.push({
        account_name: l.label.trim(),
        statement: "PL",
        section: l.section,
        cy: SECTION_SIGN[l.section] * toCents(l.cy),
        py: l.py === null ? null : SECTION_SIGN[l.section] * toCents(l.py),
        source: "profit_and_loss",
      });
    }
  }
  const balance = sum(lines.map((l) => l.cy));
  const pyVals = lines.map((l) => l.py);
  const balancePy = pyVals.every((v) => v === null) ? null : sum(pyVals.map((v) => v ?? 0));
  return { lines, balance, balancePy };
}
