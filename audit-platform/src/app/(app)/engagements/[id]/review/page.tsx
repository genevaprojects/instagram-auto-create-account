import { getEngagement } from "@/lib/engagement-page";
import { hasRole, ROLE_LABEL } from "@/lib/session";
import { signoffStatement } from "@/lib/declarations";
import { dmy } from "@/lib/export/format";
import { ActionForm, Submit } from "@/components/action-form";
import { SignoffForm } from "@/components/signoff-form";
import { Badge, EmptyState, Section, when } from "@/components/ui";
import { raisePoint, respondPoint, clearPoint } from "./actions";

export const metadata = { title: "Review and sign-off" };

const STAGES = [
  { stage: "preparer", title: "Prepared by", who: "Any staff member who prepared the file" },
  { stage: "reviewer", title: "Reviewed by (manager)", who: "A manager or partner who did not prepare it" },
  { stage: "partner", title: "Approved by (engagement partner)", who: "A partner. Signing locks the engagement." },
] as const;

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b, profile } = await getEngagement(id);
  const locked = b.engagement.status === "locked";
  const refs = [...new Set([...b.papers.map((p) => p.ref), ...(b.etb?.rows.map((r) => r.wp_ref) ?? []), "AB", "DB", "DC", "DD"])].sort();
  const points = b.reviewPoints;
  const signedStages = new Set(b.signoffs.map((s) => s.stage));
  const iSigned = b.signoffs.some((s) => s.signed_by === profile.id);

  return (
    <div className="grid gap-x-12 xl:grid-cols-[1fr_420px]">
      <div className="min-w-0">
        <Section title="Review points" description={`${points.filter((p) => p.status === "open").length} open · ${points.filter((p) => p.status === "responded").length} responded · ${points.filter((p) => p.status === "cleared").length} cleared. The partner cannot sign until every point is cleared.`}>
          {points.length === 0 ? <EmptyState title="No review points" /> : (
            <ol className="flex flex-col gap-3">
              {points.map((p, i) => (
                <li key={p.id} className="rounded-md border border-rule bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm"><span className="mr-2 text-ink-3 tabular-nums">{i + 1}.</span>{p.wp_ref ? <span className="ref mr-2">{p.wp_ref}</span> : null}<span className="whitespace-pre-line">{p.body}</span></p>
                    <Badge tone={p.status === "cleared" ? "accent" : p.status === "responded" ? "info" : "danger"}>{p.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-3">Raised by {p.body.startsWith("[AI]") ? `AI run started by ${b.people.get(p.raised_by)?.initials}` : b.people.get(p.raised_by)?.full_name} {when(p.raised_at)}</p>
                  {p.response ? <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm"><span className="font-medium">{b.people.get(p.responded_by ?? "")?.initials}:</span> {p.response}</p> : null}
                  {p.cleared_by ? <p className="mt-1 text-xs text-accent-ink">Cleared by {b.people.get(p.cleared_by)?.full_name} {when(p.cleared_at)}</p> : null}
                  {!locked && p.status !== "cleared" ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <ActionForm action={respondPoint} resetOnOk className="flex min-w-72 flex-1 items-end gap-2">
                        <input type="hidden" name="engagement_id" value={id} />
                        <input type="hidden" name="id" value={p.id} />
                        <label className="flex flex-1 flex-col gap-1 text-xs text-ink-2">Response<input name="response" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" /></label>
                        <Submit variant="secondary" pendingText="…">Respond</Submit>
                      </ActionForm>
                      {p.status === "responded" ? (
                        <ActionForm action={clearPoint}>
                          <input type="hidden" name="engagement_id" value={id} />
                          <input type="hidden" name="id" value={p.id} />
                          <Submit pendingText="…">Clear</Submit>
                        </ActionForm>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {!locked ? (
            <ActionForm action={raisePoint} resetOnOk className="mt-6 grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
              <input type="hidden" name="engagement_id" value={id} />
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Paper<select name="wp_ref" className="ref h-9 rounded-md border border-rule-strong bg-surface px-2"><option value="">General</option>{refs.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">New review point<input name="body" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" placeholder="e.g. Obtain the directors' letter of undertaking not to recall advances" /></label>
              <Submit pendingText="…">Raise</Submit>
            </ActionForm>
          ) : null}
        </Section>
      </div>

      <aside>
        <Section title="Engagement sign-off" description="Each signature is bound to a SHA-256 fingerprint of the trial balance, adjustments, working papers and evidence at that moment.">
          <ol className="flex flex-col gap-6">
            {STAGES.map(({ stage, title, who }, i) => {
              const s = b.signoffs.find((x) => x.stage === stage);
              const prevDone = i === 0 || signedStages.has(STAGES[i - 1].stage);
              const eligible = stage === "preparer" || (stage === "reviewer" ? hasRole(profile, ["manager", "partner"]) : profile.role === "partner");
              return (
                <li key={stage} className="rounded-md border border-rule bg-surface p-4">
                  <div className="flex items-center justify-between"><p className="font-medium">{title}</p>{s ? <Badge tone="accent">Signed</Badge> : <Badge>Pending</Badge>}</div>
                  {s ? (
                    <div className="mt-2 text-sm">
                      <p>{s.signed_name} ({s.initials}), {ROLE_LABEL[s.role]}</p>
                      <p className="text-xs text-ink-3">{when(s.signed_at)}{s.ip ? ` from ${s.ip}` : ""}</p>
                      <p className="ref mt-1 break-all text-ink-3">Snapshot {s.snapshot_hash}</p>
                    </div>
                  ) : !locked && prevDone && eligible && !(stage !== "preparer" && iSigned) ? (
                    <div className="mt-3">
                      <SignoffForm
                        engagementId={id}
                        stage={stage}
                        name={profile.full_name}
                        statement={signoffStatement(stage, { name: profile.full_name, initials: profile.initials, client: b.client.name, yearEnd: dmy(b.engagement.fy_end) })}
                        warning={stage === "partner" ? "Signing locks the engagement. No further changes can be made." : undefined}
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-3">{!prevDone ? "Waiting for the previous stage." : stage !== "preparer" && iSigned ? "You signed an earlier stage; a different person must sign this one." : who}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </Section>
      </aside>
    </div>
  );
}
