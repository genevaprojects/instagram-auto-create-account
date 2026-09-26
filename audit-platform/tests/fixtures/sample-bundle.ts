import { buildTrialBalance } from "../../src/lib/audit/extraction";
import { fromCents, toCents } from "../../src/lib/audit/money";
import type { FsGroup } from "../../src/lib/audit/catalog";
import { assembleBundle, type RawBundle } from "../../src/lib/pipeline/bundle";
import type { AdjustmentRow, TbLineRow, PyBalanceRow } from "../../src/lib/db-types";
import { sampleBS, samplePL } from "./sample-client";

const MAP: Record<string, [string, FsGroup, string]> = {
  "INVESTMENT PROPERTY": ["Investment property", "Non-current assets", "A1"],
  "EXTENSION OF LAND LEASE": ["Investment property", "Non-current assets", "A1"],
  "BANK A/C": ["Cash and bank balances", "Current assets", "F"],
  "CASH IN HAND": ["Cash and bank balances", "Current assets", "F"],
  "PROVISION FOR TAXATION": ["Tax recoverable", "Current assets", "M"],
  ACCRUALS: ["Accruals", "Current liabilities", "K"],
  "DIRECTOR'S ACCOUNT - DIRECTOR A": ["Amount due to directors", "Current liabilities", "K"],
  "DIRECTOR'S ACCOUNT - DIRECTOR B": ["Amount due to directors", "Current liabilities", "K"],
  "TENANCY DEPOSIT": ["Deposits received", "Current liabilities", "K"],
  "UTILITY DEPOSIT": ["Deposits received", "Current liabilities", "K"],
  CAPITAL: ["Share capital", "Equity", "H"],
  "RETAINED PROFIT/(LOSS) B/F": ["Retained earnings", "Equity", "H"],
  "RENTAL INCOME": ["Rental income", "Revenue", "O"],
  "BANK CHARGES": ["Bank charges", "Operating expenses", "Q"],
  "ADMIN EXPENSES": ["Administrative expenses", "Operating expenses", "Q"],
  "CARE TAKER EXPENSES": ["Caretaker services", "Operating expenses", "Q"],
  "INSURANCE PREMIUM": ["Insurance", "Operating expenses", "Q"],
  "TRAVELLING EXPENSES": ["Travelling expenses", "Operating expenses", "Q"],
  "PRINTING & STATIONERY": ["Printing and stationery", "Operating expenses", "Q"],
  "POSTAGE, COURIER": ["Postage", "Operating expenses", "Q"],
  "PROFESSIONAL FEE": ["Professional fee", "Operating expenses", "Q"],
  "QUIT RENT & ASSESSMENT": ["Quit rent and assessment", "Operating expenses", "Q"],
  "SECRETARIAL FEE": ["Secretarial fee", "Operating expenses", "Q"],
  "TAX PREPARATION": ["Tax preparation fee", "Operating expenses", "Q"],
};

/** Prior-year audited balances (the firm's DB-1 / DB-2 "Last Year" column layout, FYE 2025). */
const PY: [string, FsGroup, string, number][] = [
  ["Investment property", "Non-current assets", "A1", 2500000],
  ["Cash and bank balances", "Current assets", "F", 37665.63],
  ["Tax recoverable", "Current assets", "M", 33.52],
  ["Share capital", "Equity", "H", -250000],
  ["Retained earnings", "Equity", "H", -2197693.74],
  ["Deposits received", "Current liabilities", "K", -45000],
  ["Accruals", "Current liabilities", "K", -1400],
  ["Amount due to directors", "Current liabilities", "K", -43605.41],
  ["Rental income", "Revenue", "O", -194400],
  ["Assessment", "Operating expenses", "Q", 2052],
  ["Administrative expenses", "Operating expenses", "Q", 14400],
  ["Auditors' remuneration", "Operating expenses", "Q", 1400],
  ["Bank charges", "Operating expenses", "Q", 102.75],
  ["Caretaker services", "Operating expenses", "Q", 24000],
  ["Insurance", "Operating expenses", "Q", 1211.9],
  ["Postage", "Operating expenses", "Q", 180],
  ["Printing and stationery", "Operating expenses", "Q", 2419.9],
  ["Quit rent and assessment", "Operating expenses", "Q", 2943],
  ["Repair and maintenance", "Operating expenses", "Q", 6480],
  ["Secretarial fee", "Operating expenses", "Q", 1440],
  ["Tax preparation fee", "Operating expenses", "Q", 1700],
  ["Telephone", "Operating expenses", "Q", 175],
  ["Travelling expenses", "Operating expenses", "Q", 900],
  ["Tax expense", "Taxation", "M", 40538.16],
];

const now = "2026-08-10T02:00:00.000Z";
const adj = (ref: string, description: string, lines: AdjustmentRow["lines"]): AdjustmentRow => ({
  id: ref, engagement_id: "e1", ref, kind: "AJE", description, rationale: null, evidence: null, source: "ai", status: "accepted",
  lines, total: lines.reduce((a, l) => a + l.dr, 0), proposed_by: "u1", decided_by: "u2", decided_at: now, decision_note: null, created_at: now,
});

