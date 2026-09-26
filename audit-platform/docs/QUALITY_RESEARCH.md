# Audit quality research: public findings and what changed

This review covers public inspection reports and standard-setter publications, done to reduce errors in the firm's audit files and shape staff training. Each finding lists its source and the change made in AuditFlow.

**Method and limits.** The research ran on 26 September 2026 through web search. The sandbox blocked direct download of the source documents, so findings are taken from the publishers' pages and summaries as returned by search, with the links below. Before relying on a point for a technical decision, read the primary document.

## 1. What regulators keep finding

| # | Finding | Who reports it | Change in AuditFlow |
|---|---|---|---|
| 1 | Poor documentation is the single most common finding. Files lack evidence of partner review, key judgements, or the link from risk assessment to procedures. Only about half of firms reviewed achieved a satisfactory rating. | MIA Practice Review | Dated sign-offs bound to a file snapshot. Lead schedules must list the risks they address. Quality check "lead schedules concluded". Training module 1. |
| 2 | Generic checklists used without tailoring risk assessment to the client. | MIA Practice Review | Standing order 12 (no boilerplate) and 13 (link risk to response). Programmes are tailored, and dropped steps must be justified. Training module 3. |
| 3 | Partner involvement must be timely, active and documented, not post-signing. | MIA Practice Review | Partner sign-off only after manager review, with all review points cleared. Standing order 20 raises judgements to the partner. |
| 4 | Fraud risks (management override, revenue recognition) not adequately addressed. | ICAEW Audit Monitoring Report 2025 | Critical quality checks on both fraud risks. Standing order 14. Training module 2. |
| 5 | Journal entry testing is among the most common findings; the completeness of the journal population is often untested. | FRC inspections; PCAOB Audit Focus | Critical check "journal testing on a complete population" (the general ledger must be on file). Engagement-wide procedure in every programme. |
| 6 | Sampling problems: sizes reduced on non-existent evidence; material sub-populations with no chance of selection. Sampling and revenue issues persist in Malaysia. | ICAEW 2025; AOB Annual Inspection Report | Standing order 15. Lead schedules carry a sampling basis. Training module 5. |
| 7 | Substantive analytical procedures performed poorly by inexperienced staff. | ICAEW 2025 | Standing order 16 (expectation, threshold, corroboration). Critical check "every flagged movement explained". Training module 5. |
| 8 | Estimates, experts, impairment and provisions. | ICAEW 2025; FRC | Standing order 17. MPERS Section 16/17 step in the investment-property programme. Training module 9. |
| 9 | Going concern: weak rigour and challenge. The MIA's thematic review priorities include going concern and subsequent events. | FRC Tier 2/3; MIA | Critical going-concern check, with indicators computed from the ETB. Standing order 18. Training module 6. |
| 10 | Quality control and review procedures sometimes ineffective, with omitted or incomplete working papers. | FRC | Quality gate blocks sign-off on critical failures. The QC sheet is printed in the workbook. |
| 11 | Enforcement against engagement quality control reviewers who failed as gatekeepers. | AOB 2018 | Roadmap: an engagement quality review stage (ISQM 2) for engagements that need one. |
| 12 | ISQM 1 not yet embedded; monitoring and root-cause analysis needed. | MIA; ICAEW | Training records per person; team progress for partners; audit trail. Firm-level ISQM 1 documentation remains the partners' responsibility. |
| 13 | Large firms use audit quality indicators, and partners and managers coach junior staff during fieldwork. | PwC Malaysia, Grant Thornton Malaysia transparency reports | Training centre with a team matrix. Review points act as coaching notes. Token and time data per engagement support indicators. |

## 2. Standards changes to prepare for

| Standard | Effective | What it means for our files | Where it is handled |
|---|---|---|---|
| ISA 570 (Revised 2024), Going Concern | Periods beginning on or after 15 December 2026 | Evaluation of management's assessment on every audit, covering at least 12 months from the date of approval; events and conditions considered before mitigating plans. | Quality check "new standards" flags affected periods. Training module 6. Standing order 18. |
| ISA 240 (Revised), Fraud | Periods beginning on or after 15 December 2026 | A stronger "fraud lens" across risk assessment and responses. | Fraud checks and training module 2. |
| ISA for LCE | Internationally, periods beginning on or after 15 December 2025 | Adoption in Malaysia by the MIA's Auditing and Assurance Standards Board was not confirmed at the date of this review. | Monitor. Do not use until adopted in Malaysia. |
| Malaysian SME tax rates (15% / 17% / 24%) | From YA 2024 | Lost where more than 20% of paid-up capital is held by foreign companies or non-Malaysian citizens. | Tax prompt and M4 notes updated. Training module 9. |

