import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdjustmentRow, Client, DocumentRow, Engagement, PipelineRun, Profile, PyBalanceRow,
  ReviewPointRow, SignoffRow, TbLineRow, WorkingPaperRow,
} from "../db-types";
import { buildEtb, type Etb, type AdjustmentInput } from "../audit/etb";
import { toCents } from "../audit/money";
import {
  firmMateriality, isaMateriality, suggestProfile, type MaterialityRecord, type EntityProfile,
} from "../audit/materiality";
import type { FsGroup } from "../audit/catalog";

export interface EngagementSettings {
  materiality_method?: "firm" | "isa320";
  materiality_reason?: string;
  risk_level?: "low" | "moderate" | "high";
  entity_profile?: EntityProfile;
  opening_balance_test?: { tb_re_bf: number | null; py_re_cf: number | null; difference: number | null; source: string | null };
}

export interface Bundle {
  engagement: Engagement;
  settings: EngagementSettings;
  client: Client;
  documents: DocumentRow[];
  tbLines: TbLineRow[];
  pyBalances: PyBalanceRow[];
  adjustments: AdjustmentRow[];
  papers: WorkingPaperRow[];
  reviewPoints: ReviewPointRow[];
  signoffs: SignoffRow[];
  runs: PipelineRun[];
  people: Map<string, Profile>;
  mapped: boolean;
  verified: boolean;
  etb: Etb | null;
  materiality: MaterialityRecord | null;
}

export function adjustmentToInput(a: AdjustmentRow): AdjustmentInput {
  return {
    ref: a.ref,
    kind: a.kind,
    description: a.description,
    status: a.status,
    lines: a.lines.map((l) => ({ account: l.account, fs_caption: l.fs_caption, fs_group: l.fs_group, wp_ref: l.wp_ref, dr: toCents(l.dr), cr: toCents(l.cr) })),
  };
}

