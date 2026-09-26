import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow, PipelineStep, Profile } from "../db-types";
import { callStructured, AiError, AI_MODEL, type AiUsage, type ContentBlock } from "../ai/claude";
import { EXTRACT_PROMPT, EXTRACT_RETRY_PROMPT, MAP_PROMPT, ADJUST_PROMPT, ANALYSE_PROMPT, PAPERS_PROMPT } from "../ai/prompts";
import { MappingResult, AdjustResult, AnalyseResult, PapersResult } from "../ai/schemas";
import {
  StatementExtraction, checkStatement, crossCheck, describeFailures, buildTrialBalance, type CheckResult,
} from "../audit/extraction";
import { GROUP_NORMAL_SIGN, LEAD_REFS, indexTitle, type FsGroup } from "../audit/catalog";
import { fromCents, toCents, formatRM, sum } from "../audit/money";
import { adjustmentBalances } from "../audit/etb";
import { taxOnChargeableIncome } from "../audit/tax";
import { loadBundle, adjustmentToInput, latestRun, type Bundle } from "./bundle";
import { downloadVerified, toContentBlocks, loadDocs, IntegrityError } from "./documents";
import { logEvent } from "../session";

export class PipelineBlocked extends Error {}

interface StepOutcome {
  status: "succeeded" | "needs_review";
  summary: string;
  output: Record<string, unknown>;
  usage: AiUsage[];
}

const REQUIRES: Record<PipelineStep, PipelineStep | null> = {
  extract: null,
  map: "extract",
  adjust: "map",
  analyse: "adjust",
  papers: "analyse",
};

function signedOnly(b: Bundle, kinds: string[]): DocumentRow[] {
  const relevant = b.documents.filter((d) => kinds.includes(d.kind) && d.status !== "superseded");
  const unsigned = relevant.filter((d) => d.status !== "signed");
  if (unsigned.length) {
    throw new PipelineBlocked(
      `Not processed. These files have not been signed off by the uploading staff member: ${unsigned.map((d) => d.filename).join(", ")}. Unsigned files are never sent for processing.`,
    );
  }
  return relevant;
}

function engagementBrief(b: Bundle): string {
  const c = b.client;
  return [
    `Client: ${c.name}${c.registration_no ? ` (${c.registration_no})` : ""}`,
    `Financial year: ${b.engagement.fy_start} to ${b.engagement.fy_end}`,
    `Reporting framework: ${c.framework}`,
    `Principal activity: ${c.principal_activity ?? "not recorded"}`,
    `Directors: ${c.directors.join(", ") || "not recorded"}`,
    `Registered address: ${c.registered_address ?? "not recorded"}`,
    `Business address: ${c.business_address ?? "not recorded"}`,
    `Key contact: ${c.contact_person ?? "not recorded"} ${c.contact_phone ?? ""} ${c.contact_email ?? ""}`.trim(),
    `Engagement audit fee: ${b.engagement.audit_fee !== null ? `RM${Number(b.engagement.audit_fee).toFixed(2)}` : "not recorded"}`,
    `Reporting deadline: ${b.engagement.reporting_deadline ?? "not recorded"}`,
  ].join("\n");
}

function etbJson(b: Bundle) {
  if (!b.etb) return "[]";
  return JSON.stringify(
    b.etb.rows.map((r) => ({
      fs_group: r.fs_group,
      fs_caption: r.fs_caption,
      wp_ref: r.wp_ref,
      py_audited: r.py === null ? null : fromCents(r.py),
      cy_per_client: fromCents(r.cy_client),
      adjustments_dr: fromCents(r.adj_dr),
      adjustments_cr: fromCents(r.adj_cr),
      adjustment_refs: r.adj_refs,
      cy_audited: fromCents(r.cy_audited),
      accounts: r.accounts.map((a) => ({ account: a.account_name, cy: fromCents(a.cy), py_per_client: a.py_client === null ? null : fromCents(a.py_client) })),
    })),
    null,
    1,
  );
}

