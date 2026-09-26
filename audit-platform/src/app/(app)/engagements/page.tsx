import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/session";
import { Badge, EmptyState, LinkButton, PageHeader, day } from "@/components/ui";

export const metadata = { title: "Engagements" };

const TONE: Record<string, "neutral" | "accent" | "warn" | "info"> = { planning: "neutral", fieldwork: "info", review: "warn", completed: "accent", locked: "accent" };

export default async function EngagementsPage() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("engagements").select("id, fy_start, fy_end, status, reporting_deadline, locked_at, clients(name), preparer:preparer_id(initials), reviewer:reviewer_id(initials), partner:partner_id(initials)").order("fy_end", { ascending: false });
  type Row = { id: string; fy_start: string; fy_end: string; status: string; reporting_deadline: string | null; locked_at: string | null; clients: { name: string } | null; preparer: { initials: string } | null; reviewer: { initials: string } | null; partner: { initials: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Engagements" actions={<LinkButton href="/engagements/new" variant="primary"><Plus className="size-4" aria-hidden />New engagement</LinkButton>} />
      {rows.length === 0 ? (
        <EmptyState title="No engagements yet" action={<LinkButton href="/engagements/new" variant="primary">New engagement</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-rule bg-surface">
          <table className="ledger">
            <thead><tr><th>Client</th><th>Period</th><th>Status</th><th>Team</th><th>Deadline</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="font-medium hover:underline" href={`/engagements/${r.id}`}>{r.clients?.name}</Link></td>
                  <td className="whitespace-nowrap">{day(r.fy_start)} to {day(r.fy_end)}</td>
                  <td><Badge tone={TONE[r.status]}>{r.status === "locked" ? "Signed and locked" : r.status}</Badge></td>
                  <td className="ref">{[r.preparer?.initials, r.reviewer?.initials, r.partner?.initials].filter(Boolean).join(" / ") || "-"}</td>
                  <td className="whitespace-nowrap">{day(r.reporting_deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
