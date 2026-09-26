import { getEngagement } from "@/lib/engagement-page";
import { latestRun } from "@/lib/pipeline/bundle";
import { currentStage } from "@/lib/stage";
import { PipelineRunner, type StepView } from "@/components/pipeline-runner";
import { Dl, Money, Notice, Section, when } from "@/components/ui";
import { AI_MODEL_LABEL } from "@/lib/ai/model-label";

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b } = await getEngagement(id);
  const base = `/engagements/${id}`;
  const signed = b.documents.filter((d) => d.status === "signed");
  const hasInputs = signed.some((d) => d.kind === "cy_tb") || (signed.some((d) => d.kind === "cy_bs") && signed.some((d) => d.kind === "cy_pl"));
  const unsigned = b.documents.filter((d) => d.status === "awaiting_signoff");
  const proposed = b.adjustments.filter((a) => a.status === "proposed").length;
  const unverified = b.tbLines.filter((l) => !l.verified_by).length;
  const ok = (s: string) => {
    const r = latestRun(b, s as never);
    return r && (r.status === "succeeded" || r.status === "needs_review");
  };
  const stage = currentStage({ status: b.engagement.status, documents: b.documents, runs: b.runs, tbLines: b.tbLines, adjustments: b.adjustments, signoffs: b.signoffs });

  const def: Omit<StepView, "status" | "summary" | "lastRun" | "runBy" | "tokens">[] = [
    { step: "extract", title: "Read the client's statements", description: "Transcribes the signed balance sheet and P&L line by line, then re-performs every cast and tie-out to the sen and builds a balanced trial balance.", blockedReason: unsigned.length ? `${unsigned.length} uploaded file(s) are not signed off and will not be processed.` : !hasInputs ? "Upload and sign the balance sheet and P&L first." : null, reviewHref: `${base}/trial-balance` },
    { step: "map", title: "Map accounts to captions and lead schedules", description: "Assigns each account to a DB-1/DB-2 caption and lead reference, reclassifies abnormal balances, and extracts prior-year audited balances for comparatives and the opening balance test (DA3).", blockedReason: !ok("extract") ? "Run step 1 first." : null, reviewHref: `${base}/trial-balance` },
    { step: "adjust", title: "Propose adjustments and tax computation", description: "Drafts AJEs and RJEs with evidence and arithmetic (audit fee accrual, depreciation, tax provision, cut-off) and the income tax computation. Each entry waits for a staff decision.", blockedReason: !ok("map") ? "Run step 2 first." : unverified ? `Verify ${unverified} account mapping(s) on the Trial balance tab first.` : null, reviewHref: `${base}/adjustments` },
    { step: "analyse", title: "Analytical review and completion checks", description: "Explains flagged movements against the prior year and assesses going concern, subsequent events and related parties.", blockedReason: !ok("adjust") ? "Run step 3 first." : proposed ? `Accept or reject ${proposed} proposed entr${proposed === 1 ? "y" : "ies"} first.` : null, reviewHref: `${base}/etb` },
    { step: "papers", title: "Draft the working papers", description: "Writes the planning memo, risk assessment, every lead schedule (objective, procedures, observations, conclusion) and the completion summary in the firm's format.", blockedReason: !ok("analyse") ? "Run step 4 first." : null, reviewHref: `${base}/papers` },
  ];
  const steps: StepView[] = def.map((d) => {
    const r = latestRun(b, d.step);
    return {
      ...d,
      status: r ? (r.status === "running" ? "running" : r.status) : "not_run",
      summary: r ? (r.status === "failed" ? r.error : r.summary) : null,
      lastRun: r ? when(r.started_at) : null,
      runBy: r ? b.people.get(r.started_by ?? "")?.full_name ?? "" : null,
      tokens: r?.input_tokens ? `${r.input_tokens.toLocaleString()} in / ${(r.output_tokens ?? 0).toLocaleString()} out tokens` : null,
    };
  });
  const t = b.etb?.totals;
  const m = b.materiality;
  const mf = m ? (m.selected === "isa320" ? { mat: m.isa.materiality, pm: m.isa.performance } : { mat: (m.final ?? m.draft).materiality, pm: (m.final ?? m.draft).performance }) : null;

  return (
    <div className="grid gap-x-12 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="mb-6"><Notice tone="info" title={`Next: ${stage.next}`}>Every step can be re-run until its output has been verified or decided by staff. AI output is always a draft for a named person to review.</Notice></div>
        <Section title="Processing pipeline" description={`Runs on ${AI_MODEL_LABEL}. Numbers are never taken on trust: all arithmetic is re-performed by the platform.`}>
          <PipelineRunner engagementId={id} steps={steps} locked={b.engagement.status === "locked"} />
        </Section>
      </div>
      <aside className="flex flex-col">
        <Section title="Key figures">
          {t ? (
            <Dl
              items={[
                ["Revenue", <Money key="r" cents={t.revenue_audited} />],
                ["PBT per client", <Money key="p" cents={t.pbt_client} />],
                ["PBT audited", <Money key="a" cents={t.pbt_audited} strong />],
                ["Total assets", <Money key="t" cents={t.total_assets_audited} />],
                ["Trial balance", b.etb!.balanced ? "Balances" : <span className="text-danger">Out of balance</span>],
              ]}
            />
          ) : <p className="text-sm text-ink-3">Available once the trial balance is mapped.</p>}
        </Section>
        <Section title="Materiality">
          {mf ? <Dl items={[["Overall", <Money key="m" cents={mf.mat} />], ["Performance", <Money key="pm" cents={mf.pm} />], ["Method", m!.selected === "firm" ? "Firm (AB2)" : "ISA 320"]]} /> : <p className="text-sm text-ink-3">Computed after mapping.</p>}
        </Section>
        <Section title="Evidence">
          <Dl items={[["Signed files", String(signed.length)], ["Awaiting signature", unsigned.length ? <span key="u" className="text-warn">{unsigned.length}</span> : "0"], ["Open review points", String(b.reviewPoints.filter((r) => r.status !== "cleared").length)]]} />
        </Section>
      </aside>
    </div>
  );
}