## 3. Technical point confirmed

MPERS (based on the IFRS for SMEs) measures investment property at fair value through profit or loss only when fair value can be measured reliably without undue cost or effort. Otherwise the property is accounted for under Section 17 (cost model). This supports finding 6 in `AUDIT_METHODOLOGY.md` on the investment-property note.

## 4. What changed in the platform

- **Quality gate** (`src/lib/audit/quality.ts`). Fifteen checks shown on the Review tab and printed as the QC sheet. Critical failures block every sign-off.
- **Firm standard audit programmes** (`src/lib/audit/programmes.ts`). Areas A, A1, D, E, F, H, I, K, M, O and Q, plus engagement-wide procedures, all with ISA references. The AI must tailor them.
- **Standing orders 12-20** added to the AI constitution (`src/lib/ai/prompts.ts`).
- **Lead schedules** now record the risks they address and the sampling basis.
- **Training centre** (`/training`). Ten modules, six of them core, with knowledge checks graded on the server, recorded per person and visible to partners and managers.

## Sources

- [MIA: Practice Review](https://mia.org.my/regulatory-public-interest/surveillance/practice-review/)
- [MIA Practice Review 2025: key lessons for Malaysian audit firms](https://usafe-ca.com/2025/10/20/mia-practice-review-2025-key-lessons-for-malaysian-audit-firms/)
- [Accountants Today: key ISQM findings from QAP and MIA Practice Review](https://www.at-mia.my/2025/05/13/part-1-enhancing-audit-quality-key-isqm-findings-from-qap-and-mia-practice-review/)
- [MIA: revision of the Practice Review framework, effective 1 July 2024](https://www.at-mia.my/2023/11/21/revision-of-practice-review-pr-framework-effective-1-july-2024/)
- [SC Malaysia: AOB Annual Inspection Reports](https://www.sc.com.my/aob/about-audit-oversight-board/aobs-annual-inspection-report)
- [SC Malaysia: AOB media release, 2024 inspection results](https://www.sc.com.my/resources/media/media-release/aob-audit-firms-to-strengthen-capacity-for-sustained-quality-improvements)
- [AOB Annual Inspection Report 2018 coverage](https://mondovisione.com/news/malaysia-capital-market-audit-regulator-issues-annual-report-and-annual-inspecti-2019625/)
- [ICAEW Audit Monitoring Report 2025](https://www.icaew.com/regulation/working-in-the-regulated-area-of-audit/audit-monitoring-report-2025)
- [ICAEW: smaller audit firms and less complex audits](https://www.icaew.com/regulation/regulatory-news/regulatory-news-2025-07/ami-smaller-audit-firms-and-less-complex-audits)
- [FRC: Tier 2 and 3 inspection findings (Dec 2024)](https://www.frc.org.uk/news-and-events/news/2024/12/frc-publishes-inspection-findings-for-the-tier-2-and-3-audit-firms-2024/)
- [FRC: annual audit firm inspection results (Jul 2025)](https://www.frc.org.uk/news-and-events/news/2025/07/frc-publishes-annual-audit-firm-inspection-results/)
- [PCAOB Audit Focus: journal entries](https://pcaobus.org/resources/staff-publications/audit-focus/audit-focus-journal-entries)
- [IAASB: ISA 570 (Revised 2024)](https://www.iaasb.org/publications/isa-570-revised-2024-going-concern)
- [IAASB: ISA 240 (Revised)](https://www.iaasb.org/publications/isa-240-revised-auditor-s-responsibilities-relating-fraud-audit-financial-statements)
- [IAASB: ISA for LCE](https://www.iaasb.org/focus-areas/isa-lce-standard-audits-less-complex-entities)
- [IFAC: Guide to Using ISAs in the Audits of SMEs](https://www.ifac.org/knowledge-gateway/audit-assurance/publications/guide-using-international-standards-auditing-audits-small-and-medium-sized-entities)
- [IFRS Foundation: SME module 17](https://www.ifrs.org/content/dam/ifrs/supporting-implementation/smes/module-17.pdf)
- [PwC Malaysia Transparency Report 2024](https://www.pwc.com/my/en/aboutus/transparency-report/2024-pwc-malaysia-transparency-report.html)
- [Grant Thornton Malaysia Transparency Report 2023](https://www.grantthornton.com.my/globalassets/1.-member-firms/malaysia/publications/transparency-report/transparency-report-2023.pdf)
- [PwC tax summaries: Malaysia corporate income tax](https://taxsummaries.pwc.com/malaysia/corporate/taxes-on-corporate-income)
- [ICAEW: ISQM resources for small practices](https://www.icaew.com/technical/audit-and-assurance/audit/quality-management-in-audit-firms/isqm-resources-for-small-practices)
