import { getEngagement } from "@/lib/engagement-page";
import { describeEvent } from "@/lib/events";
import { Section, when } from "@/components/ui";
import type { AuditLogRow } from "@/lib/db-types";

export const metadata = { title: "Engagement activity" };

export default async function EngagementActivity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getEngagement(id);
  const { data } = await supabase.from("audit_log").select("*").eq("engagement_id", id).order("id", { ascending: false }).limit(300);
  const rows = (data ?? []) as AuditLogRow[];
  return (
    <Section title="Everything that happened on this engagement" description="Newest first. Includes uploads, attestations, AI runs, mapping edits, adjustment decisions, paper edits, downloads and sign-offs.">
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="ledger">
          <thead><tr><th>When (MYT)</th><th>Who</th><th>What</th><th>IP</th><th>Entry</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{when(l.at)}</td>
                <td className="whitespace-nowrap">{l.actor_name || l.actor_email || "System"}</td>
                <td>{describeEvent(l)}</td>
                <td className="ref text-ink-3">{l.ip}</td>
                <td className="ref text-ink-3" title={l.hash}>#{l.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
