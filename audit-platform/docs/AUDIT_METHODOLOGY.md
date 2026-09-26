# Audit methodology: firm template, benchmark review and what the platform changes

This document records how AuditFlow reproduces the firm's existing audit file and where it raises it to the documentation standard of large international firms.

## What "Big 4 standard" can and cannot mean here

The Big 4 methodologies and their audit platforms (PwC Aura, Deloitte Omnia, EY Canvas, KPMG Clara) are proprietary. Their internal manuals are not public, so nothing here copies them.

What is public, and what every Big 4 file is built to satisfy, is the ISAs as adopted by the MIA, ISQM 1 and ISQM 2, ISA 220 (Revised), the MIA By-Laws, and the Audit Oversight Board's and MIA Practice Review's published inspection findings. This review benchmarks the firm's file against those requirements and against the publicly described features of those platforms:

- risk-based planning at assertion level
- one documented materiality benchmark
- cross-referenced lead schedules tied to an extended trial balance
- a summary of audit differences
- electronic review notes and dated, role-separated sign-offs
- a locked, archived file

## 1. The firm's file, as reproduced

The platform keeps the firm's index (AA2), referencing and tickmarks so the output is recognisable to every reviewer.

| Firm paper | What the platform generates |
|---|---|
| AA Audit planning | Planning memo (Word) with the firm's twelve headings, rolled forward from last year's memo. |
| AB2 Planning materiality | Draft and final blocks with live formulas, the Note 1 bands, 90% performance materiality and the 5% SAD threshold. The draft figure matches AB2 exactly, as proven by the automated tests. |
| AD Budget | Not generated. Billing stays in the firm's existing process. |
| DA3 Test of opening balance | Retained earnings per ledger compared with the prior-year audited report, plus every balance-sheet caption. |
| DB-1 / DB-2 | Working balance sheet and P&L: last year, per client, adjustment, AJE reference, audited and lead reference, with casting formulas. |
| DC1 AJEs | The firm layout: income-statement and balance-sheet Dr/Cr columns and the directors' approval block. Reclassifications go on DC2. |
| Lead schedules A, A1, F, H, K, M, O, Q, ... | Objective, source, scope, procedures, observations, conclusion and the Audit Workdone legend. Each total is cross-referenced to DB-1 or DB-2. |
| M4 Tax computation | Structured computation. The platform recomputes tax on chargeable income itself. |

## 2. Findings from reviewing the firm's current template

These came from reading the sample FYE 31 March 2026 file supplied by the firm (a property-letting company; client identity withheld because this repository is public). They are raised for the engagement partner's judgement and are not conclusions.

1. **Materiality is set at the top of the range.** AB2 takes the highest of three benchmarks and sets performance materiality at 90%. On the 2026 draft that gives RM40,700. ISA 320.10 requires one benchmark chosen with judgement. Common practice for an asset-holding company is 1-2% of total assets, with performance materiality at 50-75% depending on risk. The ISA 320 view for this client is RM27,100, with performance materiality of RM20,325 at low risk. A higher materiality reduces the work done, so it needs a documented reason. AB2 now prints both views and flags any gap above 50%.
2. **The planning memo pre-states procedures.** It records that fraud discussions "were held" and that "no unusual risks" exist, with no date, attendee or response recorded. ISA 230.8 requires the nature, timing and extent of work actually performed. The AI is instructed never to state that a discussion occurred without evidence. It writes "To be held with ... on ..." instead.
3. **The presumed fraud risks are not addressed.** ISA 240.26 presumes a risk in revenue recognition, which can only be rebutted with documented reasons. ISA 240.31-32 requires work on management override of controls, including journal-entry testing. The new AC sheet always includes both.
4. **Going concern is not considered.** The balance sheet shows net current liabilities of RM83,817.51. Directors' advances of RM60,000.41 fund the company. ISA 570.10 requires an evaluation, and the usual evidence is the directors' undertaking not to recall their advances. The new BD sheet covers this.
5. **Related parties are not documented.** Balances due to both directors, and administrative and caretaker fees paid to what appear to be connected persons, need ISA 550 procedures and MPERS Section 33 disclosure.
6. **The investment property accounting needs a technical review.** Note N1 on A1 describes a "switch to the cost model in accordance with MPERS Section 10". Under MPERS Section 16, when fair value can no longer be measured reliably without undue cost or effort, the property is accounted for as property, plant and equipment under Section 17. Its carrying amount becomes cost, and this is a change of circumstances, not a change in accounting policy. The classification, the Section 10 reference and the related disclosures should be confirmed by the partner.
7. **The tax balance changes sign after adjustment.** Provision for taxation of RM25,280.61 debit becomes a RM13,998.27 credit after AJE 3. It must then be presented as tax payable, not tax recoverable. The platform flags any caption whose audited balance is opposite to its normal side.
8. **The template carries stale content forward.** It includes a 2020 fax (Q_2), a trade receivables sheet with other clients' customers and 2014-2015 commentary (D1), a durian plantation note (A (2)), Ipoh land details dated 2017-2018 (A1-1), and a tax computation headed Y/A 2024 for the 2025 period (M4). Carried-forward text is a known source of inspection findings. The platform regenerates every paper each year and never copies narrative it cannot evidence.
9. **The AJE listing has integrity gaps.** "AJE 3" appears twice on DC1, AJE 4 is empty, and entries are not numbered in order. The platform enforces unique references and balanced entries, and records every decision against a named person.
10. **Review is typed, not dated.** Sheets show the reviewer's initials typed in, with no date. ISA 230.9(c) and ISA 220.31 require who reviewed and when. The platform records dated electronic sign-offs, bound to a SHA-256 snapshot of the file.

