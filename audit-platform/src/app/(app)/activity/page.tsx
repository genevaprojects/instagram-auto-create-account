import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { PageHeader, Select, when } from "@/components/ui";
import { describeEvent } from "@/lib/events";
import type { AuditLogRow, Profile } from "@/lib/db-types";
import { verifyChain } from "./actions";

export const metadata = { title: "Audit trail" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ actor?: string; before?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  let q = supabase.from("audit_log").select("*").order("id", { ascending: false }).limit(100);
  if (sp.actor) q = q.eq("actor_id", sp.actor);
  if (sp.before) q = q.lt("id", Number(sp.before));
  const [{ data }, { data: people }] = await Promise.all([q, supabase.from("profiles").select("id, full_name, initials").order("full_name")]);
  const rows = (data ?? []) as AuditLogRow[];
  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title="Audit trail"
        description="Append-only. Each entry carries the SHA-256 hash of the entry before it, so any edit or deletion outside the application breaks the chain and is detected here."
        actions={
          <ActionForm action={verifyChain} className="flex flex-col items-end gap-2">
            <Submit variant="secondary" pendingText="Verifying…">Verify chain integrity</Submit>
          </ActionForm>
        }
      />
      <form className="mb-4 flex items-center gap-2" action="/activity">
        <label htmlFor="actor" className="text-sm text-ink-2">Staff member</label>
        <Select id="actor" name="actor" defaultValue={sp.actor ?? ""} className="w-64">
          <option value="">Everyone</option>
          {((people ?? []) as Profile[]).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.initials})</option>)}
        </Select>
        <button className="h-9 cursor-pointer rounded-md px-3 text-base text-accent hover:bg-shelf" type="submit">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="ledger">
          <thead><tr><th className="num">#</th><th>When (MYT)</th><th>Who</th><th>What</th><th>Engagement</th><th>IP</th><th>Hash</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="num ref text-ink-3">{l.id}</td>
                <td className="whitespace-nowrap">{when(l.at)}</td>
                <td className="whitespace-nowrap">{l.actor_name || l.actor_email || <span className="text-ink-3">System</span>}</td>
                <td className="max-w-[48ch]">{describeEvent(l)}</td>
                <td>{l.engagement_id ? <Link className="text-accent hover:underline" href={`/engagements/${l.engagement_id}/activity`}>Open</Link> : null}</td>
                <td className="ref text-ink-3">{l.ip ?? ""}</td>
                <td className="ref text-ink-3" title={l.hash}>{l.hash.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 100 ? (
        <div className="mt-4"><Link className="text-accent hover:underline" href={`/activity?${new URLSearchParams({ ...(sp.actor ? { actor: sp.actor } : {}), before: String(rows[rows.length - 1].id) })}`}>Older entries</Link></div>
      ) : null}
    </div>
  );
}
