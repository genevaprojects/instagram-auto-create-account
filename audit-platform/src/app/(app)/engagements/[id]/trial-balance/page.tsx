import { getEngagement } from "@/lib/engagement-page";
import { ALL_GROUPS, LEAD_REFS, indexTitle } from "@/lib/audit/catalog";
import { toCents, formatRM, sum } from "@/lib/audit/money";
import type { CheckResult } from "@/lib/audit/extraction";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, EmptyState, Money, Notice, Section, day } from "@/components/ui";
import { Check, X } from "lucide-react";
import { saveMapping, reopenLine } from "./actions";

export const metadata = { title: "Trial balance" };

type Extraction = { id: string; document_id: string; statement: string; checks: CheckResult[]; passed: boolean; created_at: string; data: { transcription_notes: string[] } };

export default async function TrialBalancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b, supabase } = await getEngagement(id);
  const { data: ex } = await supabase.from("extractions").select("*").eq("engagement_id", id).order("created_at", { ascending: false }).limit(6);
  const latestByDoc = new Map<string, Extraction>();
  for (const e of (ex ?? []) as Extraction[]) if (!latestByDoc.has(e.document_id)) latestByDoc.set(e.document_id, e);
  const extractions = [...latestByDoc.values()];
  const locked = b.engagement.status === "locked";
  const lines = b.tbLines;
  if (!lines.length) {
    return <EmptyState title="No trial balance yet">Sign the balance sheet and P&amp;L on the Documents tab, then run step 1 on the Overview tab.</EmptyState>;
  }
  const balance = sum(lines.map((l) => toCents(l.cy_amount)));
  const unverified = lines.filter((l) => !l.verified_by).length;
  const docName = (docId: string) => b.documents.find((d) => d.id === docId)?.filename ?? "document";
  const ob = b.settings.opening_balance_test;

  return (
    <div>
      <Section title="Transcription checks" description="The platform re-performs every total the AI transcribed. A failed check means a figure was misread or the client's statement does not cast.">
        <div className="grid gap-4 lg:grid-cols-2">
          {extractions.map((e) => {
            const failed = e.checks.filter((c) => !c.passed);
            return (
              <div key={e.id} className="rounded-md border border-rule bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{docName(e.document_id)}</p>
                  {e.passed ? <Badge tone="accent">{e.checks.length} checks agree</Badge> : <Badge tone="danger">{failed.length} of {e.checks.length} fail</Badge>}
                </div>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {e.checks.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-4">
                      <span className={`flex items-start gap-1.5 ${c.passed ? "text-ink-2" : "text-danger"}`}>{c.passed ? <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-label="Agrees" /> : <X className="mt-0.5 size-3.5 shrink-0" aria-label="Fails" />}<span>{c.label} <span className="text-ink-3"> ({c.column.toUpperCase()})</span></span></span>
                      <span className="num text-ink-3">{c.passed ? formatRM(c.expected, { dashForZero: false }) : `${formatRM(c.expected, { dashForZero: false })} vs ${formatRM(c.actual, { dashForZero: false })}`}</span>
                    </li>
                  ))}
                </ul>
                {e.data.transcription_notes?.length ? <p className="mt-3 text-xs text-ink-3">Notes: {e.data.transcription_notes.join(" ")}</p> : null}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <p>Trial balance total: <span className={`num font-semibold ${balance === 0 ? "text-accent-ink" : "text-danger"}`}>{formatRM(balance, { dashForZero: false })}</span> {balance === 0 ? "(balances)" : "(does not balance)"}</p>
          {ob ? (
            <p>
              Opening retained earnings (DA3):{" "}
              {ob.difference === null ? <span className="text-warn">prior-year audited figure not available</span> : ob.difference === 0 ? <span className="text-accent-ink">agrees to prior-year audited report</span> : <span className="text-danger">differs by RM{ob.difference.toFixed(2)}</span>}
            </p>
          ) : null}
        </div>
      </Section>

      <Section
        title="Account mapping"
        description="Debits positive, credits in brackets. Correct any caption, group or lead reference, then tick each line you have checked against the client's statement. Every account must be verified before adjustments are proposed."
      >
        {unverified ? <div className="mb-4"><Notice tone="warn">{unverified} of {lines.length} lines not yet verified.</Notice></div> : <div className="mb-4"><Notice tone="accent">All {lines.length} lines verified.</Notice></div>}
        <ActionForm action={saveMapping}>
          <input type="hidden" name="engagement_id" value={id} />
          <datalist id="captions">{[...new Set(lines.map((l) => l.fs_caption).filter(Boolean))].map((c) => <option key={c} value={c!} />)}</datalist>
          <div className="mt-2 overflow-x-auto rounded-md border border-rule bg-surface">
            <table className="ledger">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Account per client</th>
                  <th className="num">CY per client</th>
                  <th className="num">PY per client</th>
                  <th>FS caption</th>
                  <th>Group</th>
                  <th>Lead</th>
                  <th>AI note</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const v = Boolean(l.verified_by);
                  const low = (l.mapping_confidence ?? 1) < 0.8 || l.mapping_flags.length > 0;
                  return (
                    <tr key={l.id} className={low && !v ? "bg-warn-soft/40" : ""}>
                      <td className="num text-ink-3">{l.line_no}</td>
                      <td className="min-w-48 font-medium">{l.account_name}<p className="text-xs font-normal text-ink-3">{l.section.replace(/_/g, " ")}</p></td>
                      <td><Money cents={toCents(l.cy_amount)} /></td>
                      <td className="text-ink-2"><Money cents={l.py_client_amount === null ? null : toCents(l.py_client_amount)} /></td>
                      <td>
                        <input name={`caption_${l.id}`} defaultValue={l.fs_caption ?? ""} list="captions" disabled={v || locked} aria-label={`Caption for ${l.account_name}`} className="h-8 w-56 rounded-md border border-rule-strong bg-surface px-2 text-sm disabled:border-transparent disabled:bg-transparent" />
                      </td>
                      <td>
                        <select name={`group_${l.id}`} defaultValue={l.fs_group ?? ""} disabled={v || locked} aria-label={`Group for ${l.account_name}`} className="h-8 rounded-md border border-rule-strong bg-surface px-2 text-sm disabled:border-transparent disabled:bg-transparent">
                          <option value="">Unmapped</option>
                          {ALL_GROUPS.map((g) => <option key={g}>{g}</option>)}
                        </select>
                      </td>
                      <td>
                        <select name={`ref_${l.id}`} defaultValue={l.wp_ref ?? ""} disabled={v || locked} aria-label={`Lead schedule for ${l.account_name}`} title={l.wp_ref ? indexTitle(l.wp_ref) : ""} className="ref h-8 rounded-md border border-rule-strong bg-surface px-2 disabled:border-transparent disabled:bg-transparent">
                          <option value="">-</option>
                          {LEAD_REFS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[36ch] text-xs text-ink-2">
                        {l.mapping_rationale}
                        {l.mapping_flags.map((f) => <p key={f} className="mt-1 text-warn">{f}</p>)}
                        {l.mapping_confidence !== null ? <p className="mt-1 text-ink-3">Confidence {Math.round(Number(l.mapping_confidence) * 100)}%{l.mapped_by === "staff" ? " · edited by staff" : ""}</p> : null}
                      </td>
                      <td className="whitespace-nowrap">
                        {v ? (
                          <span className="text-xs text-accent-ink">{b.people.get(l.verified_by!)?.initials} {day(l.verified_at)}</span>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name={`verify_${l.id}`} disabled={locked || !l.fs_caption} className="size-4 accent-[var(--color-accent)]" />Tick</label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!locked ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Submit name="intent" value="tick" pendingText="Saving…">Save and verify ticked lines</Submit>
              <Submit name="intent" value="save" variant="secondary" pendingText="Saving…">Save without verifying</Submit>
              {unverified ? <Submit name="intent" value="verify_all" variant="secondary" pendingText="Verifying…">Verify all remaining</Submit> : null}
            </div>
          ) : null}
        </ActionForm>
        {!locked && lines.some((l) => l.verified_by) ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ink-2">Reopen a verified line</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {lines.filter((l) => l.verified_by).map((l) => (
                <ActionForm key={l.id} action={reopenLine}>
                  <input type="hidden" name="engagement_id" value={id} />
                  <input type="hidden" name="id" value={l.id} />
                  <Submit variant="ghost" pendingText="…">{l.account_name}</Submit>
                </ActionForm>
              ))}
            </div>
          </details>
        ) : null}
      </Section>

      <Section title="Prior-year balances" description={b.pyBalances.some((p) => /not agreed/i.test(p.note ?? "")) ? "Taken from the client's comparatives: not yet agreed to the audited report. Upload the prior-year audited financial statements and re-run step 2." : "Audited closing balances by caption, used for comparatives, analytical review and the opening balance test."}>
        {b.pyBalances.length === 0 ? <p className="text-sm text-ink-3">Not yet extracted.</p> : (
          <div className="overflow-x-auto rounded-md border border-rule bg-surface">
            <table className="ledger">
              <thead><tr><th>Caption</th><th>Group</th><th>Lead</th><th className="num">Amount (Dr / (Cr))</th><th>Source</th></tr></thead>
              <tbody>
                {b.pyBalances.map((p) => (
                  <tr key={p.id}><td>{p.fs_caption}</td><td className="text-ink-2">{p.fs_group}</td><td className="ref">{p.wp_ref}</td><td><Money cents={toCents(p.amount)} /></td><td className="text-xs text-ink-3">{p.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
