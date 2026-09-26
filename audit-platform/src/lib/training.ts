/**
 * Training centre content. Each module is built from recurring public inspection
 * findings (docs/QUALITY_RESEARCH.md) and the ISAs as adopted by the MIA.
 * Answers are graded on the server; clients only ever see questions and options.
 * Bump `version` when a module changes so staff are asked to retake it.
 */

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Source {
  label: string;
  url: string;
}

export interface Module {
  id: string;
  version: number;
  title: string;
  standards: string;
  minutes: number;
  core: boolean;
  why: string;
  rules: string[];
  commonErrors: string[];
  good: string[];
  questions: Question[];
  sources: Source[];
}

export const PASS_MARK = 1; // every answer correct

const SRC = {
  miaPr: { label: "MIA Practice Review 2025: key lessons (summary)", url: "https://usafe-ca.com/2025/10/20/mia-practice-review-2025-key-lessons-for-malaysian-audit-firms/" },
  miaPage: { label: "MIA Practice Review", url: "https://mia.org.my/regulatory-public-interest/surveillance/practice-review/" },
  aob: { label: "SC Malaysia: AOB Annual Inspection Reports", url: "https://www.sc.com.my/aob/about-audit-oversight-board/aobs-annual-inspection-report" },
  aob2018: { label: "AOB Annual Inspection Report 2018 (sampling, revenue, EQCR)", url: "https://mondovisione.com/news/malaysia-capital-market-audit-regulator-issues-annual-report-and-annual-inspecti-2019625/" },
  icaew: { label: "ICAEW Audit Monitoring Report 2025", url: "https://www.icaew.com/regulation/working-in-the-regulated-area-of-audit/audit-monitoring-report-2025" },
  icaewSmall: { label: "ICAEW: smaller firms and less complex audits", url: "https://www.icaew.com/regulation/regulatory-news/regulatory-news-2025-07/ami-smaller-audit-firms-and-less-complex-audits" },
  frc: { label: "FRC: Tier 2 and 3 inspection findings", url: "https://www.frc.org.uk/news-and-events/news/2024/12/frc-publishes-inspection-findings-for-the-tier-2-and-3-audit-firms-2024/" },
  pcaobJe: { label: "PCAOB Audit Focus: journal entries", url: "https://pcaobus.org/resources/staff-publications/audit-focus/audit-focus-journal-entries" },
  isa570: { label: "IAASB: ISA 570 (Revised 2024) Going Concern", url: "https://www.iaasb.org/publications/isa-570-revised-2024-going-concern" },
  isa240: { label: "IAASB: ISA 240 (Revised) Fraud", url: "https://www.iaasb.org/publications/isa-240-revised-auditor-s-responsibilities-relating-fraud-audit-financial-statements" },
  ifacGuide: { label: "IFAC Guide to Using ISAs in the Audits of SMEs", url: "https://www.ifac.org/knowledge-gateway/audit-assurance/publications/guide-using-international-standards-auditing-audits-small-and-medium-sized-entities" },
  ifrsSme17: { label: "IFRS Foundation: SME module 17 (investment property at cost)", url: "https://www.ifrs.org/content/dam/ifrs/supporting-implementation/smes/module-17.pdf" },
  smeTax: { label: "PwC tax summaries: Malaysia corporate tax", url: "https://taxsummaries.pwc.com/malaysia/corporate/taxes-on-corporate-income" },
  icaewIsqm: { label: "ICAEW: ISQM 1 resources for small practices", url: "https://www.icaew.com/technical/audit-and-assurance/audit/quality-management-in-audit-firms/isqm-resources-for-small-practices" },
};