function materialityText(b: Bundle) {
  const m = b.materiality;
  if (!m) return "Not yet computed.";
  const f = m.final ?? m.draft;
  return [
    `Firm method (${m.final ? "final" : "draft"}): materiality RM${formatRM(f.materiality)}, performance materiality RM${formatRM(f.performance)}, SAD threshold RM${formatRM(f.sad)}.`,
    `ISA 320 view: ${m.isa.benchmark} x ${(m.isa.rate * 100).toFixed(1)}% = RM${formatRM(m.isa.materiality)}; performance RM${formatRM(m.isa.performance)}; clearly trivial RM${formatRM(m.isa.clearlyTrivial)}.`,
    `Method selected for this engagement: ${m.selected === "firm" ? "firm method" : "ISA 320 benchmark"}. Risk level: ${m.riskLevel}.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Step 1: read the client's statements and build a balanced trial balance
// ---------------------------------------------------------------------------
async function stepExtract(supabase: SupabaseClient, b: Bundle, runId: string): Promise<StepOutcome> {
  const docs = signedOnly(b, ["cy_bs", "cy_pl", "cy_tb"]);
  const hasTb = docs.some((d) => d.kind === "cy_tb");
  const hasPair = docs.some((d) => d.kind === "cy_bs") && docs.some((d) => d.kind === "cy_pl");
  if (!hasTb && !hasPair) throw new PipelineBlocked("Upload and sign off the current-year balance sheet and profit and loss account (or a trial balance) first.");
  if (b.tbLines.some((l) => l.verified_by)) throw new PipelineBlocked("The trial balance mapping has already been verified by staff. Re-reading the statements would discard verified work, so it is locked.");
  if (b.adjustments.some((a) => a.status !== "proposed")) throw new PipelineBlocked("Adjustments have already been decided on this trial balance. Re-reading the statements is locked.");

  const usage: AiUsage[] = [];
  const extractions: { doc: DocumentRow; ex: StatementExtraction; checks: CheckResult[] }[] = [];
  for (const doc of docs) {
    const buf = await downloadVerified(supabase, doc);
    const blocks = await toContentBlocks(doc, buf);
    const intro: ContentBlock = { type: "text", text: `${engagementBrief(b)}\n\nTranscribe the following document (${doc.kind}).` };
    let r = await callStructured({ step: "extract", stepPrompt: EXTRACT_PROMPT, content: [intro, ...blocks], schema: StatementExtraction });
    usage.push(r.usage);
    let checks = checkStatement(r.data);
    let failures = describeFailures(checks);
    if (failures.length) {
      r = await callStructured({
        step: "extract",
        stepPrompt: EXTRACT_PROMPT,
        content: [intro, ...blocks, { type: "text", text: `Your previous transcription:\n${JSON.stringify(r.data)}\n\n${EXTRACT_RETRY_PROMPT(failures)}` }],
        schema: StatementExtraction,
      });
      usage.push(r.usage);
      checks = checkStatement(r.data);
      failures = describeFailures(checks);
    }
    extractions.push({ doc, ex: r.data, checks });
  }

  const bs = extractions.find((e) => e.ex.statement_type === "balance_sheet");
  const pl = extractions.find((e) => e.ex.statement_type === "profit_and_loss");
  const cross = bs && pl ? crossCheck(bs.ex, pl.ex) : [];
  const tb = buildTrialBalance(extractions.map((e) => e.ex));

  for (const e of extractions) {
    const { error } = await supabase.from("extractions").insert({
      engagement_id: b.engagement.id, document_id: e.doc.id, run_id: runId, statement: e.ex.statement_type,
      data: e.ex, checks: e.checks, passed: e.checks.every((c) => c.passed),
    });
    if (error) throw new Error(error.message);
  }

  // Replace unverified TB lines and any AI-proposed entries built on the old TB
  await supabase.from("adjustments").delete().eq("engagement_id", b.engagement.id).eq("status", "proposed").eq("source", "ai");
  const del = await supabase.from("tb_lines").delete().eq("engagement_id", b.engagement.id);
  if (del.error) throw new Error(del.error.message);
  const docFor = (src: string) => extractions.find((e) => e.ex.statement_type === src)?.doc.id ?? null;
  const ins = await supabase.from("tb_lines").insert(
    tb.lines.map((l, i) => ({
      engagement_id: b.engagement.id, source_document_id: docFor(l.source), line_no: i + 1, account_name: l.account_name,
      statement: l.statement, section: l.section, cy_amount: fromCents(l.cy), py_client_amount: l.py === null ? null : fromCents(l.py),
    })),
  );
  if (ins.error) throw new Error(ins.error.message);

  const allChecks = [...extractions.flatMap((e) => e.checks), ...cross];
  const failed = describeFailures(allChecks);
  const ok = failed.length === 0 && tb.balance === 0;
  return {
    status: ok ? "succeeded" : "needs_review",
    summary: ok
      ? `Read ${extractions.length} statement(s). Re-performed ${allChecks.length} casting and tie-out checks: all agree to the sen. Trial balance of ${tb.lines.length} accounts nets to nil.`
      : `Read ${extractions.length} statement(s). ${failed.length} check(s) do not agree${tb.balance !== 0 ? `; trial balance is out by RM${formatRM(tb.balance, { dashForZero: false })}` : ""}. Compare the transcription with the source before continuing.`,
    output: {
      checks: allChecks,
      failures: failed,
      tb_balance: fromCents(tb.balance),
      tb_balance_py: tb.balancePy === null ? null : fromCents(tb.balancePy),
      notes: extractions.flatMap((e) => e.ex.transcription_notes.map((n) => `${e.doc.filename}: ${n}`)),
    },
    usage,
  };
}

// ---------------------------------------------------------------------------
// Step 2: map accounts to captions and lead schedules; prior-year balances
// ---------------------------------------------------------------------------
async function stepMap(supabase: SupabaseClient, b: Bundle): Promise<StepOutcome> {
  if (!b.tbLines.length) throw new PipelineBlocked("There is no trial balance yet. Run step 1 first.");
  const pyDocs = signedOnly(b, ["py_fs", "py_awp"]);
  const tbJson = JSON.stringify(
    b.tbLines.map((l) => ({ line_no: l.line_no, account_name: l.account_name, statement: l.statement, section_on_client_statement: l.section, cy_balance: l.cy_amount, py_per_client: l.py_client_amount })),
    null,
    1,
  );
  const content: ContentBlock[] = [
    { type: "text", text: `${engagementBrief(b)}\n\nCurrent-year trial balance (debit positive, credit negative):\n${tbJson}\n\nAllowed lead references: ${LEAD_REFS.join(", ")}` },
    ...(await loadDocs(supabase, pyDocs)),
    { type: "text", text: pyDocs.length ? "Prior-year audited sources are attached above." : "No prior-year audited source has been uploaded." },
  ];
  const { data, usage } = await callStructured({ step: "map", stepPrompt: MAP_PROMPT, content, schema: MappingResult });

  const issues: string[] = [];
  const byLine = new Map(data.mappings.map((m) => [m.line_no, m]));
  for (const l of b.tbLines) {
    if (l.verified_by) continue;
    const m = byLine.get(l.line_no);
    if (!m) {
      issues.push(`Line ${l.line_no} (${l.account_name}) was not mapped.`);
      continue;
    }
    const flags = [...m.mapping_flags];
    if (!LEAD_REFS.includes(m.wp_ref)) flags.push(`Lead reference "${m.wp_ref}" is not in the firm index.`);
    const cy = toCents(l.cy_amount);
    if (cy !== 0 && Math.sign(cy) !== GROUP_NORMAL_SIGN[m.fs_group as FsGroup] && !flags.some((f) => /reclass|abnormal|opposite|debit|credit/i.test(f))) {
      flags.push(`Balance is opposite to the normal balance for ${m.fs_group}.`);
    }
    if (m.confidence < 0.8 && !flags.length) flags.push("Low confidence mapping.");
    const { error } = await supabase
      .from("tb_lines")
      .update({ fs_caption: m.fs_caption, fs_group: m.fs_group, wp_ref: m.wp_ref, mapping_rationale: m.rationale, mapping_confidence: Math.max(0, Math.min(1, m.confidence)), mapping_flags: flags, mapped_by: "ai" })
      .eq("id", l.id);
    if (error) throw new Error(error.message);
    if (flags.length) issues.push(`${l.account_name}: ${flags.join(" ")}`);
  }

  await supabase.from("py_balances").delete().eq("engagement_id", b.engagement.id);
  let pyRows: Record<string, unknown>[];
  if (data.py_balances.length) {
    pyRows = data.py_balances.map((p) => ({ engagement_id: b.engagement.id, fs_caption: p.fs_caption, fs_group: p.fs_group, wp_ref: p.wp_ref, amount: p.amount, note: p.source, source_document_id: pyDocs[0]?.id ?? null }));
  } else {
    const agg = new Map<string, { group: string; ref: string; amount: number }>();
    for (const l of b.tbLines) {
      const m = byLine.get(l.line_no);
      if (!m || l.py_client_amount === null) continue;
      const k = m.fs_caption;
      const cur = agg.get(k) ?? { group: m.fs_group, ref: m.wp_ref, amount: 0 };
      cur.amount += toCents(l.py_client_amount);
      agg.set(k, cur);
    }
    pyRows = [...agg.entries()].map(([k, v]) => ({ engagement_id: b.engagement.id, fs_caption: k, fs_group: v.group, wp_ref: v.ref, amount: fromCents(v.amount), note: "Client comparative, not agreed to audited financial statements" }));
    issues.push("No prior-year audited source: comparatives are the client's own figures and are not yet agreed to the audited report (#).");
  }
  if (pyRows.length) {
    const { error } = await supabase.from("py_balances").insert(pyRows);
    if (error) throw new Error(error.message);
  }

  const reLine = b.tbLines.find((l) => byLine.get(l.line_no)?.fs_caption.toLowerCase().includes("retained"));
  const tbReBf = reLine ? -Number(reLine.cy_amount) : null;
  const pyReCf = data.opening_balance_test.py_retained_earnings_cf;
  const diff = tbReBf !== null && pyReCf !== null ? fromCents(toCents(tbReBf) - toCents(pyReCf)) : null;
  if (diff !== null && diff !== 0) issues.push(`Opening retained earnings per ledger differ from prior-year audited closing balance by RM${diff.toFixed(2)} (DA3).`);
  await supabase
    .from("engagements")
    .update({ settings: { ...b.settings, opening_balance_test: { tb_re_bf: tbReBf, py_re_cf: pyReCf, difference: diff, source: data.opening_balance_test.source } } })
    .eq("id", b.engagement.id);

  return {
    status: issues.length ? "needs_review" : "succeeded",
    summary: `Mapped ${data.mappings.length} accounts to ${new Set(data.mappings.map((m) => m.fs_caption)).size} captions. ${issues.length ? `${issues.length} item(s) need a reviewer's attention.` : "No exceptions."} Staff must verify every mapping before adjustments are proposed.`,
    output: { issues, notes: data.notes, py_balances: data.py_balances.length },
    usage: [usage],
  };
}

// ---------------------------------------------------------------------------
// Step 3: propose AJEs / RJEs and the tax computation
// ---------------------------------------------------------------------------
async function stepAdjust(supabase: SupabaseClient, b: Bundle, actor: Profile): Promise<StepOutcome> {
  if (!b.mapped) throw new PipelineBlocked("Every account must be mapped before adjustments are proposed.");
  if (!b.verified) throw new PipelineBlocked(`Staff must verify every account mapping first (${b.tbLines.filter((l) => !l.verified_by).length} not yet verified).`);
  const evidence = signedOnly(b, ["py_fs", "py_awp", "py_planning", "cy_gl", "supporting"]);
  const kept = b.adjustments.filter((a) => !(a.source === "ai" && a.status === "proposed"));
  const nextAje = Math.max(0, ...kept.filter((a) => a.kind === "AJE").map((a) => Number(/\d+/.exec(a.ref)?.[0] ?? 0))) + 1;
  const nextRje = Math.max(0, ...kept.filter((a) => a.kind === "RJE").map((a) => Number(/\d+/.exec(a.ref)?.[0] ?? 0))) + 1;
  const content: ContentBlock[] = [
    {
      type: "text",
      text: `${engagementBrief(b)}\n\nMateriality:\n${materialityText(b)}\n\nExtended trial balance before your entries (RM; debit positive):\n${etbJson(b)}\n\nEntries already recorded by staff (do not duplicate): ${JSON.stringify(kept.map((a) => ({ ref: a.ref, status: a.status, description: a.description })))}\nNumber new AJEs from "AJE ${nextAje}" and RJEs from "RJE ${nextRje}".`,
    },
    ...(await loadDocs(supabase, evidence)),
  ];
  const { data, usage } = await callStructured({ step: "adjust", stepPrompt: ADJUST_PROMPT, content, schema: AdjustResult });

  await supabase.from("adjustments").delete().eq("engagement_id", b.engagement.id).eq("status", "proposed").eq("source", "ai");
  const rejected: string[] = [];
  const rows = [];
  const usedRefs = new Set(kept.map((a) => a.ref));
  for (const e of data.entries) {
    const lines = e.lines.map((l) => ({ ...l, dr: fromCents(toCents(l.dr)), cr: fromCents(toCents(l.cr)) }));
    const asInput = adjustmentToInput({ ...e, lines, status: "accepted" } as never);
    if (!adjustmentBalances(asInput)) {
      rejected.push(`${e.ref} does not balance and was discarded: ${e.description}`);
      continue;
    }
    if (usedRefs.has(e.ref)) {
      rejected.push(`${e.ref} duplicates an existing reference and was discarded.`);
      continue;
    }
    usedRefs.add(e.ref);
    rows.push({
      engagement_id: b.engagement.id, ref: e.ref, kind: e.kind, description: e.description,
      rationale: `${e.rationale}\nEffect on profit before tax: RM${e.pbt_effect.toFixed(2)}`, evidence: e.evidence,
      source: "ai", status: "proposed", lines, total: fromCents(sum(asInput.lines.map((l) => l.dr))), proposed_by: actor.id,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("adjustments").insert(rows);
    if (error) throw new Error(error.message);
  }

  // Deterministic tax recomputation from the AI's chargeable income
  const tc = data.tax_computation;
  const computed = taxOnChargeableIncome(toCents(tc.chargeable_income), tc.rate_basis);
  const recordedTax = b.etb ? sum(b.etb.rows.filter((r) => r.fs_group === "Taxation").map((r) => r.cy_client)) : 0;
  const proposedTax = sum(
    rows.flatMap((r) => (r.lines as { fs_group: string; dr: number; cr: number }[]).filter((l) => l.fs_group === "Taxation").map((l) => toCents(l.dr) - toCents(l.cr))),
  );
  const warnings = [...rejected];
  if (Math.abs(recordedTax + proposedTax - computed.tax) > 100) {
    warnings.push(
      `Tax expense after proposed entries (RM${formatRM(recordedTax + proposedTax, { dashForZero: false })}) does not equal tax recomputed on chargeable income (RM${formatRM(computed.tax, { dashForZero: false })}). Check the tax AJE and any prior-year under/over provision.`,
    );
  }
  await supabase
    .from("engagements")
    .update({ tax_computation: { ...tc, computed_tax: fromCents(computed.tax), bands: computed.bands.map((x) => ({ amount: fromCents(x.amount), rate: x.rate, tax: fromCents(x.tax) })), computed_at: new Date().toISOString() } })
    .eq("id", b.engagement.id);

  if (data.audit_matters.length) {
    await supabase.from("review_points").insert(
      data.audit_matters.map((m) => ({ engagement_id: b.engagement.id, wp_ref: m.wp_ref, body: `[AI] ${m.matter}\nEvidence needed: ${m.evidence_needed}` })),
    );
  }

  return {
    status: warnings.length ? "needs_review" : "succeeded",
    summary: `Proposed ${rows.length} adjusting/reclassification entr${rows.length === 1 ? "y" : "ies"} and a draft tax computation (chargeable income RM${formatRM(toCents(tc.chargeable_income), { dashForZero: false })}, tax RM${formatRM(computed.tax, { dashForZero: false })}). ${data.audit_matters.length} matter(s) raised as review points. Each entry must be accepted or rejected by staff.`,
    output: { warnings, audit_matters: data.audit_matters, tax_open_points: tc.open_points },
    usage: [usage],
  };
}

// ---------------------------------------------------------------------------
// Step 4: analytical review, going concern, related parties
// ---------------------------------------------------------------------------
async function upsertPaper(supabase: SupabaseClient, b: Bundle, ref: string, content: Record<string, unknown>) {
  const existing = b.papers.find((p) => p.ref === ref);
  if (existing && existing.status !== "draft") return false;
  const { error } = await supabase
    .from("working_papers")
    .upsert({ engagement_id: b.engagement.id, ref, title: indexTitle(ref), content, updated_at: new Date().toISOString() }, { onConflict: "engagement_id,ref" });
  if (error) throw new Error(error.message);
  return true;
}

async function stepAnalyse(supabase: SupabaseClient, b: Bundle): Promise<StepOutcome> {
  const pending = b.adjustments.filter((a) => a.status === "proposed");
  if (pending.length) throw new PipelineBlocked(`Decide every proposed entry first (${pending.map((a) => a.ref).join(", ")} still proposed).`);
  if (!b.etb) throw new PipelineBlocked("The extended trial balance is not available.");
  if (!b.etb.balanced) throw new PipelineBlocked("The extended trial balance does not balance. Resolve this before analytical review.");
  const flagged = b.etb.rows.filter((r) => r.flagged);
  const supporting = signedOnly(b, ["supporting", "py_fs"]);
  const content: ContentBlock[] = [
    {
      type: "text",
      text: `${engagementBrief(b)}\n\nMateriality:\n${materialityText(b)}\n\nFinal extended trial balance (RM; debit positive):\n${etbJson(b)}\n\nFlagged movements to explain: ${JSON.stringify(flagged.map((r) => ({ fs_caption: r.fs_caption, py: r.py === null ? null : fromCents(r.py), cy_audited: fromCents(r.cy_audited), movement: r.movement === null ? null : fromCents(r.movement), movement_pct: r.movement_pct })))}\n\nKey totals: revenue RM${formatRM(b.etb.totals.revenue_audited)}, profit before tax RM${formatRM(b.etb.totals.pbt_audited, { dashForZero: false })}, total assets RM${formatRM(b.etb.totals.total_assets_audited)}.`,
    },
    ...(await loadDocs(supabase, supporting)),
  ];
  const { data, usage } = await callStructured({ step: "analyse", stepPrompt: ANALYSE_PROMPT, content, schema: AnalyseResult });
  await upsertPaper(supabase, b, "DE", { movements: data.movements, overall_conclusion: data.overall_conclusion, generated_at: new Date().toISOString() });
  await upsertPaper(supabase, b, "BD", { going_concern: data.going_concern, subsequent_events: data.subsequent_events, related_parties: data.related_parties, generated_at: new Date().toISOString() });
  return {
    status: data.going_concern.material_uncertainty === "no" ? "succeeded" : "needs_review",
    summary: `Explained ${data.movements.length} of ${flagged.length} flagged movement(s). Going concern: ${data.going_concern.material_uncertainty === "no" ? "no material uncertainty identified" : `${data.going_concern.material_uncertainty} material uncertainty; evidence required`}. ${data.related_parties.length} related-party item(s) listed.`,
    output: { flagged: flagged.length, going_concern: data.going_concern.material_uncertainty },
    usage: [usage],
  };
}

// ---------------------------------------------------------------------------
// Step 5: draft the narrative working papers
// ---------------------------------------------------------------------------
async function stepPapers(supabase: SupabaseClient, b: Bundle): Promise<StepOutcome> {
  if (!b.etb) throw new PipelineBlocked("The extended trial balance is not available.");
  const evidence = signedOnly(b, ["py_planning", "py_awp", "supporting"]);
  const accepted = b.adjustments.filter((a) => a.status === "accepted" || a.status === "uncorrected");
  const leadRefs = [...new Set(b.etb.rows.map((r) => r.wp_ref))];
  const de = b.papers.find((p) => p.ref === "DE")?.content ?? {};
  const bd = b.papers.find((p) => p.ref === "BD")?.content ?? {};
  const content: ContentBlock[] = [
    {
      type: "text",
      text: [
        engagementBrief(b),
        `Materiality:\n${materialityText(b)}`,
        `Final extended trial balance (RM):\n${etbJson(b)}`,
        `Adjustments decided: ${JSON.stringify(accepted.map((a) => ({ ref: a.ref, status: a.status, description: a.description, lines: a.lines })))}`,
        `Tax computation: ${JSON.stringify(b.engagement.tax_computation ?? null)}`,
        `Analytical review (DE): ${JSON.stringify(de)}`,
        `Going concern, subsequent events, related parties (BD): ${JSON.stringify(bd)}`,
        `Opening balance test (DA3): ${JSON.stringify(b.settings.opening_balance_test ?? null)}`,
        `Lead schedules required: ${leadRefs.join(", ")}`,
        `Uploaded evidence on file: ${b.documents.filter((d) => d.status === "signed").map((d) => `${d.filename} [${d.kind}]`).join("; ")}`,
      ].join("\n\n"),
    },
    ...(await loadDocs(supabase, evidence)),
  ];
  const { data, usage } = await callStructured({ step: "papers", stepPrompt: PAPERS_PROMPT, content, schema: PapersResult });
  let written = 0;
  let skipped = 0;
  const put = async (ref: string, c: Record<string, unknown>) => ((await upsertPaper(supabase, b, ref, { ...c, generated_at: new Date().toISOString() })) ? written++ : skipped++);
  await put("AA", { sections: data.planning });
  await put("AC", { risks: data.risk_assessment });
  for (const ls of data.lead_schedules) {
    if (!leadRefs.includes(ls.wp_ref)) continue;
    await put(ls.wp_ref, ls);
  }
  await put("BA", { ...data.completion });
  const missing = leadRefs.filter((r) => !data.lead_schedules.some((l) => l.wp_ref === r));
  return {
    status: missing.length ? "needs_review" : "succeeded",
    summary: `Drafted ${written} working paper(s)${skipped ? `; ${skipped} already marked prepared or reviewed were left untouched` : ""}.${missing.length ? ` No narrative returned for ${missing.join(", ")}.` : ""}`,
    output: { missing },
    usage: [usage],
  };
}

// ---------------------------------------------------------------------------

export async function runStep(supabase: SupabaseClient, engagementId: string, step: PipelineStep, actor: Profile) {
  const b = await loadBundle(supabase, engagementId);
  if (!b) throw new PipelineBlocked("Engagement not found.");
  if (b.engagement.status === "locked") throw new PipelineBlocked("This engagement is locked after partner sign-off.");
  const req = REQUIRES[step];
  if (req) {
    const prev = latestRun(b, req);
    if (!prev || (prev.status !== "succeeded" && prev.status !== "needs_review")) {
      throw new PipelineBlocked(`Run "${req}" successfully before "${step}".`);
    }
  }
  const { data: run, error } = await supabase
    .from("pipeline_runs")
    .insert({ engagement_id: engagementId, step, status: "running", model: AI_MODEL })
    .select("id")
    .single<{ id: string }>();
  if (error || !run) throw new Error(error?.message ?? "Could not start run");

  try {
    let outcome: StepOutcome;
    if (step === "extract") outcome = await stepExtract(supabase, b, run.id);
    else if (step === "map") outcome = await stepMap(supabase, b);
    else if (step === "adjust") outcome = await stepAdjust(supabase, b, actor);
    else if (step === "analyse") outcome = await stepAnalyse(supabase, b);
    else outcome = await stepPapers(supabase, b);

    const inTok = outcome.usage.reduce((a, u) => a + u.input_tokens, 0);
    const outTok = outcome.usage.reduce((a, u) => a + u.output_tokens, 0);
    await supabase
      .from("pipeline_runs")
      .update({ status: outcome.status, finished_at: new Date().toISOString(), summary: outcome.summary, output: outcome.output, input_tokens: inTok, output_tokens: outTok, model: outcome.usage[0]?.model ?? AI_MODEL })
      .eq("id", run.id);
    if (b.engagement.status === "planning") await supabase.from("engagements").update({ status: "fieldwork" }).eq("id", engagementId);
    await logEvent(supabase, `pipeline.${step}`, { entityType: "pipeline_runs", entityId: run.id, engagementId, details: { status: outcome.status, summary: outcome.summary, input_tokens: inTok, output_tokens: outTok } });
    return { runId: run.id, status: outcome.status, summary: outcome.summary };
  } catch (e) {
    const message = e instanceof PipelineBlocked || e instanceof AiError || e instanceof IntegrityError ? e.message : `Unexpected error: ${(e as Error).message}`;
    await supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    await logEvent(supabase, `pipeline.${step}.failed`, { entityType: "pipeline_runs", entityId: run.id, engagementId, details: { error: message } });
    return { runId: run.id, status: "failed" as const, summary: message };
  }
}
