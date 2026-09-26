import type { Bundle } from "../pipeline/bundle";
import { GROUP_NORMAL_SIGN, PL_GROUPS } from "./catalog";
import { formatRM, sum, toCents } from "./money";

/**
 * Pre-sign-off quality gate.
 *
 * Each check targets a weakness that audit regulators repeatedly report in public
 * inspection findings (see docs/QUALITY_RESEARCH.md). "critical" checks block every
 * sign-off stage; "warning" checks must be read but do not block; "info" is guidance.
 */

export type Severity = "critical" | "warning" | "info";

export interface QualityCheck {
  id: string;
  area: string;
  title: string;
  standard: string;
  severity: Severity;
  passed: boolean;
  detail: string;
  fixHref?: string;
}

const text = (v: unknown) => JSON.stringify(v ?? "").toLowerCase();

export function qualityChecks(b: Bundle): QualityCheck[] {
  const out: QualityCheck[] = [];
  const base = `/engagements/${b.engagement.id}`;
  const paper = (ref: string) => b.papers.find((p) => p.ref === ref);
  const ac = paper("AC")?.content as { risks?: { risk: string; response: string; wp_ref: string }[] } | undefined;
  const bd = paper("BD")?.content as
    | { going_concern?: { assessment: string; material_uncertainty: string; indicators: string[] }; subsequent_events?: string[]; related_parties?: unknown[] }
    | undefined;
  const de = paper("DE")?.content as { movements?: { fs_caption: string }[] } | undefined;
  const signed = b.documents.filter((d) => d.status === "signed");
  const rows = b.etb?.rows ?? [];
  const m = b.materiality;

  // 1. Materiality judgement documented (ISA 320.14)
  out.push({
    id: "materiality-basis",
    area: "Planning",
    title: "Materiality basis chosen and reasoned",
    standard: "ISA 320.10, 320.14",
    severity: "critical",
    passed: Boolean(m?.selectedReason && m.selectedReason.trim().length >= 20),
    detail: m?.selectedReason ? `Basis recorded: ${m.selected === "firm" ? "firm method" : "ISA 320 benchmark"}.` : "No reason recorded for the materiality basis. Inspectors expect the benchmark, percentage and why they suit this entity.",
    fixHref: `${base}/etb`,
  });

  // 2. Presumed fraud risks (ISA 240.26, 240.31)
  const risks = text(ac?.risks);
  out.push({
    id: "fraud-override",
    area: "Fraud",
    title: "Management override of controls assessed as a significant risk",
    standard: "ISA 240.31-33",
    severity: "critical",
    passed: /override/.test(risks),
    detail: /override/.test(risks) ? "Present in the risk register (AC)." : "The risk register does not address management override, which applies to every audit.",
    fixHref: `${base}/papers?ref=AC`,
  });
  out.push({
    id: "fraud-revenue",
    area: "Fraud",
    title: "Revenue recognition fraud risk assessed or rebutted with reasons",
    standard: "ISA 240.26, 240.47",
    severity: "critical",
    passed: /revenue/.test(risks),
    detail: /revenue/.test(risks) ? "Present in the risk register (AC)." : "The presumed revenue fraud risk is neither assessed nor rebutted with documented reasons.",
    fixHref: `${base}/papers?ref=AC`,
  });

  // 3. Journal entry testing with a complete population (ISA 240.32(a))
  const hasGl = signed.some((d) => d.kind === "cy_gl" || d.kind === "cy_tb");
  const jetMentioned = /journal/.test(text(b.papers.map((p) => p.content)));
  out.push({
    id: "journal-testing",
    area: "Fraud",
    title: "Journal entry testing performed on a complete population",
    standard: "ISA 240.32(a), A41-A45",
    severity: "critical",
    passed: hasGl && jetMentioned,
    detail: !hasGl
      ? "No general ledger or trial balance listing is on file, so journal entries cannot be selected or the population agreed to the trial balance."
      : jetMentioned
        ? "General ledger on file and journal testing documented."
        : "The general ledger is on file but no working paper documents journal entry testing.",
    fixHref: `${base}/documents`,
  });

  // 4. Opening balances (ISA 510)
  const ob = b.settings.opening_balance_test;
  const pyFromClient = b.pyBalances.some((p) => /not agreed/i.test(p.note ?? ""));
  out.push({
    id: "opening-balances",
    area: "Opening balances",
    title: "Opening balances agreed to the prior-year audited report",
    standard: "ISA 510.6",
    severity: "critical",
    passed: Boolean(ob && ob.difference === 0 && !pyFromClient),
    detail: pyFromClient
      ? "Comparatives are the client's own figures. Upload the prior-year audited financial statements and re-run the mapping step."
      : !ob || ob.difference === null
        ? "Opening retained earnings not yet agreed (DA3)."
        : ob.difference === 0
          ? "Opening retained earnings agree to the audited report."
          : `Opening retained earnings differ by RM${ob.difference.toFixed(2)}.`,
    fixHref: `${base}/trial-balance`,
  });

  // 5. Analytical review completed (ISA 520)
  const flagged = rows.filter((r) => r.flagged);
  const unexplained = flagged.filter((r) => !de?.movements?.some((x) => x.fs_caption.toLowerCase() === r.fs_caption.toLowerCase()));
  out.push({
    id: "analytics",
    area: "Analytical review",
    title: "Every flagged movement explained and corroborated",
    standard: "ISA 520.5-7",
    severity: "critical",
    passed: b.etb !== null && unexplained.length === 0 && Boolean(de),
    detail: !de ? "Analytical review (DE) not yet performed." : unexplained.length ? `Not explained: ${unexplained.map((r) => r.fs_caption).join(", ")}.` : `${flagged.length} flagged movement(s), all explained.`,
    fixHref: `${base}/etb`,
  });

  // 6. Going concern (ISA 570)
  const nca = sum(rows.filter((r) => r.fs_group === "Current assets").map((r) => r.cy_audited)) + sum(rows.filter((r) => r.fs_group === "Current liabilities").map((r) => r.cy_audited));
  const loss = (b.etb?.totals.pbt_audited ?? 0) < 0;
  const indicators = [nca < 0 ? `net current liabilities of RM${formatRM(-nca)}` : null, loss ? "a loss before tax" : null].filter(Boolean);
  out.push({
    id: "going-concern",
    area: "Going concern",
    title: "Going concern evaluated and concluded",
    standard: "ISA 570.10-19; ISA 570 (Revised 2024) for periods from 15 Dec 2026",
    severity: "critical",
    passed: Boolean(bd?.going_concern?.assessment),
    detail: bd?.going_concern
      ? `Concluded: material uncertainty "${bd.going_concern.material_uncertainty}".${indicators.length ? ` Indicators present: ${indicators.join(" and ")}; make sure evidence such as a directors' undertaking is on file.` : ""}`
      : `No going-concern evaluation (BD).${indicators.length ? ` Indicators present: ${indicators.join(" and ")}.` : ""}`,
    fixHref: `${base}/papers?ref=BD`,
  });

  // 7. Related parties (ISA 550, MPERS Section 33)
  const rpBalances = rows.filter((r) => /director|related|holding|shareholder|associate/i.test(r.fs_caption) && r.cy_audited !== 0);
  out.push({
    id: "related-parties",
    area: "Related parties",
    title: "Related parties identified and disclosures considered",
    standard: "ISA 550.11-25; MPERS Section 33",
    severity: rpBalances.length ? "critical" : "warning",
    passed: Boolean(bd?.related_parties && (bd.related_parties as unknown[]).length) || rpBalances.length === 0,
    detail: rpBalances.length
      ? `Related-party balances on the ETB: ${rpBalances.map((r) => r.fs_caption).join(", ")}. ${bd?.related_parties?.length ? "Listed in BD." : "Not yet listed in BD."}`
      : "No related-party captions on the ETB. Still enquire of the directors and document it.",
    fixHref: `${base}/papers?ref=BD`,
  });

  // 8. Subsequent events (ISA 560)
  out.push({
    id: "subsequent-events",
    area: "Completion",
    title: "Subsequent events procedures documented",
    standard: "ISA 560.6-9",
    severity: "warning",
    passed: Boolean(bd?.subsequent_events?.length),
    detail: bd?.subsequent_events?.length ? "Documented in BD." : "No subsequent-events work recorded.",
    fixHref: `${base}/papers?ref=BD`,
  });

  // 9. Bank confirmations (ISA 505)
  const hasCash = rows.some((r) => /cash|bank/i.test(r.fs_caption) && r.cy_audited !== 0);
  const hasConfirmation = signed.some((d) => d.kind === "supporting" && /confirm|bank/i.test(`${d.filename} ${d.description ?? ""}`));
  out.push({
    id: "bank-confirmation",
    area: "Cash",
    title: "Bank balances confirmed directly with the bank",
    standard: "ISA 505.7, ISA 500.A31",
    severity: "warning",
    passed: !hasCash || hasConfirmation,
    detail: !hasCash ? "No bank balances." : hasConfirmation ? "Bank evidence is on file. Check the reply came directly to the firm." : "No bank confirmation or statement is on file. Send and control the request yourself, not through the client.",
    fixHref: `${base}/documents`,
  });

  // 10. Lead schedules concluded
  const leads = b.papers.filter((p) => /^[A-S]\d?$/.test(p.ref));
  const pending = leads.filter((p) => {
    const c = p.content as { conclusion?: string; outstanding?: string[] };
    return !c.conclusion || /pending/i.test(c.conclusion) || (c.outstanding?.length ?? 0) > 0;
  });
  out.push({
    id: "lead-conclusions",
    area: "Execution",
    title: "Every lead schedule has a supported conclusion and no outstanding work",
    standard: "ISA 230.8, ISA 330.25-26",
    severity: "critical",
    passed: leads.length > 0 && pending.length === 0,
    detail: leads.length === 0 ? "Lead schedules not yet drafted." : pending.length ? `Outstanding or pending: ${pending.map((p) => p.ref).join(", ")}.` : "All concluded.",
    fixHref: `${base}/papers`,
  });

  // 11. Abnormal balances presented correctly
  const abnormal = rows.filter((r) => r.cy_audited !== 0 && Math.sign(r.cy_audited) !== GROUP_NORMAL_SIGN[r.fs_group]);
  out.push({
    id: "abnormal-balances",
    area: "Presentation",
    title: "No caption shows a balance on the wrong side",
    standard: "MPERS Section 4; ISA 700.13",
    severity: "warning",
    passed: abnormal.length === 0,
    detail: abnormal.length ? `Reclassify: ${abnormal.map((r) => `${r.fs_caption} (${r.fs_group})`).join(", ")}.` : "None.",
    fixHref: `${base}/adjustments`,
  });

  // 12. Uncorrected misstatements (ISA 450)
  const unc = b.adjustments.filter((a) => a.status === "uncorrected");
  const uncTotal = Math.abs(sum(unc.map((a) => sum(a.lines.filter((l) => PL_GROUPS.includes(l.fs_group)).map((l) => toCents(l.cr) - toCents(l.dr))))));
  const mat = m ? (m.selected === "isa320" ? m.isa.materiality : (m.final ?? m.draft).materiality) : 0;
  out.push({
    id: "uncorrected",
    area: "Completion",
    title: "Uncorrected misstatements below materiality",
    standard: "ISA 450.11, ISA 705",
    severity: "critical",
    passed: uncTotal < mat || unc.length === 0,
    detail: unc.length ? `Aggregate uncorrected RM${formatRM(uncTotal)} against materiality RM${formatRM(mat)}.` : "No uncorrected misstatements.",
    fixHref: `${base}/adjustments`,
  });

  // 13. Evidence behind every adjustment
  const noEvidence = b.adjustments.filter((a) => a.status === "accepted" && !(a.evidence ?? "").trim());
  out.push({
    id: "aje-evidence",
    area: "Adjustments",
    title: "Every accepted adjustment cites its evidence",
    standard: "ISA 230.8-9, ISA 500.6",
    severity: "warning",
    passed: noEvidence.length === 0,
    detail: noEvidence.length ? `No evidence recorded for ${noEvidence.map((a) => a.ref).join(", ")}.` : "All accepted entries cite evidence.",
    fixHref: `${base}/adjustments`,
  });

  // 14. Tax computation reviewed
  const tax = b.engagement.tax_computation as { open_points?: string[] } | null;
  out.push({
    id: "tax",
    area: "Taxation",
    title: "Tax computation open points resolved",
    standard: "Income Tax Act 1967; ISA 540 (provision is an estimate)",
    severity: "warning",
    passed: Boolean(tax) && !(tax?.open_points?.length),
    detail: !tax ? "No tax computation drafted." : tax.open_points?.length ? `Open: ${tax.open_points.join(" ")}` : "No open points.",
    fixHref: `${base}/adjustments`,
  });

  // 15. Standards effective for this period
  const start = b.engagement.fy_start;
  out.push({
    id: "new-standards",
    area: "Standards",
    title: start >= "2026-12-15" ? "ISA 570 (Revised 2024) and ISA 240 (Revised) apply to this period" : "Revised ISA 570 and ISA 240 do not yet apply",
    standard: "ISA 570 (Revised 2024); ISA 240 (Revised): periods beginning on or after 15 Dec 2026",
    severity: "info",
    passed: true,
    detail:
      start >= "2026-12-15"
        ? "Evaluate management's going-concern assessment on every audit, covering at least 12 months from the date the financial statements are approved, and apply the revised fraud requirements throughout."
        : "Prepare for the revised standards, which apply to periods beginning on or after 15 December 2026.",
  });

  return out;
}

export function qualityBlockers(checks: QualityCheck[]) {
  return checks.filter((c) => c.severity === "critical" && !c.passed);
}
