/**
 * Firm standard audit programmes by lead schedule.
 *
 * The AI tailors these to the client (it must not copy steps that do not apply) and
 * marks each step done only when uploaded evidence supports it. They are also the
 * content of the "Audit areas" training module. Sources: ISAs as adopted by the MIA,
 * IFAC Guide to Using ISAs in the Audits of SMEs, and recurring inspection findings
 * summarised in docs/QUALITY_RESEARCH.md.
 */

export interface ProgrammeStep {
  step: string;
  assertions: string[];
  standard: string;
}

export interface Programme {
  ref: string;
  area: string;
  keyRisks: string[];
  steps: ProgrammeStep[];
}

const S = (step: string, assertions: string[], standard: string): ProgrammeStep => ({ step, assertions, standard });

export const PROGRAMMES: Programme[] = [
  {
    ref: "A",
    area: "Property, plant and equipment",
    keyRisks: ["Capitalised repairs", "Depreciation not per policy", "Impairment indicators ignored"],
    steps: [
      S("Agree the fixed asset register to the trial balance and the opening balances to the prior-year audited report.", ["Completeness", "Accuracy"], "ISA 500, ISA 510"),
      S("Vouch additions above performance materiality divided by 3 (or all, if few) to invoices and evidence of ownership; check capital vs revenue nature.", ["Existence", "Rights", "Classification"], "ISA 500.A14"),
      S("Recompute depreciation by class against the stated policy and useful lives; investigate differences above the SAD threshold.", ["Valuation"], "ISA 520, ISA 540"),
      S("Inspect title or grant documents and search for charges on assets (e.g. SSM charge search for pledged property).", ["Rights and obligations", "Presentation"], "ISA 500"),
      S("Consider impairment indicators (idle assets, damage, falling rental yields) and document the conclusion.", ["Valuation"], "MPERS Section 27, ISA 540"),
    ],
  },
  {
    ref: "A1",
    area: "Investment property",
    keyRisks: ["Wrong measurement model under MPERS Section 16/17", "Lease-term changes not reflected", "Rental income completeness"],
    steps: [
      S("Confirm whether fair value can be measured reliably without undue cost or effort. If yes, measure at fair value through profit or loss; if not, account under Section 17 (cost-depreciation-impairment) and disclose the change of circumstances.", ["Valuation", "Presentation"], "MPERS Section 16.7-16.10, Section 17"),
      S("Inspect title deeds or strata titles and lease documents; agree lease term and expiry used for depreciation.", ["Existence", "Rights"], "ISA 500"),
      S("Where a valuer is used, evaluate competence, capabilities and objectivity, and the key assumptions.", ["Valuation"], "ISA 500.8, ISA 540"),
      S("Agree rental income to tenancy agreements (rate x months) and reconcile to revenue <O>.", ["Occurrence", "Completeness"], "ISA 520"),
    ],
  },
  {
    ref: "D",
    area: "Trade receivables",
    keyRisks: ["Fictitious or overstated receivables", "Unprovided impaired balances", "Cut-off"],
    steps: [
      S("Agree the aged listing to the ledger and test the ageing on a sample.", ["Accuracy", "Valuation"], "ISA 500.9"),
      S("Send positive confirmations controlled by the firm; record sent, received, differences and alternative procedures for non-replies.", ["Existence", "Rights"], "ISA 505.7-12"),
      S("Test subsequent receipts after year end for balances not confirmed.", ["Existence", "Valuation"], "ISA 505.12"),
      S("Evaluate impairment (MPERS 11.21-11.26) on long-outstanding and disputed balances; challenge management's judgement.", ["Valuation"], "ISA 540"),
      S("Test cut-off: last and first invoices and delivery documents around year end.", ["Cut-off"], "ISA 500"),
    ],
  },
  {
    ref: "E",
    area: "Other receivables, deposits and prepayments",
    keyRisks: ["Non-recoverable deposits", "Related-party advances disguised as receivables"],
    steps: [
      S("Vouch material deposits and prepayments to agreements and receipts; recompute prepayment periods.", ["Existence", "Valuation"], "ISA 500"),
      S("Identify any balances with directors or related parties and transfer them to <L> for disclosure.", ["Presentation"], "ISA 550"),
    ],
  },
  {
    ref: "F",
    area: "Cash and bank balances",
    keyRisks: ["Fabricated bank statements", "Undisclosed facilities, charges or accounts"],
    steps: [
      S("Obtain bank confirmations for every account open during the year, sent and received directly by the firm (not via the client).", ["Existence", "Rights", "Completeness"], "ISA 505.7, A6"),
      S("Agree the year-end bank reconciliation to the confirmation and statement; vouch reconciling items to post-year-end clearance.", ["Existence", "Accuracy"], "ISA 500"),
      S("Count or confirm cash in hand where material; otherwise obtain the director's certificate.", ["Existence"], "ISA 501, ISA 500"),
      S("Review confirmations for facilities, securities and charges and cross-reference them to borrowings <I> and disclosures.", ["Completeness", "Presentation"], "ISA 505"),
    ],
  },
  {
    ref: "H",
    area: "Equity",
    keyRisks: ["Share capital not agreed to statutory records", "Dividends declared without adequate solvency"],
    steps: [
      S("Agree share capital to the register of members and SSM records (e.g. Section 58 return).", ["Existence", "Presentation"], "ISA 500"),
      S("Agree opening retained earnings to the prior-year audited report and check the movement (profit, dividends).", ["Accuracy"], "ISA 510"),
      S("For dividends, inspect directors' resolutions and the solvency test under Companies Act 2016 s.131-132.", ["Occurrence", "Presentation"], "ISA 250"),
    ],
  },
  {
    ref: "I",
    area: "Borrowings",
    keyRisks: ["Unrecorded facilities", "Classification of current portion", "Covenant breaches"],
    steps: [
      S("Confirm balances and terms with lenders; agree to loan agreements and statements.", ["Existence", "Completeness"], "ISA 505"),
      S("Recompute interest and the current vs non-current split; check covenants and any breach at year end.", ["Accuracy", "Classification"], "ISA 500, MPERS 4.7"),
    ],
  },
  {
    ref: "K",
    area: "Other payables, accruals and deposits received",
    keyRisks: ["Unrecorded liabilities", "Understated accruals", "Tenant deposits not agreed to agreements"],
    steps: [
      S("Search for unrecorded liabilities: review payments and invoices received after year end.", ["Completeness", "Cut-off"], "ISA 500"),
      S("Recompute accruals (audit fee, quit rent, assessment, secretarial, tax fees) against bills and prior-year patterns.", ["Completeness", "Valuation"], "ISA 540"),
      S("Agree tenancy and utility deposits to tenancy agreements.", ["Existence", "Accuracy"], "ISA 500"),
      S("Confirm directors' current accounts with each director; obtain undertaking if relied on for going concern.", ["Existence", "Presentation"], "ISA 505, ISA 550, ISA 570"),
    ],
  },
  {
    ref: "M",
    area: "Taxation",
    keyRisks: ["Wrong rate basis (SME conditions)", "Non-deductible expenses claimed", "Under/over provision not recognised"],
    steps: [
      S("Recompute the tax provision; check SME eligibility (paid-up capital, gross business income, foreign ownership over 20% including non-Malaysian individuals from YA 2024).", ["Valuation", "Accuracy"], "Income Tax Act 1967, ISA 540"),
      S("Agree instalments (CP204) paid to receipts and the tax payable/recoverable balance to the tax account.", ["Existence", "Accuracy"], "ISA 500"),
      S("Compare the prior-year provision with the Form C filed; book under/over provision.", ["Accuracy"], "ISA 510"),
      S("Assess deferred tax on temporary differences (e.g. depreciation vs capital allowances).", ["Completeness", "Valuation"], "MPERS Section 29"),
    ],
  },
  {
    ref: "O",
    area: "Revenue",
    keyRisks: ["Presumed fraud risk in revenue recognition", "Cut-off", "Completeness of rental or sales income"],
    steps: [
      S("Document the fraud risk in revenue recognition (or a reasoned rebuttal) and the response.", ["Occurrence", "Cut-off"], "ISA 240.26, 240.47"),
      S("Develop an independent expectation (e.g. rent x months per tenancy agreement); set a threshold for investigation; corroborate differences.", ["Completeness", "Occurrence"], "ISA 520.5"),
      S("Vouch a sample of revenue entries to source documents and receipts; test cut-off around year end.", ["Occurrence", "Cut-off"], "ISA 530, ISA 500"),
    ],
  },
  {
    ref: "Q",
    area: "Operating expenses",
    keyRisks: ["Misclassified capital items", "Personal expenses of directors", "Unsupported payments"],
    steps: [
      S("Perform analytical review by expense line against the prior year and expectations; explain movements above the SAD threshold.", ["Occurrence", "Completeness"], "ISA 520"),
      S("Vouch a sample of payments to invoices and payment vouchers; state population, sampling method, size and basis.", ["Occurrence", "Accuracy"], "ISA 530.6-8"),
      S("Identify payments to directors or connected persons and transfer to related-party disclosures.", ["Presentation"], "ISA 550"),
    ],
  },
];

