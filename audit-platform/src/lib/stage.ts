import type { PipelineRun, SignoffRow, DocumentRow, AdjustmentRow, TbLineRow } from "./db-types";

export const STAGES = [
  { key: "documents", label: "Upload and sign documents" },
  { key: "extract", label: "Read statements" },
  { key: "map", label: "Map and verify accounts" },
  { key: "adjust", label: "Propose and decide adjustments" },
  { key: "analyse", label: "Analytical review" },
  { key: "papers", label: "Draft working papers" },
  { key: "signoff", label: "Review and sign-off" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

export interface StageInput {
  status: string;
  documents: Pick<DocumentRow, "kind" | "status">[];
  runs: Pick<PipelineRun, "step" | "status">[]; // newest first
  tbLines?: Pick<TbLineRow, "verified_by" | "fs_caption">[];
  adjustments?: Pick<AdjustmentRow, "status">[];
  signoffs: Pick<SignoffRow, "stage">[];
}

const done = (runs: StageInput["runs"], step: string) => {
  const r = runs.find((x) => x.step === step);
  return r && (r.status === "succeeded" || r.status === "needs_review");
};

/** The first stage that still needs work, and a one-line next action. */
export function currentStage(e: StageInput): { key: StageKey | "locked"; index: number; next: string } {
  if (e.status === "locked") return { key: "locked", index: STAGES.length, next: "Locked after partner sign-off" };
  const signed = e.documents.filter((d) => d.status === "signed");
  const hasInputs = signed.some((d) => d.kind === "cy_tb") || (signed.some((d) => d.kind === "cy_bs") && signed.some((d) => d.kind === "cy_pl"));
  const unsigned = e.documents.filter((d) => d.status === "awaiting_signoff").length;
  if (!hasInputs || unsigned) return { key: "documents", index: 0, next: unsigned ? `${unsigned} file(s) awaiting staff sign-off` : "Upload the balance sheet and P&L" };
  if (!done(e.runs, "extract")) return { key: "extract", index: 1, next: "Run: read statements" };
  const tb = e.tbLines ?? [];
  if (!done(e.runs, "map") || (tb.length && tb.some((l) => !l.fs_caption))) return { key: "map", index: 2, next: "Run: map accounts" };
  if (tb.length && tb.some((l) => !l.verified_by)) return { key: "map", index: 2, next: `Verify ${tb.filter((l) => !l.verified_by).length} account mapping(s)` };
  if (!done(e.runs, "adjust")) return { key: "adjust", index: 3, next: "Run: propose adjustments" };
  const pending = (e.adjustments ?? []).filter((a) => a.status === "proposed").length;
  if (pending) return { key: "adjust", index: 3, next: `Decide ${pending} proposed entr${pending === 1 ? "y" : "ies"}` };
  if (!done(e.runs, "analyse")) return { key: "analyse", index: 4, next: "Run: analytical review" };
  if (!done(e.runs, "papers")) return { key: "papers", index: 5, next: "Run: draft working papers" };
  const s = new Set(e.signoffs.map((x) => x.stage));
  if (!s.has("preparer")) return { key: "signoff", index: 6, next: "Preparer sign-off" };
  if (!s.has("reviewer")) return { key: "signoff", index: 6, next: "Manager review sign-off" };
  return { key: "signoff", index: 6, next: "Partner sign-off" };
}