export function sampleRawBundle(): RawBundle {
  const tb = buildTrialBalance([sampleBS, samplePL]);
  const tbLines: TbLineRow[] = tb.lines.map((l, i) => {
    const m = MAP[l.account_name];
    if (!m) throw new Error(`unmapped ${l.account_name}`);
    return {
      id: `l${i}`, engagement_id: "e1", source_document_id: null, line_no: i + 1, account_name: l.account_name, statement: l.statement, section: l.section,
      cy_amount: fromCents(l.cy), py_client_amount: l.py === null ? null : fromCents(l.py), fs_caption: m[0], fs_group: m[1], wp_ref: m[2],
      mapping_rationale: null, mapping_confidence: 0.95, mapping_flags: [], mapped_by: "ai", verified_by: "u1", verified_at: now,
    };
  });
  const py: PyBalanceRow[] = PY.map(([c, g, r, a], i) => ({ id: `p${i}`, engagement_id: "e1", fs_caption: c, fs_group: g, wp_ref: r, amount: a, source_document_id: null, note: "PY AWP" }));
  return {
    engagement: {
      id: "e1", client_id: "c1", fy_start: "2025-04-01", fy_end: "2026-03-31", audit_fee: 1400, reporting_deadline: "2026-09-30", status: "review",
      preparer_id: "u1", reviewer_id: "u2", partner_id: "u3", materiality: null,
      tax_computation: {
        year_of_assessment: 2026, rate_basis: "standard", rate_basis_reason: "Investment holding company: SME scale not applied pending confirmation.",
        chargeable_income: 163662, instalments_paid: 25280.61,
        lines: [
          { label: "Profit before tax", kind: "profit_before_tax", amount: toCents(100823.18) / 100, basis: "DB-2 audited" },
          { label: "Add: depreciation of investment property", kind: "add_back", amount: 44639.57, basis: "Not deductible" },
          { label: "Add: audit fee accrual", kind: "add_back", amount: 1400, basis: "Provision" },
          { label: "Other adjustments", kind: "other", amount: 16799.25, basis: "Illustrative" },
        ],
        bands: [{ amount: 163662, rate: 0.24, tax: 39278.88 }], computed_tax: 39278.88, open_points: ["Confirm S60F status."],
      },
      settings: { opening_balance_test: { tb_re_bf: 2197693.74, py_re_cf: 2197693.74, difference: 0, source: "PY AWP DB-1" } }, created_at: now, locked_at: null,
    },
    client: {
      id: "c1", name: "Sample Properties Sdn. Bhd.", registration_no: "000000000000 (000000-X)", principal_activity: "Property letting", framework: "MPERS",
      registered_address: "1, Jalan Contoh, 50000 Kuala Lumpur", business_address: "2, Jalan Contoh, 50000 Kuala Lumpur",
      contact_person: "Ms. Contact", contact_phone: "03-0000 0000", contact_email: "contact@example.com", directors: ["Director A", "Director B"], created_at: now,
    },
    documents: [],
    tbLines,
    pyBalances: py,
    adjustments: [
      adj("AJE 1", "Being provision for current year audit fee", [
        { account: "Auditors' remuneration", fs_caption: "Auditors' remuneration", fs_group: "Operating expenses", wp_ref: "Q", dr: 1400, cr: 0 },
        { account: "Accruals - audit fee", fs_caption: "Accruals", fs_group: "Current liabilities", wp_ref: "K", dr: 0, cr: 1400 },
      ]),
      adj("AJE 2", "Being depreciation during the year", [
        { account: "Depreciation", fs_caption: "Depreciation of investment property", fs_group: "Operating expenses", wp_ref: "A1", dr: 44639.57, cr: 0 },
        { account: "Accumulated depreciation", fs_caption: "Investment property", fs_group: "Non-current assets", wp_ref: "A1", dr: 0, cr: 44639.57 },
      ]),
      adj("AJE 3", "Being current year tax provision", [
        { account: "Tax expenses", fs_caption: "Tax expense", fs_group: "Taxation", wp_ref: "M", dr: 39278.88, cr: 0 },
        { account: "Tax recoverable", fs_caption: "Tax recoverable", fs_group: "Current assets", wp_ref: "M", dr: 0, cr: 39278.88 },
      ]),
    ],
    papers: [],
    reviewPoints: [],
    signoffs: [],
    runs: [],
    people: [
      { id: "u1", email: "senior@example.com", full_name: "Senior One", initials: "SNR", role: "senior", status: "active", created_at: now, last_login_at: null },
      { id: "u2", email: "partner@example.com", full_name: "Partner One", initials: "PTR", role: "partner", status: "active", created_at: now, last_login_at: null },
    ],
  };
}

export const sampleBundle = () => assembleBundle(sampleRawBundle());
