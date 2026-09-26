import Link from "next/link";
import { requireStaff, hasRole } from "@/lib/session";
import { MODULES } from "@/lib/training";
import { Badge, PageHeader, Section, day } from "@/components/ui";
import type { Profile } from "@/lib/db-types";

export const metadata = { title: "Training" };

type Rec = { staff_id: string; module_id: string; module_version: number; passed: boolean; completed_at: string };

export default async function TrainingPage() {
  const { supabase, profile } = await requireStaff();
  const supervisor = hasRole(profile, ["admin", "partner", "manager"]);
  const [{ data: recs }, { data: people }] = await Promise.all([
    supabase.from("training_records").select("staff_id, module_id, module_version, passed, completed_at").order("completed_at", { ascending: false }),
    supervisor ? supabase.from("profiles").select("id, full_name, initials, status").eq("status", "active").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const records = (recs ?? []) as Rec[];
  const passedBy = (staff: string, id: string, version: number) => records.find((r) => r.staff_id === staff && r.module_id === id && r.module_version === version && r.passed);
  const coreLeft = MODULES.filter((m) => m.core && !passedBy(profile.id, m.id, m.version)).length;

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Training centre"
        description="Short modules built from the weaknesses audit regulators find most often, including the MIA Practice Review, the Audit Oversight Board, ICAEW and the FRC. Each ends with a knowledge check; results are recorded on your training record."
      />
      <Section title="Modules" description={coreLeft ? `${coreLeft} core module(s) still to complete.` : "All core modules complete."}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => {
            const done = passedBy(profile.id, m.id, m.version);
            return (
              <li key={m.id}>
                <Link href={`/training/${m.id}`} className="flex h-full flex-col gap-2 rounded-md border border-rule bg-surface p-4 transition-colors duration-150 hover:border-rule-strong">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{m.title}</p>
                    {done ? <Badge tone="accent">Passed {day(done.completed_at)}</Badge> : m.core ? <Badge tone="warn">Core</Badge> : <Badge>Optional</Badge>}
                  </div>
                  <p className="text-xs text-ink-3">{m.standards} · {m.minutes} min · {m.questions.length} questions</p>
                  <p className="line-clamp-2 text-sm text-ink-2">{m.why}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
      {supervisor ? (
        <Section title="Team progress" description="Current version of each module passed. Visible to managers and partners.">
          <div className="overflow-x-auto rounded-md border border-rule bg-surface">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Staff</th>
                  {MODULES.map((m) => <th key={m.id} title={m.title} className="text-center">{m.title.split(/[ :]/)[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {((people ?? []) as Profile[]).map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{p.full_name} <span className="ref text-ink-3">{p.initials}</span></td>
                    {MODULES.map((m) => {
                      const d = passedBy(p.id, m.id, m.version);
                      return <td key={m.id} className="text-center text-xs">{d ? <span className="text-accent-ink">{day(d.completed_at)}</span> : <span className={m.core ? "text-warn" : "text-ink-3"}>{m.core ? "Due" : "-"}</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