## 3. What the platform adds

| Area | Improvement | Standard |
|---|---|---|
| Evidence | Every upload is fingerprinted (SHA-256), stored unchangeably and attested by the uploader with a password re-entry. Unsigned files are never processed. | ISA 500, ISA 230 |
| Arithmetic | Every AI transcription is re-cast and re-tied to the sen. The trial balance must net to nil; AJEs must balance. | ISA 500.7 (accuracy of information produced by the entity) |
| Materiality | Firm method and an ISA 320 benchmark view side by side, with the reason for the adopted basis required. | ISA 320.10-14, ISA 450 |
| Risk | Assertion-level risk register (AC) with significant risks and planned responses. | ISA 315 (Revised 2019), ISA 330 |
| ETB | Account-level extended trial balance (DD) with caption subtotals and formulas; posts accepted AJEs only. | Practice |
| Analytics | Movement flags tied to SAD and performance materiality, with written explanations and evidence (DE). | ISA 520 |
| Audit differences | Uncorrected misstatements summarised against the SAD threshold and materiality (BB). | ISA 450 |
| Completion | Going concern, subsequent events, related parties (BD); completion summary and representation points (BA, BC). | ISA 570, 560, 550, 580 |
| Review | Review points with responses and clearance; maker-checker on working papers; three-stage sign-off (preparer, manager, partner); one person cannot sign two stages; partner sign-off locks the file. | ISA 220 (Revised), ISQM 1 |
| Trail | Append-only, hash-chained audit log of every action, verifiable from the Audit trail page. | ISQM 1.31(f), ISA 230.A21-A24 |

## 4. What stays with people

The AI drafts; people conclude. A named person decides each of the following in the application, and the decision is logged:

- verifying every account mapping
- accepting, rejecting or leaving uncorrected every adjustment
- choosing the materiality basis
- marking each paper prepared and reviewed
- clearing every review point
- the three sign-offs

Procedures that need external evidence are listed by the AI as outstanding until that evidence is uploaded:

- bank and debtor confirmations (ISA 505)
- sighting title deeds and tenancy agreements
- inquiry of the directors

## 5. Roadmap

1. **Journal-entry testing** on uploaded general ledgers (ISA 240.32), with risk-based filters such as weekend postings, round sums and entries after year end.
2. **Confirmation tracker** for bank and debtor letters sent, received and agreed (ISA 505).
3. **Financial statements generation** under MPERS: statements, notes and the auditor's report, from the locked ETB.
4. **File archiving** 60 days after the report date, with a retention clock (ISA 230.A21, ISQM 1).
5. **Engagement quality review** workflow for engagements that require one (ISQM 2).