export const MODULES: Module[] = [
  {
    id: "documentation",
    version: 1,
    title: "Documentation that survives inspection",
    standards: "ISA 230, ISA 220 (Revised)",
    minutes: 10,
    core: true,
    why: "Poor documentation is the single most common finding in MIA Practice Reviews. Files lacked evidence of partner review, key judgements, or the link between risk assessment and audit procedures. Only about half of firms reviewed in the last cycle achieved a satisfactory rating.",
    rules: [
      "An experienced auditor with no connection to the audit must be able to understand what was done, the results, the conclusions and the significant judgements (ISA 230.8).",
      "Record who performed the work, when, and who reviewed it and when (ISA 230.9). A typed name without a date is not evidence of review.",
      "The partner's review must be timely, during the audit and before the report date, not after signing (ISA 220.31-33).",
      "Assemble the final file within 60 days of the report date and never delete documentation afterwards (ISA 230.14, A21-A24).",
    ],
    commonErrors: [
      "Planning memos that state discussions were held with no date, attendees or content.",
      "Stale text carried forward from last year or another client.",
      "Conclusions of 'objective met' with no procedure evidencing it.",
    ],
    good: [
      "Every procedure names the evidence it rests on (document, date, amount).",
      "Judgements are written down, with the alternatives considered.",
      "Review points are raised, answered and cleared inside the file.",
    ],
    questions: [
      {
        q: "A senior writes 'Discussed fraud with the directors; no issues' in the planning memo. What is missing?",
        options: ["Nothing: it records the conclusion", "Who attended, when, what was asked and what was said", "Only the partner's initials", "A reference to ISA 315"],
        answer: 1,
        explain: "ISA 230.8-9 requires the nature, timing and extent of the procedure and the results, so the who, when and what must be recorded.",
      },
      {
        q: "When must the engagement partner review the key judgements?",
        options: ["Any time before the file is archived", "Within 60 days after the report date", "On or before the date of the auditor's report, during the engagement", "Only when a review point is raised"],
        answer: 2,
        explain: "ISA 220 (Revised) requires timely partner review so the partner is satisfied before the report is dated.",
      },
      {
        q: "After the audit report is signed, a reviewer finds a working paper that should be removed. What should happen?",
        options: ["Delete it before archiving", "Keep it; add any later documentation with who, when and why, without deleting the original", "Replace it with a clean version", "Ask the client for permission"],
        answer: 1,
        explain: "After assembly nothing is deleted or discarded (ISA 230.15-16). AuditFlow enforces this by locking the file on partner sign-off.",
      },
    ],
    sources: [SRC.miaPr, SRC.miaPage],
  },
  {
    id: "fraud",
    version: 1,
    title: "Fraud: management override, revenue and journal testing",
    standards: "ISA 240; ISA 240 (Revised) for periods from 15 Dec 2026",
    minutes: 15,
    core: true,
    why: "Regulators report that firms often fail to address fraud risks adequately, especially management override and revenue recognition (ICAEW 2025). Journal testing is among the most common findings, often because the completeness of the journal population was never tested (FRC). Revenue recognition findings persist in AOB inspections in Malaysia.",
    rules: [
      "Management override of controls is a significant risk on every audit. It cannot be rebutted (ISA 240.31).",
      "Revenue recognition is presumed a fraud risk; a rebuttal needs documented, client-specific reasons (ISA 240.26, 240.47).",
      "Journal entry testing: obtain the complete population, agree it to the trial balance, select entries using risk criteria, and vouch them (ISA 240.32(a), A41-A45).",
      "Also review accounting estimates for bias and the business rationale of significant unusual transactions (ISA 240.32(b)-(c)).",
      "ISA 240 (Revised) applies to periods beginning on or after 15 December 2026, and brings a stronger 'fraud lens' through the whole audit.",
    ],
    commonErrors: [
      "Journal testing on an extract never reconciled to the trial balance.",
      "Selection criteria copied from a template instead of this client's fraud risks.",
      "Revenue risk 'rebutted' with one generic sentence.",
    ],
    good: [
      "Population total agreed to TB movements before selection.",
      "Criteria tied to this client: entries by directors, after year end, round sums, unusual pairings.",
      "Each selected entry vouched to support and its business rationale recorded.",
    ],
    questions: [
      {
        q: "Can the risk of management override be rebutted for a small, owner-managed company?",
        options: ["Yes, if the directors are trustworthy", "Yes, if the company is below materiality", "No: it is a significant risk on every audit", "Only under ISA for LCE"],
        answer: 2,
        explain: "ISA 240.31 treats management override as a significant risk in all entities.",
      },
      {
        q: "What must be done before selecting journal entries to test?",
        options: ["Ask the client which entries are unusual", "Confirm the population is complete by agreeing it to the trial balance", "Select the 25 largest entries", "Nothing; selection comes first"],
        answer: 1,
        explain: "Regulators repeatedly find testing performed on an incomplete population. Completeness comes first.",
      },
      {
        q: "A rental company's revenue is 12 months of fixed rent under one tenancy. How do you treat the revenue fraud presumption?",
        options: [
          "Ignore it because revenue is simple",
          "Either keep it and respond, or rebut it with documented, specific reasons (e.g. single tenancy, fixed rent agreed to the agreement and bank receipts)",
          "Always perform 100% vouching",
          "Ask the partner to waive it",
        ],
        answer: 1,
        explain: "A rebuttal is allowed but must be reasoned and specific to the client (ISA 240.47).",
      },
    ],
    sources: [SRC.icaew, SRC.frc, SRC.pcaobJe, SRC.isa240, SRC.aob2018],
  },
  {
    id: "risk",
    version: 1,
    title: "Tailored risk assessment and linking risk to response",
    standards: "ISA 315 (Revised 2019), ISA 330",
    minutes: 12,
    core: true,
    why: "The MIA finds many firms still rely on generic checklists without tailoring the risk assessment to the client, and without linking risks to the procedures performed. ISA 315 (Revised 2019) also expects an understanding of IT, even for small entities.",
    rules: [
      "Identify risks at assertion level for each material class of transactions, balance and disclosure (ISA 315.28-31).",
      "Assess inherent risk on the spectrum; identify significant risks (ISA 315.31-32).",
      "Understand how the client records transactions, including its IT, even if it is a spreadsheet or off-the-shelf package (ISA 315.25-26).",
      "Every assessed risk needs a documented response, and every material area needs substantive procedures (ISA 330.6, 330.18).",
    ],
    commonErrors: [
      "'No unusual risks' written for every client.",
      "Risks listed in planning that no procedure responds to.",
      "No description of the accounting system or who can post entries.",
    ],
    good: [
      "A short risk register: risk, assertion, level, significant or not, response, WP reference (the AC sheet).",
      "Each lead schedule lists the risks it addresses.",
    ],
    questions: [
      {
        q: "Which is the best evidence that a risk assessment is tailored?",
        options: ["It uses the firm's standard checklist", "Each risk refers to this client's facts, assertion and the procedure that answers it", "It is signed by the partner", "It is longer than last year's"],
        answer: 1,
        explain: "Regulators look for the link from client-specific risk to assertion to procedure.",
      },
      {
        q: "A client keeps its books in a spreadsheet. Does ISA 315 still require an understanding of IT?",
        options: ["No, spreadsheets are not IT", "Yes, understand how data is recorded, who can change it and the risks arising", "Only for listed clients", "Only if controls will be tested"],
        answer: 1,
        explain: "The requirement scales down but does not disappear for small entities.",
      },
    ],
    sources: [SRC.miaPr, SRC.icaewSmall, SRC.ifacGuide],
  },
  {
    id: "materiality",
    version: 1,
    title: "Materiality: choosing and defending the benchmark",
    standards: "ISA 320, ISA 450",
    minutes: 8,
    core: true,
    why: "Materiality drives the extent of every test. A benchmark chosen mechanically, such as the highest of three results, can set it too high. That reduces work, and inspectors challenge it.",
    rules: [
      "Choose a benchmark that suits the users of the financial statements, then a percentage, and document why (ISA 320.10, 320.14).",
      "Set performance materiality lower to cover aggregation risk; 50-75% is common, lower where risk is higher (ISA 320.11).",
      "Revise materiality if final figures differ significantly from those used at planning (ISA 320.12-13).",
      "Accumulate misstatements above the clearly trivial threshold and evaluate uncorrected ones (ISA 450).",
    ],
    commonErrors: ["No reason recorded for the benchmark.", "Performance materiality left at 90% for a higher-risk client.", "Materiality not revisited after large adjustments."],
    good: ["AB2 shows both the firm method and the ISA 320 view, the basis adopted and why."],
    questions: [
      {
        q: "For a property-letting company with small, stable profits, which benchmark is usually most appropriate?",
        options: ["Profit before tax", "Total assets", "Number of employees", "Share capital"],
        answer: 1,
        explain: "Users of an asset-holding entity focus on its assets, so total assets is common (ISA 320.A4).",
      },
      {
        q: "After AJEs, profit before tax falls by 40%. What should happen to materiality?",
        options: ["Nothing", "Reconsider it and whether more work is needed (ISA 320.12-13)", "Double it", "Only the SAD threshold changes"],
        answer: 1,
        explain: "Materiality is revised when information would have led to a different amount at planning.",
      },
    ],
    sources: [SRC.ifacGuide],
  },
  {
    id: "sampling-analytics",
    version: 1,
    title: "Sampling and substantive analytical procedures",
    standards: "ISA 530, ISA 520",
    minutes: 12,
    core: true,
    why: "ICAEW finds sample sizes reduced on the strength of evidence that does not exist, samples that give no chance of selecting from a material part of the population, and substantive analytics performed poorly by inexperienced staff. Sampling findings persist in AOB inspections too.",
    rules: [
      "Define the population and confirm it is complete before sampling (ISA 530.8, ISA 500.9).",
      "Every item in the population must have a chance of selection; material or unusual items are tested separately (ISA 530.8, A13).",
      "Document the sample size and how it was determined; never reduce it without evidence (ISA 530.7).",
      "A substantive analytical procedure needs an independent expectation from reliable data, a threshold, investigation of the difference, and corroboration (ISA 520.5, 520.7).",
    ],
    commonErrors: [
      "'Analytics performed, no issues' with no expectation.",
      "Accepting management's explanation without evidence.",
      "Selecting only the largest items and calling it a sample.",
    ],
    good: ["Rental expectation = rent x months per tenancy agreement, threshold below performance materiality, difference corroborated to invoices and bank."],
    questions: [
      {
        q: "Which is a valid expectation for a substantive analytical procedure on rental income?",
        options: ["Last year's rental income", "Monthly rent per tenancy agreements x months occupied, adjusted for rent changes", "Management's budget", "Industry average growth"],
        answer: 1,
        explain: "The expectation must be precise and built from reliable, independent data.",
      },
      {
        q: "What must you do with the explanation for a difference above the threshold?",
        options: ["Record it", "Corroborate it with evidence", "Ask a second director", "Nothing if the partner agrees"],
        answer: 1,
        explain: "ISA 520.7 requires corroboration: management's word alone is not evidence.",
      },
    ],
    sources: [SRC.icaew, SRC.icaewSmall, SRC.aob2018],
  },
  {
    id: "going-concern",
    version: 1,
    title: "Going concern and subsequent events",
    standards: "ISA 570; ISA 570 (Revised 2024) for periods from 15 Dec 2026; ISA 560",
    minutes: 10,
    core: true,
    why: "Going concern is a thematic review priority for the MIA, together with subsequent events. The FRC reports weak challenge of management's evidence. ISA 570 (Revised 2024) makes an evaluation of management's assessment compulsory on every audit.",
    rules: [
      "Consider events and conditions such as net current liabilities, losses and reliance on directors' advances, before looking at mitigating plans (the 'gross' view).",
      "Under ISA 570 (Revised 2024), for periods beginning on or after 15 December 2026, evaluate management's assessment on every audit, covering at least 12 months from the date the financial statements are approved.",
      "Where the company relies on directors' advances, obtain a written undertaking not to recall them and evaluate the directors' ability to support.",
      "Perform subsequent-events procedures up to the report date: minutes, management accounts, enquiries (ISA 560.7).",
    ],
    commonErrors: ["No going-concern paper when current liabilities exceed current assets.", "Relying on a verbal assurance from the directors."],
    good: ["BD paper lists indicators, evidence obtained, conclusion, and the disclosure impact."],
    questions: [
      {
        q: "A company has net current liabilities funded by directors' current accounts. What evidence do you need?",
        options: ["None if it is profitable", "A written undertaking from the directors not to recall the advances, and evidence they can support the company", "A bank confirmation only", "Management's verbal assurance"],
        answer: 1,
        explain: "The undertaking and the directors' capacity are the evidence that mitigates the indicator.",
      },
      {
        q: "Under ISA 570 (Revised 2024), what period must management's assessment cover?",
        options: ["12 months from the year end", "At least 12 months from the date the financial statements are approved", "Until the next audit", "6 months"],
        answer: 1,
        explain: "The revised standard aligns the period to the approval date.",
      },
    ],
    sources: [SRC.isa570, SRC.miaPr, SRC.frc],
  },
  {
    id: "related-parties",
    version: 1,
    title: "Related parties and directors",
    standards: "ISA 550; MPERS Section 33",
    minutes: 8,
    core: false,
    why: "In owner-managed companies, directors' balances, fees paid to relatives and interest-free advances are common. Undisclosed related-party transactions are also a classic fraud route.",
    rules: [
      "Enquire of the directors about related parties and transactions, and record the answers (ISA 550.13).",
      "Stay alert while vouching: payees who are directors, relatives or companies they control (ISA 550.15).",
      "Confirm directors' balances and inspect the terms; consider disclosure under MPERS Section 33.",
    ],
    commonErrors: ["Directors' current accounts classified without confirmation.", "Payments to relatives treated as ordinary expenses without disclosure."],
    good: ["Related-party list in BD with balance, transaction, terms and disclosure conclusion."],
    questions: [
      {
        q: "Administrative fees are paid monthly to a person who shares a surname with a director. What should you do?",
        options: ["Nothing, it is a common surname", "Enquire about the relationship and consider whether it is a related-party transaction requiring disclosure", "Reclassify to directors' remuneration", "Remove it from the sample"],
        answer: 1,
        explain: "Be alert to indicators of related parties during all procedures (ISA 550.15).",
      },
    ],
    sources: [SRC.ifacGuide],
  },
  {
    id: "confirmations",
    version: 1,
    title: "External confirmations",
    standards: "ISA 505, ISA 500",
    minutes: 6,
    core: false,
    why: "Fabricated bank confirmations and statements feature in major audit failures. The firm must control the whole confirmation process.",
    rules: [
      "The firm selects the confirming party, prepares and sends the request, and receives the reply directly (ISA 505.7).",
      "Treat replies received via the client, or with signs of tampering, as unreliable and investigate (ISA 505.10-11).",
      "For non-replies, perform alternative procedures such as subsequent receipts or bank statements obtained directly (ISA 505.12).",
    ],
    commonErrors: ["Client emails the confirmation to the auditor.", "'Confirmation sent' tick with no reply and no alternative procedure."],
    good: ["Confirmation log: sent date, to whom, reply date, agreed or differences, alternative procedures."],
    questions: [
      {
        q: "The client forwards the bank's confirmation reply to you. Can you rely on it?",
        options: ["Yes, it is from the bank", "No, not without further work: it did not come to you directly", "Yes if it is a PDF", "Yes if the partner signs it"],
        answer: 1,
        explain: "ISA 505.10 requires the auditor to maintain control over requests and replies.",
      },
    ],
    sources: [SRC.aob],
  },
  {
    id: "estimates-mpers",
    version: 1,
    title: "Estimates and MPERS judgement areas",
    standards: "ISA 540 (Revised); MPERS Sections 16, 17, 27, 29",
    minutes: 12,
    core: false,
    why: "Estimates such as impairment, valuation and provisions are among the most frequent inspection findings (FRC, ICAEW). For property companies, the MPERS investment-property rules are a recurring judgement area.",
    rules: [
      "Understand the method, data and assumptions behind each estimate, and compare with the prior year's outcome (ISA 540.13-14).",
      "Under MPERS Section 16, investment property is measured at fair value through profit or loss if that can be done reliably without undue cost or effort; otherwise it is accounted for under Section 17 (cost-depreciation-impairment).",
      "A move to Section 17 because fair value is no longer available is a change of circumstances, not a change in accounting policy; disclose it.",
      "Tax provision: check SME eligibility, including more than 20% ownership by foreign companies or non-Malaysian citizens from YA 2024 (standard rate 24%).",
    ],
    commonErrors: ["Accepting management's useful lives without challenge.", "Citing the wrong MPERS section for an investment-property change."],
    good: ["Estimate paper showing method, key assumptions, sensitivity and prior-year outcome."],
    questions: [
      {
        q: "Fair value of an investment property can no longer be measured reliably without undue cost. Under MPERS, what applies?",
        options: ["Keep the last fair value forever", "Account for it under Section 17 using cost-depreciation-impairment, and disclose the change of circumstances", "Restate prior years under Section 10", "Derecognise the property"],
        answer: 1,
        explain: "Sections 16 and 17 set out this treatment; it is not a Section 10 policy change.",
      },
      {
        q: "From YA 2024, which of these disqualifies a company from the SME tax rates?",
        options: ["Paid-up capital of RM2 million", "Gross business income of RM40 million", "More than 20% of paid-up capital held by non-Malaysian citizens", "Being an audit client"],
        answer: 2,
        explain: "The foreign-ownership condition now covers non-Malaysian individuals as well as foreign companies.",
      },
    ],
    sources: [SRC.frc, SRC.icaew, SRC.ifrsSme17, SRC.smeTax],
  },
  {
    id: "auditflow",
    version: 1,
    title: "Using AuditFlow responsibly",
    standards: "ISQM 1; ISA 220 (Revised)",
    minutes: 6,
    core: true,
    why: "Quality management systems must be embedded, not just written down, and firms that adopt new technology must keep control of quality (ICAEW, MIA). AI output is a draft that a named person must check.",
    rules: [
      "Only upload evidence you obtained from the client or its authorised representative; your attestation and password re-entry are your signature.",
      "Verify every trial-balance line against the source before ticking it.",
      "Treat every AI adjustment, narrative and tickmark as a draft; accept only what you have checked.",
      "The quality checklist blocks sign-off on critical failures. Fix the cause, never work around it.",
      "Never share your password: every action in the audit trail is recorded under your name.",
    ],
    commonErrors: ["Ticking 'verify all' without comparing to the source.", "Accepting AI adjustments without reading the rationale."],
    good: ["Review points raised whenever an AI draft needs a judgement."],
    questions: [
      {
        q: "The AI proposes an AJE with evidence 'per tenancy agreement'. The agreement is not in the file. What do you do?",
        options: ["Accept it: the AI read something", "Reject it or obtain and upload the agreement before accepting", "Accept and fix later", "Ask a colleague to accept it"],
        answer: 1,
        explain: "An entry is only as good as the evidence on file.",
      },
      {
        q: "A colleague asks to use your login to sign off an attestation while you are away. What do you do?",
        options: ["Share it; the work is done", "Refuse: signatures and the audit trail are personal", "Share it if the partner agrees", "Write your password on the file"],
        answer: 1,
        explain: "Credentials are your electronic signature; sharing them breaks the audit trail.",
      },
    ],
    sources: [SRC.icaewIsqm, SRC.miaPr],
  },
];

export function moduleById(id: string) {
  return MODULES.find((m) => m.id === id);
}

/** Questions without answers, safe to send to the browser. */
export function publicQuestions(m: Module) {
  return m.questions.map((q, i) => ({ i, q: q.q, options: q.options }));
}
