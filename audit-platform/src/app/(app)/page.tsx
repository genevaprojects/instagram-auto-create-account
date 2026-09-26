import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/session";
import { currentStage, STAGES } from "@/lib/stage";
import { Badge, EmptyState, LinkButton, PageHeader, Section, day, when } from "@/components/ui";
import type { AuditLogRow, DocumentRow, PipelineRun, SignoffRow } from "@/lib/db-types";
import { describeEvent } from "@/lib/events";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { supabase, profile } = await requireStaff();
  const [eng, docs, runs, signs, rps, tb, adj, log] = await Promise.all([
    supabase.from("engagements").select("id, fy_end, status, reporting_deadline, preparer_id, reviewer_id, partner_id, clients(name)").neq("status", "locked").order("reporting_deadline", { ascending: true, nullsFirst: false }),
    supabase.from("documents").select("id, engagement_id, kind, status, filename, uploaded_by"),
    supabase.from("pipeline_runs").select("engagement_id, step, status, started_at").order("started_at", { ascending: false }),
    supabase.from("signoffs").select("engagement_id, stage"),
    supabase.from("review_points").select("engagement_id, status"),
    supabase.from("tb_lines").select("engagement_id, verified_by, fs_caption"),
    supabase.from("adjustments").select("engagement_id, status"),
    supabase.from("audit_log").select("*").order("id", { ascending: false }).limit(12),
  ]);
  type EngRow = { id: string; fy_end: string; status: string; reporting_deadline: string | null; preparer_id: string | null; reviewer_id: string | null; partner_id: string | null; clients: { name: string } | null };
  const engagements = (eng.data ?? []) as unknown as EngRow[];
  const by = <T extends { engagement_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.engagement_id === id);
  const rows = engagements.map((e) => {
    const stage = currentStage({
      status: e.status,
      documents: by(docs.data as DocumentRow[], e.id),
      runs: by(runs.data as PipelineRun[], e.id),
      tbLines: by(tb.data as { engagement_id: string; verified_by: string | null; fs_caption: string | null }[], e.id),
      adjustments: by(adj.data as { engagement_id: string; status: "proposed" }[], e.id),
      signoffs: by(signs.data as SignoffRow[], e.id),
    });
    const open = by(rps.data as { engagement_id: string; status: string }[], e.id).filter((r) => r.status !== "cleared").length;
    const mine = [e.preparer_id, e.reviewer_id, e.partner_id].includes(profile.id);
    return { e, stage, open, mine };
  });
  const myUnsigned = ((docs.data ?? []) as DocumentRow[]).filter((d) => d.status === "awaiting_signoff" && d.uploaded_by === profile.id);
  const reviewQueue = rows.filter((r) => r.stage.key === "signoff" && ((r.stage.next.startsWith("Manager") && ["manager", "partner"].includes(profile.role)) || (r.stage.next.startsWith("Partner") && profile.role === "partner")));
  const mineFirst = [...rows].sort((a, b) => Number(b.mine) - Number(a.mine));

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title="Dashboard"
        description={`${rows.length} open engagement${rows.length === 1 ? "" : "s"}. Yours are listed first.`}
        actions={<LinkButton href="/engagements/new" variant="primary"><Plus className="size-4" aria-hidden />New engagement</LinkButton>}
      />
      <div className="grid gap-x-12 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <EmptyState title="No open engagements" action={<LinkButton href="/engagements/new" variant="primary">Start the first engagement</LinkButton>}>
              Create a client, open an engagement for the financial year, then upload the client&apos;s balance sheet and profit and loss account.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-md border border-rule bg-surface">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Year end</th>
                    <th>Progress</th>
                    <th>Next step</th>
                    <th className="num">Open points</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {mineFirst.map(({ e, stage, open, mine }) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/engagements/${e.id}`} className="font-medium hover:underline">{e.clients?.name}</Link>
                        {mine ? <span className="ml-2"><Badge tone="accent">Assigned to you</Badge></span> : null}
                      </td>
                      <td className="whitespace-nowrap">{day(e.fy_end)}</td>
                      <td>
                        <div className="flex items-center gap-1" aria-label={`Stage ${stage.index + 1} of ${STAGES.length}`}>
                          {STAGES.map((s, i) => (
                            <span key={s.key} title={s.label} className={`h-1.5 w-5 rounded-full ${i < stage.index ? "bg-accent" : i === stage.index ? "bg-accent/40" : "bg-rule"}`} />
                          ))}
                        </div>
                      </td>
                      <td className="text-ink-2">{stage.next}</td>
                      <td className="num">{open || "-"}</td>
                      <td className="whitespace-nowrap">{e.reporting_deadline ? day(e.reporting_deadline) : <span className="text-ink-3">Not set</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-col xl:mt-0">
          <Section title="Needs your signature">
            {myUnsigned.length === 0 && reviewQueue.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing waiting for you.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {myUnsigned.map((d) => (
                  <li key={d.id}>
                    <Link href={`/engagements/${d.engagement_id}/documents`} className="font-medium hover:underline">{d.filename}</Link>
                    <p className="text-ink-3">Uploaded by you, not yet signed. It will not be processed until you sign.</p>
                  </li>
                ))}
                {reviewQueue.map(({ e, stage }) => (
                  <li key={e.id}>
                    <Link href={`/engagements/${e.id}/review`} className="font-medium hover:underline">{e.clients?.name}</Link>
                    <p className="text-ink-3">{stage.next}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Recent activity" actions={<Link href="/activity" className="text-sm text-accent hover:underline">Full trail</Link>}>
            <ol className="flex flex-col gap-3 text-sm">
              {((log.data ?? []) as AuditLogRow[]).map((l) => (
                <li key={l.id} className="grid grid-cols-[1fr_auto] gap-x-3">
                  <span><span className="font-medium">{l.actor_name || l.actor_email || "System"}</span> <span className="text-ink-2">{describeEvent(l)}</span></span>
                  <time className="text-xs whitespace-nowrap text-ink-3" dateTime={l.at}>{when(l.at)}</time>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
