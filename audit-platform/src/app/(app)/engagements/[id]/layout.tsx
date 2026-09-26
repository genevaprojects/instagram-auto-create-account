import Link from "next/link";
import { Lock } from "lucide-react";
import { getEngagement } from "@/lib/engagement-page";
import { initialsOf } from "@/lib/pipeline/bundle";
import { TabLink } from "@/components/nav-link";
import { Badge, day } from "@/components/ui";

export default async function EngagementLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b } = await getEngagement(id);
  const e = b.engagement;
  const base = `/engagements/${id}`;
  const open = b.reviewPoints.filter((r) => r.status !== "cleared").length;
  const unsigned = b.documents.filter((d) => d.status === "awaiting_signoff").length;
  const proposed = b.adjustments.filter((a) => a.status === "proposed").length;
  const team = [["Preparer", e.preparer_id], ["Reviewer", e.reviewer_id], ["Partner", e.partner_id]] as const;
  return (
    <div className="max-w-[1280px]">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-3">
        <Link href="/engagements" className="hover:text-ink hover:underline">Engagements</Link>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{b.client.name}</h1>
          <p className="mt-1 text-base text-ink-2">
            Audit for the year ended {day(e.fy_end)} · {b.client.framework}
            {e.reporting_deadline ? ` · Deadline ${day(e.reporting_deadline)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {team.map(([k, v]) => (
            <span key={k} className="text-ink-3">{k} <span className="ref text-ink">{initialsOf(b, v) || "-"}</span></span>
          ))}
          {e.status === "locked" ? <Badge tone="accent"><Lock className="size-3" aria-hidden />Signed and locked</Badge> : <Badge tone="info">{e.status}</Badge>}
        </div>
      </header>
      <nav aria-label="Engagement sections" className="mt-6 flex gap-6 overflow-x-auto border-b border-rule">
        <TabLink href={base} exact>Overview</TabLink>
        <TabLink href={`${base}/documents`}>Documents{unsigned ? <span className="ml-1.5 rounded-sm bg-warn-soft px-1.5 text-xs text-warn">{unsigned}</span> : null}</TabLink>
        <TabLink href={`${base}/trial-balance`}>Trial balance</TabLink>
        <TabLink href={`${base}/adjustments`}>Adjustments{proposed ? <span className="ml-1.5 rounded-sm bg-warn-soft px-1.5 text-xs text-warn">{proposed}</span> : null}</TabLink>
        <TabLink href={`${base}/etb`}>ETB and materiality</TabLink>
        <TabLink href={`${base}/papers`}>Working papers</TabLink>
        <TabLink href={`${base}/review`}>Review and sign-off{open ? <span className="ml-1.5 rounded-sm bg-danger-soft px-1.5 text-xs text-danger">{open}</span> : null}</TabLink>
        <TabLink href={`${base}/activity`}>Activity</TabLink>
      </nav>
      <div className="pt-8">{children}</div>
    </div>
  );
}