/** Engagement-wide procedures that apply to every audit. */
export const CORE_PROCEDURES: ProgrammeStep[] = [
  S("Test journal entries for management override: obtain the complete journal population, agree it to the trial balance, select entries using risk criteria (e.g. manual entries, entries after year end, round sums, unusual accounts), and vouch them.", ["All"], "ISA 240.32(a), A41-A45"),
  S("Review accounting estimates for management bias against the prior year's outcomes.", ["Valuation"], "ISA 240.32(b), ISA 540.14"),
  S("Evaluate significant unusual transactions and their business rationale.", ["Occurrence"], "ISA 240.32(c)"),
  S("Enquire of the directors about fraud, laws and regulations, litigation, related parties and subsequent events; record who, when and what was said.", ["All"], "ISA 240.18, 250, 501, 550, 560"),
  S("Evaluate going concern over at least 12 months from the date of approval of the financial statements.", ["Presentation"], "ISA 570"),
  S("Obtain written representations dated as near as practicable to the report date.", ["All"], "ISA 580"),
];

export function programmeFor(ref: string): Programme | undefined {
  return PROGRAMMES.find((p) => p.ref === ref);
}

export function programmesText(refs: string[]): string {
  const parts = refs
    .map((r) => programmeFor(r))
    .filter((p): p is Programme => Boolean(p))
    .map((p) => `<${p.ref}> ${p.area}\nKey risks: ${p.keyRisks.join("; ")}\n${p.steps.map((s, i) => `  ${i + 1}. ${s.step} [${s.assertions.join(", ")}; ${s.standard}]`).join("\n")}`);
  parts.push(`Engagement-wide (every audit):\n${CORE_PROCEDURES.map((s, i) => `  ${i + 1}. ${s.step} [${s.standard}]`).join("\n")}`);
  return parts.join("\n\n");
}
