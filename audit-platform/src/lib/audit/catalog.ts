/**
 * The firm's working-paper index (from AA2 "Index - Current Audit File") extended
 * with the additional sections recommended in docs/AUDIT_METHODOLOGY.md.
 */

export type FsGroup =
  | "Non-current assets"
  | "Current assets"
  | "Equity"
  | "Non-current liabilities"
  | "Current liabilities"
  | "Revenue"
  | "Cost of sales"
  | "Other income"
  | "Operating expenses"
  | "Finance costs"
  | "Taxation";

export const BS_GROUPS: FsGroup[] = [
  "Non-current assets",
  "Current assets",
  "Equity",
  "Non-current liabilities",
  "Current liabilities",
];
export const PL_GROUPS: FsGroup[] = [
  "Revenue",
  "Cost of sales",
  "Other income",
  "Operating expenses",
  "Finance costs",
  "Taxation",
];
export const ALL_GROUPS: FsGroup[] = [...BS_GROUPS, ...PL_GROUPS];

/** Normal balance of each group: +1 debit, -1 credit. */
export const GROUP_NORMAL_SIGN: Record<FsGroup, 1 | -1> = {
  "Non-current assets": 1,
  "Current assets": 1,
  Equity: -1,
  "Non-current liabilities": -1,
  "Current liabilities": -1,
  Revenue: -1,
  "Cost of sales": 1,
  "Other income": -1,
  "Operating expenses": 1,
  "Finance costs": 1,
  Taxation: 1,
};

export function statementOf(group: FsGroup): "BS" | "PL" {
  return BS_GROUPS.includes(group) ? "BS" : "PL";
}

export interface IndexEntry {
  ref: string;
  title: string;
  section: "Planning" | "Completion" | "Financial statements" | "Balance sheet" | "Income statement";
  /** true = in the firm's existing AA2 index; false = added improvement */
  firm: boolean;
}

export const WP_INDEX: IndexEntry[] = [
  { ref: "AA", title: "Audit planning", section: "Planning", firm: true },
  { ref: "AB", title: "Planning materiality", section: "Planning", firm: true },
  { ref: "AC", title: "Risk assessment and response (ISA 315 / ISA 330)", section: "Planning", firm: false },
  { ref: "AD", title: "Budget", section: "Planning", firm: true },
  { ref: "BA", title: "Audit summary and completion", section: "Completion", firm: true },
  { ref: "BB", title: "Summary of audit differences", section: "Completion", firm: false },
  { ref: "BC", title: "Management representation letter", section: "Completion", firm: true },
  { ref: "BD", title: "Going concern and subsequent events", section: "Completion", firm: false },
  { ref: "DA", title: "Financial statements", section: "Financial statements", firm: true },
  { ref: "DA3", title: "Test of opening balances", section: "Financial statements", firm: true },
  { ref: "DB", title: "Client management account (working BS and P&L)", section: "Financial statements", firm: true },
  { ref: "DC", title: "Adjusting journal entries", section: "Financial statements", firm: true },
  { ref: "DD", title: "Extended trial balance", section: "Financial statements", firm: false },
  { ref: "DE", title: "Analytical review", section: "Financial statements", firm: false },
  { ref: "A", title: "Property, plant and equipment", section: "Balance sheet", firm: true },
  { ref: "A1", title: "Investment property", section: "Balance sheet", firm: true },
  { ref: "B", title: "Intangible assets", section: "Balance sheet", firm: false },
  { ref: "C", title: "Inventories", section: "Balance sheet", firm: false },
  { ref: "D", title: "Trade receivables", section: "Balance sheet", firm: false },
  { ref: "E", title: "Other receivables, deposits and prepayments", section: "Balance sheet", firm: false },
  { ref: "F", title: "Cash and bank balances", section: "Balance sheet", firm: true },
  { ref: "G", title: "Other investments", section: "Balance sheet", firm: false },
  { ref: "H", title: "Equity", section: "Balance sheet", firm: true },
  { ref: "I", title: "Borrowings", section: "Balance sheet", firm: false },
  { ref: "J", title: "Trade payables", section: "Balance sheet", firm: false },
  { ref: "K", title: "Other payables and accrued expenses", section: "Balance sheet", firm: true },
  { ref: "L", title: "Amounts due to/from related parties", section: "Balance sheet", firm: false },
  { ref: "M", title: "Taxation", section: "Balance sheet", firm: true },
  { ref: "N", title: "Deferred taxation", section: "Balance sheet", firm: false },
  { ref: "O", title: "Revenue", section: "Income statement", firm: true },
  { ref: "P", title: "Cost of sales", section: "Income statement", firm: false },
  { ref: "Q", title: "Operating expenses", section: "Income statement", firm: true },
  { ref: "R", title: "Other income", section: "Income statement", firm: false },
  { ref: "S", title: "Finance costs", section: "Income statement", firm: false },
];

/** Lead-schedule references an account may be mapped to. */
export const LEAD_REFS = WP_INDEX.filter((e) => e.section === "Balance sheet" || e.section === "Income statement").map(
  (e) => e.ref,
);

export function indexTitle(ref: string): string {
  return WP_INDEX.find((e) => e.ref === ref)?.title ?? ref;
}

/** Firm tickmark legend, carried through every lead schedule. */
export const TICKMARKS: { mark: string; meaning: string }[] = [
  { mark: "f", meaning: "Casting checked." },
  { mark: "b", meaning: "Checked and agreed to client's trial balance and general ledger." },
  { mark: "#", meaning: "Checked and agreed to prior year audited report." },
  { mark: "^", meaning: "Calculation checked." },
  { mark: "C", meaning: "Confirmation sent / received." },
  { mark: "P", meaning: "Being provision figure." },
  { mark: "TA", meaning: "Agreed to tenancy agreement." },
  { mark: "PV", meaning: "Sighted to payment voucher." },
  { mark: "INV", meaning: "Sighted to invoice." },
  { mark: "Bill", meaning: "Sighted to bill." },
  { mark: "b/f", meaning: "Being balance brought forward." },
  { mark: "A", meaning: "Agreed to company depreciation policy." },
];

export const DOCUMENT_KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: "cy_bs", label: "Balance sheet (current year, per client)", hint: "Client-prepared balance sheet, PDF or Excel" },
  { kind: "cy_pl", label: "Profit and loss (current year, per client)", hint: "Client-prepared trading and P&L account" },
  { kind: "cy_tb", label: "Trial balance (current year)", hint: "Optional if BS and P&L are provided" },
  { kind: "cy_gl", label: "General ledger (current year)", hint: "Optional, used for vouching and cut-off" },
  { kind: "py_fs", label: "Prior-year audited financial statements", hint: "Used for opening balances and comparatives" },
  { kind: "py_awp", label: "Prior-year audit working papers", hint: "Last year's AWP workbook, rolled forward" },
  { kind: "py_planning", label: "Prior-year planning memo", hint: "Word or PDF" },
  { kind: "supporting", label: "Supporting evidence", hint: "Bank statements, confirmations, tenancy agreements, invoices, tax forms" },
];

export function documentKindLabel(kind: string): string {
  return DOCUMENT_KINDS.find((d) => d.kind === kind)?.label ?? kind;
}
