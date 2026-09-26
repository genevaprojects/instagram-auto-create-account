import assert from "node:assert/strict";
import { qualityChecks, qualityBlockers } from "../src/lib/audit/quality";
import { PROGRAMMES, programmesText } from "../src/lib/audit/programmes";
import { MODULES, publicQuestions } from "../src/lib/training";
import { WP_INDEX } from "../src/lib/audit/catalog";
import { assembleBundle } from "../src/lib/pipeline/bundle";
import { sampleRawBundle } from "./fixtures/sample-bundle";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`  ok  ${name}`); };

const raw = sampleRawBundle();
const bare = assembleBundle(raw);

t("quality gate blocks a file with no risk register, analytics or going-concern work", () => {
  const ids = qualityBlockers(qualityChecks(bare)).map((c) => c.id);
  for (const id of ["materiality-basis", "fraud-override", "fraud-revenue", "journal-testing", "analytics", "going-concern", "related-parties", "lead-conclusions"]) assert.ok(ids.includes(id), `expected ${id} to block`);
});

t("going-concern check reports net current liabilities from the ETB", () => {
  const gc = qualityChecks(bare).find((c) => c.id === "going-concern")!;
  assert.match(gc.detail, /net current liabilities/);
});

t("abnormal tax balance after AJE 3 is flagged for reclassification", () => {
  const ab = qualityChecks(bare).find((c) => c.id === "abnormal-balances")!;
  assert.equal(ab.passed, false);
  assert.match(ab.detail, /Tax recoverable/);
});

t("a complete file passes every critical check", () => {
  const now = "2026-08-20T00:00:00.000Z";
  const paper = (ref: string, content: Record<string, unknown>) => ({ id: ref, engagement_id: "e1", ref, title: ref, content, status: "reviewed" as const, prepared_by: "u1", prepared_at: now, reviewed_by: "u2", reviewed_at: now, updated_at: now });
  const b0 = assembleBundle(raw);
  const leadRefs = [...new Set(b0.etb!.rows.map((r) => r.wp_ref))];
  const full = assembleBundle({
    ...raw,
    engagement: { ...raw.engagement, settings: { ...raw.engagement.settings, materiality_method: "isa320", materiality_reason: "Asset-holding company: users focus on the carrying amount of the property, so total assets is the benchmark." } },
    documents: [{ id: "d1", engagement_id: "e1", kind: "cy_gl", description: null, filename: "GL.xlsx", storage_path: "e1/gl", mime_type: null, size_bytes: 1, sha256: "a".repeat(64), uploaded_by: "u1", uploaded_at: now, status: "signed", signed_by: "u1", signed_name: "Senior One", signed_initials: "SNR", signed_at: now, signed_ip: null, signed_user_agent: null, declaration: "x", superseded_by: null }],
    papers: [
      paper("AC", { risks: [{ risk: "Management override of controls", response: "Journal entry testing on complete population", wp_ref: "DD" }, { risk: "Revenue recognition: rental income completeness", response: "Expectation from tenancy agreements", wp_ref: "O" }] }),
      paper("DE", { movements: b0.etb!.rows.map((r) => ({ fs_caption: r.fs_caption, explanation: "x", evidence: "y", further_work: null })) }),
      paper("BD", { going_concern: { assessment: "Directors' undertaking obtained.", material_uncertainty: "no", indicators: [], evidence_needed: [] }, subsequent_events: ["Reviewed minutes to report date."], related_parties: [{ party: "Director A" }] }),
      ...leadRefs.map((r) => paper(r, { conclusion: "Objective met. Journal testing referenced in DD.", outstanding: [] })),
    ],
  });
  const blockers = qualityBlockers(qualityChecks(full));
  assert.deepEqual(blockers.map((c) => c.id), []);
});

t("every lead programme has steps with ISA references and a key risk", () => {
  for (const p of PROGRAMMES) {
    assert.ok(WP_INDEX.some((e) => e.ref === p.ref), p.ref);
    assert.ok(p.steps.length >= 2 && p.keyRisks.length >= 1, p.ref);
    assert.ok(p.steps.every((s) => s.standard.length > 2));
  }
  assert.match(programmesText(["A1", "F"]), /Journal|journal/);
});

t("training answer keys are valid and never sent to the browser", () => {
  for (const m of MODULES) {
    assert.ok(m.questions.length >= 1 && m.sources.length >= 1, m.id);
    for (const q of m.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length, `${m.id}: ${q.q}`);
    assert.ok(!JSON.stringify(publicQuestions(m)).includes('"answer"'));
  }
  assert.equal(new Set(MODULES.map((m) => m.id)).size, MODULES.length);
});

console.log(`\n${n} quality and training checks passed`);
