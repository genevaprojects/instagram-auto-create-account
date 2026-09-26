import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";
import { getEngagement } from "@/lib/engagement-page";
import { WP_INDEX, indexTitle } from "@/lib/audit/catalog";
import { hasRole } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, EmptyState, Notice, Section, day } from "@/components/ui";
import { setPaperStatus, savePaperContent } from "./actions";

export const metadata = { title: "Working papers" };

const label = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function ReadOnly({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <p className="whitespace-pre-line">{String(value)}</p>;
  if (Array.isArray(value)) {
    return (
      <ul className="flex flex-col gap-2">
        {value.map((v, i) => (
          <li key={i} className="rounded-md bg-paper px-3 py-2">{typeof v === "object" ? <ReadOnly value={v} /> : String(v)}</li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-ink-3">{label(k)}</dt><dd><ReadOnly value={v} /></dd></div>
      ))}
    </dl>
  );
}

export default async function PapersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { b, profile } = await getEngagement(id);
  const locked = b.engagement.status === "locked";
  const base = `/engagements/${id}/papers`;
  const papers = [...b.papers].sort((a, c) => WP_INDEX.findIndex((e) => e.ref === a.ref) - WP_INDEX.findIndex((e) => e.ref === c.ref));
  const current = papers.find((p) => p.ref === sp.ref) ?? papers[0];
  const counts = { draft: papers.filter((p) => p.status === "draft").length, prepared: papers.filter((p) => p.status === "prepared").length, reviewed: papers.filter((p) => p.status === "reviewed").length };

  return (
    <div>
      <Section
        title="Download the audit file"
        description={locked ? "Final versions: the engagement is signed and locked." : "Drafts are watermarked until partner sign-off. Every download is logged with the file's SHA-256 fingerprint."}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/engagements/${id}/export/awp`} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-white hover:bg-accent-hover"><FileSpreadsheet className="size-4" aria-hidden />Working papers (.xlsx)</a>
            <a href={`/api/engagements/${id}/export/planning`} className="inline-flex h-9 items-center gap-2 rounded-md border border-rule-strong bg-surface px-4 text-base hover:bg-shelf"><FileText className="size-4" aria-hidden />Planning memo (.docx)</a>
            <a href={`/api/engagements/${id}/export/index`} className="inline-flex h-9 items-center gap-2 rounded-md border border-rule-strong bg-surface px-4 text-base hover:bg-shelf"><FileText className="size-4" aria-hidden />Index AA2 (.docx)</a>
          </div>
        }
      >
        <p className="text-sm text-ink-2">
          The workbook contains the firm&apos;s sheets (AB2, DA3, DB-1, DB-2, DC1, lead schedules, M4) with live formulas, plus the enhanced sheets: risk assessment (AC), summary of audit differences (BB), going concern (BD), extended trial balance (DD), analytical review (DE), review points and the evidence register.
        </p>
      </Section>

      <Section title="Narrative papers" description={`${counts.reviewed} reviewed · ${counts.prepared} prepared · ${counts.draft} draft. Prepare each paper after checking it; a different manager or partner reviews it.`}>
        {papers.length === 0 ? (
          <EmptyState title="No narrative papers yet">Run steps 4 and 5 on the Overview tab to draft the analytical review, planning memo, risk assessment and lead schedules.</EmptyState>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <nav aria-label="Working papers" className="flex flex-col gap-1">
              {papers.map((p) => (
                <Link key={p.id} href={`${base}?ref=${encodeURIComponent(p.ref)}`} aria-current={p.id === current.id ? "page" : undefined} className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${p.id === current.id ? "bg-surface font-medium shadow-[0_1px_0_var(--color-rule)]" : "text-ink-2 hover:bg-shelf"}`}>
                  <span className="min-w-0 truncate"><span className="ref mr-2">{p.ref}</span>{indexTitle(p.ref)}</span>
                  <span className={`size-2 shrink-0 rounded-full ${p.status === "reviewed" ? "bg-accent" : p.status === "prepared" ? "bg-info" : "bg-rule-strong"}`} aria-label={p.status} />
                </Link>
              ))}
            </nav>
            <article className="min-w-0 rounded-md border border-rule bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
                <div>
                  <h3 className="text-md font-semibold"><span className="ref mr-2">{current.ref}</span>{indexTitle(current.ref)}</h3>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Prepared {current.prepared_by ? `${b.people.get(current.prepared_by)?.initials} ${day(current.prepared_at)}` : "-"} · Reviewed {current.reviewed_by ? `${b.people.get(current.reviewed_by)?.initials} ${day(current.reviewed_at)}` : "-"}
                    {current.content.edited_by_staff ? " · edited by staff" : " · AI draft"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={current.status === "reviewed" ? "accent" : current.status === "prepared" ? "info" : "neutral"}>{current.status}</Badge>
                  {!locked ? (
                    <ActionForm action={setPaperStatus} className="flex gap-2">
                      <input type="hidden" name="engagement_id" value={id} />
                      <input type="hidden" name="id" value={current.id} />
                      {current.status === "draft" ? <Submit name="to" value="prepared" pendingText="…">Mark prepared</Submit> : null}
                      {current.status === "prepared" && hasRole(profile, ["manager", "partner"]) && current.prepared_by !== profile.id ? <Submit name="to" value="reviewed" pendingText="…">Mark reviewed</Submit> : null}
                      {current.status !== "draft" ? <Submit name="to" value="draft" variant="ghost" pendingText="…">Reopen</Submit> : null}
                    </ActionForm>
                  ) : null}
                </div>
              </header>
              <div className="px-5 py-5 text-sm">
                {current.status === "draft" && !locked ? (
                  <ActionForm action={savePaperContent} className="flex flex-col gap-5">
                    <input type="hidden" name="engagement_id" value={id} />
                    <input type="hidden" name="id" value={current.id} />
                    {Object.entries(current.content).filter(([k]) => !["generated_at", "edited_by_staff", "wp_ref"].includes(k)).map(([k, v]) => {
                      if (typeof v === "string") return <label key={k} className="flex flex-col gap-1"><span className="font-medium text-ink-2">{label(k)}</span><textarea name={`f:${k}`} defaultValue={v} rows={Math.min(8, Math.max(2, Math.ceil(v.length / 110)))} className="rounded-md border border-rule-strong px-3 py-2 text-base" /></label>;
                      if (Array.isArray(v) && v.every((x) => typeof x === "string")) return <label key={k} className="flex flex-col gap-1"><span className="font-medium text-ink-2">{label(k)} <span className="font-normal text-ink-3">(one per line)</span></span><textarea name={`l:${k}`} defaultValue={(v as string[]).join("\n")} rows={Math.min(12, Math.max(2, v.length + 1))} className="rounded-md border border-rule-strong px-3 py-2 text-base" /></label>;
                      if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && "heading" in x && "body" in x)) {
                        return (
                          <div key={k} className="flex flex-col gap-4">
                            {(v as { heading: string; body: string }[]).map((s, i) => (
                              <label key={i} className="flex flex-col gap-1"><span className="font-medium text-accent-ink">{s.heading}</span><textarea name={`s:${k}:${i}`} defaultValue={s.body} rows={Math.min(10, Math.max(2, Math.ceil(s.body.length / 110)))} className="rounded-md border border-rule-strong px-3 py-2 text-base" /></label>
                            ))}
                          </div>
                        );
                      }
                      return <div key={k}><p className="mb-1 font-medium text-ink-2">{label(k)}</p><ReadOnly value={v} /></div>;
                    })}
                    <div><Submit pendingText="Saving…">Save changes</Submit></div>
                  </ActionForm>
                ) : (
                  <div className="flex flex-col gap-5">
                    {current.status !== "draft" ? <Notice tone="neutral">Reopen the paper to edit it. Reopening clears the prepared and reviewed stamps.</Notice> : null}
                    {Object.entries(current.content).filter(([k]) => !["generated_at", "edited_by_staff", "wp_ref"].includes(k)).map(([k, v]) => (
                      <div key={k}><p className="mb-1 font-medium text-ink-2">{label(k)}</p><ReadOnly value={v} /></div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>
        )}
      </Section>
    </div>
  );
}