export async function loadBundle(supabase: SupabaseClient, engagementId: string): Promise<Bundle | null> {
  const { data: engagement } = await supabase.from("engagements").select("*").eq("id", engagementId).maybeSingle<Engagement>();
  if (!engagement) return null;
  const [client, documents, tbLines, pyBalances, adjustments, papers, reviewPoints, signoffs, runs, people] = await Promise.all([
    supabase.from("clients").select("*").eq("id", engagement.client_id).single<Client>(),
    supabase.from("documents").select("*").eq("engagement_id", engagementId).order("uploaded_at", { ascending: true }),
    supabase.from("tb_lines").select("*").eq("engagement_id", engagementId).order("line_no"),
    supabase.from("py_balances").select("*").eq("engagement_id", engagementId),
    supabase.from("adjustments").select("*").eq("engagement_id", engagementId).order("created_at"),
    supabase.from("working_papers").select("*").eq("engagement_id", engagementId).order("ref"),
    supabase.from("review_points").select("*").eq("engagement_id", engagementId).order("raised_at"),
    supabase.from("signoffs").select("*").eq("engagement_id", engagementId).order("signed_at"),
    supabase.from("pipeline_runs").select("*").eq("engagement_id", engagementId).order("started_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  return assembleBundle({
    engagement,
    client: client.data as Client,
    documents: (documents.data ?? []) as DocumentRow[],
    tbLines: (tbLines.data ?? []) as TbLineRow[],
    pyBalances: (pyBalances.data ?? []) as PyBalanceRow[],
    adjustments: (adjustments.data ?? []) as AdjustmentRow[],
    papers: (papers.data ?? []) as WorkingPaperRow[],
    reviewPoints: (reviewPoints.data ?? []) as ReviewPointRow[],
    signoffs: (signoffs.data ?? []) as SignoffRow[],
    runs: (runs.data ?? []) as PipelineRun[],
    people: (people.data ?? []) as Profile[],
  });
}

export interface RawBundle {
  engagement: Engagement;
  client: Client;
  documents: DocumentRow[];
  tbLines: TbLineRow[];
  pyBalances: PyBalanceRow[];
  adjustments: AdjustmentRow[];
  papers: WorkingPaperRow[];
  reviewPoints: ReviewPointRow[];
  signoffs: SignoffRow[];
  runs: PipelineRun[];
  people: Profile[];
}

/** Pure: derive ETB and materiality from stored rows. */
export function assembleBundle(raw: RawBundle): Bundle {
  const { engagement } = raw;
  const settings = (engagement.settings ?? {}) as EngagementSettings;
  const tb = raw.tbLines;
  const adj = [...raw.adjustments].sort((a, b) => refOrder(a.ref) - refOrder(b.ref));
  const py = raw.pyBalances;
  const client = { data: raw.client };
  const mapped = tb.length > 0 && tb.every((l) => l.fs_caption && l.fs_group && l.wp_ref);
  const verified = mapped && tb.every((l) => l.verified_by);

  let etb: Etb | null = null;
  let materiality: MaterialityRecord | null = null;
  if (mapped) {
    const tbInput = tb.map((l) => ({
      id: l.id, line_no: l.line_no, account_name: l.account_name, cy: toCents(l.cy_amount),
      py_client: l.py_client_amount === null ? null : toCents(l.py_client_amount),
      fs_caption: l.fs_caption!, fs_group: l.fs_group!, wp_ref: l.wp_ref!,
    }));
    const pyInput = py.filter((p) => p.fs_group).map((p) => ({ fs_caption: p.fs_caption, fs_group: p.fs_group as FsGroup, wp_ref: p.wp_ref ?? "", amount: toCents(p.amount) }));
    const clientOnly = buildEtb(tbInput, [], pyInput, null);
    const inputsDraft = { turnover: clientOnly.totals.revenue_client, pbt: clientOnly.totals.pbt_client, grossAssets: clientOnly.totals.total_assets_client };
    const draft = firmMateriality(inputsDraft);
    const decided = adj.length > 0 && adj.every((a) => a.status !== "proposed");
    const withAdj = buildEtb(tbInput, adj.map(adjustmentToInput), pyInput, null);
    const final = decided
      ? firmMateriality({ turnover: withAdj.totals.revenue_audited, pbt: withAdj.totals.pbt_audited, grossAssets: withAdj.totals.total_assets_audited })
      : null;
    const risk = settings.risk_level ?? "low";
    const profile = settings.entity_profile ?? suggestProfile(inputsDraft, client.data?.principal_activity ?? null);
    const isa = isaMateriality(decided ? { turnover: withAdj.totals.revenue_audited, pbt: withAdj.totals.pbt_audited, grossAssets: withAdj.totals.total_assets_audited } : inputsDraft, profile, risk);
    materiality = { draft, final, isa, selected: settings.materiality_method ?? "firm", selectedReason: settings.materiality_reason ?? null, riskLevel: risk };
    const f = materiality.selected === "isa320" ? { sad: isa.clearlyTrivial, pm: isa.performance } : { sad: (final ?? draft).sad, pm: (final ?? draft).performance };
    etb = buildEtb(tbInput, adj.map(adjustmentToInput), pyInput, f);
  }

  return {
    engagement,
    settings,
    client: raw.client,
    documents: raw.documents,
    tbLines: tb,
    pyBalances: py,
    adjustments: adj,
    papers: raw.papers,
    reviewPoints: raw.reviewPoints,
    signoffs: raw.signoffs,
    runs: raw.runs,
    people: new Map(raw.people.map((p) => [p.id, p])),
    mapped,
    verified,
    etb,
    materiality,
  };
}

export function refOrder(ref: string): number {
  const m = /^(AJE|RJE)\s*(\d+)/i.exec(ref);
  if (!m) return 10_000;
  return (m[1].toUpperCase() === "AJE" ? 0 : 1000) + Number(m[2]);
}

export function latestRun(b: Bundle, step: PipelineRun["step"]): PipelineRun | undefined {
  return b.runs.find((r) => r.step === step);
}

export function initialsOf(b: Bundle, id: string | null | undefined): string {
  if (!id) return "";
  return b.people.get(id)?.initials ?? "";
}
