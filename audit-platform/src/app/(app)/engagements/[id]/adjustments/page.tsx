import { getEngagement } from "@/lib/engagement-page";
import { ALL_GROUPS, LEAD_REFS, PL_GROUPS } from "@/lib/audit/catalog";
import { toCents, sum, formatRM } from "@/lib/audit/money";
import { hasRole } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, EmptyState, Money, Section, when } from "@/components/ui";
import { decideAdjustment, addManualAdjustment } from "./actions";

export const metadata = { title: "Adjustments" };

const TONE = { proposed: "warn", accepted: "accent", rejected: "neutral", uncorrected: "danger" } as const;

type Tax = { year_of_assessment: number; rate_basis: string; rate_basis_reason: string; chargeable_income: number; computed_tax?: number; instalments_paid: number | null; lines: { label: string; amount: number; basis: string }[]; open_points: string[] };

export default async function AdjustmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b, profile } = await getEngagement(id);
  const locked = b.engagement.status === "locked";
  const canDecide = hasRole(profile, ["senior", "manager", "partner", "admin"]) && !locked;
  const captions = [...new Set([...(b.etb?.rows.map((r) => r.fs_caption) ?? [])])];
  const tax = b.engagement.tax_computation as Tax | null;
  const sad = b.materiality ? (b.materiality.selected === "isa320" ? b.materiality.isa.clearlyTrivial : (b.materiality.final ?? b.materiality.draft).sad) : null;

  return (
    <div>
      <Section title="Proposed and decided entries" description={`Only accepted entries post to the ETB. Uncorrected entries go to the summary of audit differences (BB)${sad !== null ? `; the SAD threshold is RM${formatRM(sad)}` : ""}.`}>
        {b.adjustments.length === 0 ? (
          <EmptyState title="No adjustments yet">Run step 3 on the Overview tab after every account mapping is verified, or add an entry below.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {b.adjustments.map((a) => {
              const pbt = -sum(a.lines.filter((l) => PL_GROUPS.includes(l.fs_group)).map((l) => toCents(l.dr) - toCents(l.cr)));
              return (
                <article key={a.id} className="rounded-md border border-rule bg-surface">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-4 py-3">
                    <div>
                      <p className="font-semibold"><span className="ref mr-2 text-sm">{a.ref}</span>{a.description}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {a.source === "ai" ? "Proposed by AI" : `Proposed by ${b.people.get(a.proposed_by ?? "")?.full_name ?? "staff"}`} · effect on profit before tax <span className="num">{formatRM(pbt, { dashForZero: false })}</span>
                        {a.decided_by ? ` · ${a.status} by ${b.people.get(a.decided_by)?.full_name} ${when(a.decided_at)}` : ""}
                      </p>
                    </div>
                    <Badge tone={TONE[a.status]}>{a.status}</Badge>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="ledger">
                      <thead><tr><th>Account</th><th>Caption</th><th>Lead</th><th className="num">Dr</th><th className="num">Cr</th></tr></thead>
                      <tbody>
                        {a.lines.map((l, i) => (
                          <tr key={i}>
                            <td className={l.cr > 0 ? "pl-8" : ""}>{l.account}</td>
                            <td className="text-ink-2">{l.fs_caption} <span className="text-xs text-ink-3">({l.fs_group})</span></td>
                            <td className="ref">{l.wp_ref}</td>
                            <td><Money cents={toCents(l.dr) || null} /></td>
                            <td><Money cents={toCents(l.cr) || null} /></td>
                          </tr>
                        ))}
                        <tr className="subtotal"><td colSpan={3}>Total</td><td><Money cents={toCents(a.total)} /></td><td><Money cents={toCents(a.total)} /></td></tr>
                      </tbody>
                    </table>
                  </div>
                  {a.rationale || a.evidence || a.decision_note ? (
                    <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-2">
                      {a.rationale ? <div><p className="font-medium text-ink-2">Rationale</p><p className="mt-1 whitespace-pre-line">{a.rationale}</p></div> : null}
                      {a.evidence ? <div><p className="font-medium text-ink-2">Evidence</p><p className="mt-1 whitespace-pre-line">{a.evidence}</p></div> : null}
                      {a.decision_note ? <div className="sm:col-span-2"><p className="font-medium text-ink-2">Decision note</p><p className="mt-1">{a.decision_note}</p></div> : null}
                    </div>
                  ) : null}
                  {canDecide ? (
                    <ActionForm action={decideAdjustment} className="flex flex-wrap items-end gap-2 border-t border-rule px-4 py-3">
                      <input type="hidden" name="engagement_id" value={id} />
                      <input type="hidden" name="id" value={a.id} />
                      {a.status === "proposed" ? (
                        <>
                          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-ink-2">
                            Note (required to reject or leave uncorrected)
                            <input name="note" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" />
                          </label>
                          <Submit name="decision" value="accepted" pendingText="…">Accept</Submit>
                          <Submit name="decision" value="uncorrected" variant="secondary" pendingText="…">Management declines</Submit>
                          <Submit name="decision" value="rejected" variant="danger" pendingText="…">Reject</Submit>
                        </>
                      ) : (
                        <Submit name="decision" value="proposed" variant="ghost" pendingText="…">Withdraw decision</Submit>
                      )}
                    </ActionForm>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      {tax ? (
        <Section title={`Tax computation, Y/A ${tax.year_of_assessment} (M4)`} description="Drafted by AI; the platform recomputes the tax on the stated chargeable income. A reviewer must confirm the rate basis and every adjustment.">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto rounded-md border border-rule bg-surface">
              <table className="ledger">
                <tbody>
                  {tax.lines.map((l, i) => <tr key={i}><td>{l.label}<p className="text-xs text-ink-3">{l.basis}</p></td><td><Money cents={toCents(l.amount)} /></td></tr>)}
                  <tr className="subtotal"><td>Chargeable income</td><td><Money cents={toCents(tax.chargeable_income)} /></td></tr>
                  <tr className="grand"><td>Tax ({tax.rate_basis === "sme" ? "SME scale" : "24%"})</td><td><Money cents={toCents(tax.computed_tax ?? 0)} /></td></tr>
                </tbody>
              </table>
            </div>
            <div className="text-sm">
              <p className="font-medium text-ink-2">Rate basis</p>
              <p className="mt-1">{tax.rate_basis_reason}</p>
              {tax.open_points.length ? (<><p className="mt-4 font-medium text-ink-2">Open points</p><ul className="mt-1 list-disc pl-5">{tax.open_points.map((p) => <li key={p}>{p}</li>)}</ul></>) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {!locked && b.mapped ? (
        <Section title="Add an entry" description="For adjustments the AI did not propose. Use captions that already exist on the ETB where possible so the entry posts to the right line.">
          <ActionForm action={addManualAdjustment} resetOnOk className="flex flex-col gap-4">
            <input type="hidden" name="engagement_id" value={id} />
            <datalist id="adj-captions">{captions.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Type<select name="kind" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink"><option value="AJE">AJE</option><option value="RJE">RJE (presentation)</option></select></label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Description<input name="description" placeholder="Being provision for quit rent 2026" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" /></label>
            </div>
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead><tr><th>Account</th><th>Caption</th><th>Group</th><th>Lead</th><th className="num">Dr</th><th className="num">Cr</th></tr></thead>
                <tbody>
                  {Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      <td><input name={`account_${i}`} aria-label={`Account line ${i + 1}`} className="h-8 w-48 rounded-md border border-rule-strong px-2 text-sm" /></td>
                      <td><input name={`caption_${i}`} list="adj-captions" aria-label={`Caption line ${i + 1}`} className="h-8 w-48 rounded-md border border-rule-strong px-2 text-sm" /></td>
                      <td><select name={`group_${i}`} aria-label={`Group line ${i + 1}`} className="h-8 rounded-md border border-rule-strong px-2 text-sm"><option value="" />{ALL_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></td>
                      <td><select name={`ref_${i}`} aria-label={`Lead line ${i + 1}`} className="ref h-8 rounded-md border border-rule-strong px-2"><option value="" />{LEAD_REFS.map((r) => <option key={r}>{r}</option>)}</select></td>
                      <td><input name={`dr_${i}`} inputMode="decimal" aria-label={`Debit line ${i + 1}`} className="num h-8 w-28 rounded-md border border-rule-strong px-2 text-sm" /></td>
                      <td><input name={`cr_${i}`} inputMode="decimal" aria-label={`Credit line ${i + 1}`} className="num h-8 w-28 rounded-md border border-rule-strong px-2 text-sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Rationale and calculation<textarea name="rationale" rows={2} className="rounded-md border border-rule-strong bg-surface px-3 py-2 text-base text-ink" /></label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Evidence<textarea name="evidence" rows={2} className="rounded-md border border-rule-strong bg-surface px-3 py-2 text-base text-ink" /></label>
            </div>
            <div><Submit pendingText="Adding…">Propose entry</Submit></div>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
