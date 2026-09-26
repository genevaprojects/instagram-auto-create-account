import { getEngagement } from "@/lib/engagement-page";
import { BS_GROUPS, PL_GROUPS, GROUP_NORMAL_SIGN } from "@/lib/audit/catalog";
import { formatRM, sum } from "@/lib/audit/money";
import { hasRole } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, EmptyState, Money, Notice, Section } from "@/components/ui";
import { saveMaterialityChoice } from "./actions";

export const metadata = { title: "ETB and materiality" };

export default async function EtbPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b, profile } = await getEngagement(id);
  if (!b.etb || !b.materiality) return <EmptyState title="Not available yet">The extended trial balance appears once every account is mapped (step 2).</EmptyState>;
  const { etb, materiality: m } = b;
  const f = m.final ?? m.draft;
  const canSet = hasRole(profile, ["manager", "partner", "admin"]) && b.engagement.status !== "locked";
  const de = (b.papers.find((p) => p.ref === "DE")?.content ?? {}) as { movements?: { fs_caption: string; explanation: string }[] };
  const explained = (c: string) => de.movements?.find((x) => x.fs_caption.toLowerCase() === c.toLowerCase());

  return (
    <div>
      <Section title="Planning materiality (AB2)" description="Both views are always computed. The firm's method takes the highest of three benchmarks; ISA 320 practice selects one benchmark suited to the entity and documents why.">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className={`rounded-md border bg-surface p-4 ${m.selected === "firm" ? "border-accent" : "border-rule"}`}>
            <div className="flex items-center justify-between"><p className="font-medium">Firm method ({m.final ? "final" : "draft"})</p>{m.selected === "firm" ? <Badge tone="accent">Adopted</Badge> : null}</div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {f.basis.map((x) => (
                  <tr key={x.name} className="border-b border-rule last:border-0"><td className="py-1.5 text-ink-2">{x.name} × {(x.rate * 100).toFixed(1)}%</td><td className="num py-1.5">{x.result === null ? "n/a" : formatRM(x.result)}</td></tr>
                ))}
                <tr><td className="py-1.5 font-medium">Materiality (rounded up)</td><td className="num py-1.5 font-semibold">{formatRM(f.materiality)}</td></tr>
                <tr><td className="py-1.5 text-ink-2">Performance (90%)</td><td className="num py-1.5">{formatRM(f.performance)}</td></tr>
                <tr><td className="py-1.5 text-ink-2">SAD threshold (5%)</td><td className="num py-1.5">{formatRM(f.sad)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className={`rounded-md border bg-surface p-4 ${m.selected === "isa320" ? "border-accent" : "border-rule"}`}>
            <div className="flex items-center justify-between"><p className="font-medium">ISA 320 view</p>{m.selected === "isa320" ? <Badge tone="accent">Adopted</Badge> : null}</div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                <tr className="border-b border-rule"><td className="py-1.5 text-ink-2">{m.isa.benchmark} × {(m.isa.rate * 100).toFixed(1)}%</td><td className="num py-1.5">{formatRM(m.isa.benchmarkAmount)}</td></tr>
                <tr><td className="py-1.5 font-medium">Materiality (rounded down)</td><td className="num py-1.5 font-semibold">{formatRM(m.isa.materiality)}</td></tr>
                <tr><td className="py-1.5 text-ink-2">Performance ({Math.round(m.isa.performanceRate * 100)}%, {m.riskLevel} risk)</td><td className="num py-1.5">{formatRM(m.isa.performance)}</td></tr>
                <tr><td className="py-1.5 text-ink-2">Clearly trivial (5%)</td><td className="num py-1.5">{formatRM(m.isa.clearlyTrivial)}</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-3">{m.isa.rationale}</p>
          </div>
          <div>
            {canSet ? (
              <ActionForm action={saveMaterialityChoice} className="flex flex-col gap-3">
                <input type="hidden" name="engagement_id" value={id} />
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Basis adopted
                  <select name="method" defaultValue={m.selected} className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink"><option value="firm">Firm method</option><option value="isa320">ISA 320 view</option></select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Entity profile
                  <select name="entity_profile" defaultValue={m.isa.profile} className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink"><option value="asset_holding">Asset / investment holding</option><option value="profit_oriented">Profit-oriented trading</option><option value="loss_or_breakeven">Loss-making or break-even</option></select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Engagement risk
                  <select name="risk" defaultValue={m.riskLevel} className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Reason (recorded on AB2)
                  <textarea name="reason" rows={3} defaultValue={m.selectedReason ?? ""} className="rounded-md border border-rule-strong bg-surface px-3 py-2 text-base text-ink" />
                </label>
                <div><Submit pendingText="Saving…">Record basis</Submit></div>
              </ActionForm>
            ) : (
              <p className="text-sm text-ink-2">{m.selectedReason ?? "The basis is set by the manager or partner."}</p>
            )}
          </div>
        </div>
        {m.selected === "firm" && f.materiality > m.isa.materiality * 1.5 ? (
          <div className="mt-4"><Notice tone="warn">Firm-method materiality is more than 50% above the ISA 320 view. Document why the higher level is appropriate, or adopt the ISA 320 figure. This note also appears on AB2.</Notice></div>
        ) : null}
      </Section>

      <Section
        title="Extended trial balance (DD)"
        description="Normal balances shown positive. Movements are flagged when they reach the SAD threshold and exceed 10% of the prior year, are new, or exceed performance materiality."
        actions={etb.balanced ? <Badge tone="accent">Balances</Badge> : <Badge tone="danger">Out of balance by {formatRM(etb.totals.cy_audited, { dashForZero: false })}</Badge>}
      >
        <div className="overflow-x-auto rounded-md border border-rule bg-surface">
          <table className="ledger">
            <thead>
              <tr><th>Caption</th><th>Lead</th><th className="num">PY audited</th><th className="num">CY per client</th><th className="num">Adjustments</th><th>Ref</th><th className="num">CY audited</th><th className="num">Movement</th><th>Analytical review</th></tr>
            </thead>
            <tbody>
              {[...BS_GROUPS, ...PL_GROUPS].map((g) => {
                const rows = etb.rows.filter((r) => r.fs_group === g);
                if (!rows.length) return null;
                const s = GROUP_NORMAL_SIGN[g];
                return [
                  <tr key={g} className="group"><td colSpan={9}>{g}</td></tr>,
                  ...rows.map((r) => {
                    const e = explained(r.fs_caption);
                    return (
                      <tr key={g + r.fs_caption}>
                        <td className="font-medium">{r.fs_caption}<p className="text-xs font-normal text-ink-3">{r.accounts.map((a) => a.account_name).join(", ") || "No current-year balance"}</p></td>
                        <td className="ref">{r.wp_ref}</td>
                        <td><Money cents={r.py === null ? null : s * r.py} /></td>
                        <td><Money cents={s * r.cy_client} /></td>
                        <td><Money cents={r.adj_dr - r.adj_cr ? s * (r.adj_dr - r.adj_cr) : null} /></td>
                        <td className="ref whitespace-nowrap">{r.adj_refs.join(", ")}</td>
                        <td><Money cents={s * r.cy_audited} strong /></td>
                        <td className={r.flagged ? "text-warn" : ""}><Money cents={r.movement === null ? null : s * r.movement} />{r.movement_pct !== null ? <p className="num text-xs">{(s * r.movement_pct * 100).toFixed(1)}%</p> : null}</td>
                        <td className="max-w-[40ch] text-xs text-ink-2">{r.flagged ? (e ? e.explanation : <span className="text-warn">Explanation required (step 4)</span>) : null}</td>
                      </tr>
                    );
                  }),
                  <tr key={g + "-t"} className="subtotal">
                    <td colSpan={2}>Total {g.toLowerCase()}</td>
                    <td><Money cents={rows.every((r) => r.py === null) ? null : s * sum(rows.map((r) => r.py ?? 0))} /></td>
                    <td><Money cents={s * sum(rows.map((r) => r.cy_client))} /></td>
                    <td><Money cents={s * sum(rows.map((r) => r.adj_dr - r.adj_cr)) || null} /></td>
                    <td />
                    <td><Money cents={s * sum(rows.map((r) => r.cy_audited))} /></td>
                    <td colSpan={2} />
                  </tr>,
                ];
              })}
              <tr className="grand"><td colSpan={2}>Profit before tax</td><td><Money cents={etb.totals.py_pbt} /></td><td><Money cents={etb.totals.pbt_client} /></td><td /><td /><td><Money cents={etb.totals.pbt_audited} /></td><td colSpan={2} /></tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
