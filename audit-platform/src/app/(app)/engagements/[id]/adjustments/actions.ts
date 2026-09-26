"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { hasRole } from "@/lib/session";
import { ALL_GROUPS, LEAD_REFS } from "@/lib/audit/catalog";
import { toCents, fromCents, sum } from "@/lib/audit/money";

const rev = (fd: FormData) => `/engagements/${fd.get("engagement_id")}`;

export const decideAdjustment = staffAction(async ({ supabase, profile }, fd) => {
  if (!hasRole(profile, ["senior", "manager", "partner", "admin"])) return { error: "Adjustments are decided by a senior, manager or partner." };
  const decision = str(fd, "decision");
  const note = str(fd, "note");
  if (!["accepted", "rejected", "uncorrected", "proposed"].includes(decision)) return { error: "Unknown decision." };
  if ((decision === "rejected" || decision === "uncorrected") && note.length < 10) {
    return { error: decision === "rejected" ? "Record why the entry is rejected (at least a sentence)." : "Record management's reason for not adjusting; it goes to the summary of audit differences (BB)." };
  }
  must(
    await supabase
      .from("adjustments")
      .update(decision === "proposed" ? { status: "proposed", decided_by: null, decided_at: null, decision_note: null } : { status: decision, decided_by: profile.id, decided_at: new Date().toISOString(), decision_note: note || null })
      .eq("id", str(fd, "id")),
  );
  return { ok: decision === "proposed" ? "Decision withdrawn." : `Entry ${decision}.` };
}, rev);

export const addManualAdjustment = staffAction(async ({ supabase, profile }, fd) => {
  const engagementId = str(fd, "engagement_id");
  const kind = str(fd, "kind") === "RJE" ? "RJE" : "AJE";
  const description = str(fd, "description");
  if (!description) return { error: "Describe the entry." };
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const account = str(fd, `account_${i}`);
    if (!account) continue;
    const fs_caption = str(fd, `caption_${i}`) || account;
    const fs_group = str(fd, `group_${i}`);
    const wp_ref = str(fd, `ref_${i}`);
    const dr = toCents(str(fd, `dr_${i}`) || 0);
    const cr = toCents(str(fd, `cr_${i}`) || 0);
    if (!ALL_GROUPS.includes(fs_group as never)) return { error: `Choose a group for "${account}".` };
    if (!LEAD_REFS.includes(wp_ref)) return { error: `Choose a lead reference for "${account}".` };
    if ((dr > 0) === (cr > 0) || dr < 0 || cr < 0) return { error: `"${account}" needs either a debit or a credit amount.` };
    lines.push({ account, fs_caption, fs_group, wp_ref, dr: fromCents(dr), cr: fromCents(cr) });
  }
  if (lines.length < 2) return { error: "An entry needs at least two lines." };
  const dr = sum(lines.map((l) => toCents(l.dr)));
  const cr = sum(lines.map((l) => toCents(l.cr)));
  if (dr !== cr) return { error: `Debits (${fromCents(dr).toFixed(2)}) do not equal credits (${fromCents(cr).toFixed(2)}).` };
  const existing = must(await supabase.from("adjustments").select("ref").eq("engagement_id", engagementId).eq("kind", kind)) as { ref: string }[];
  const next = Math.max(0, ...existing.map((e) => Number(/\d+/.exec(e.ref)?.[0] ?? 0))) + 1;
  must(
    await supabase.from("adjustments").insert({
      engagement_id: engagementId, ref: `${kind} ${next}`, kind, description, rationale: str(fd, "rationale") || null, evidence: str(fd, "evidence") || null,
      source: "staff", status: "proposed", lines, total: fromCents(dr), proposed_by: profile.id,
    }),
  );
  return { ok: `${kind} ${next} proposed. A senior, manager or partner must accept it.` };
}, rev);
