"use server";
import { requireStaff, logEvent } from "@/lib/session";
import type { ActionState } from "@/components/action-form";

export async function verifyChain(): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("verify_audit_chain");
  if (error) return { error: error.message };
  const row = (data as { checked: number; first_broken_id: number | null }[])[0];
  await logEvent(supabase, "audit_chain.verified", { details: { checked: row.checked, intact: row.first_broken_id === null } });
  return row.first_broken_id === null
    ? { ok: `Chain intact: all ${row.checked.toLocaleString()} entries verify against their SHA-256 hashes.` }
    : { error: `Chain broken at entry #${row.first_broken_id}. Someone altered the trail outside the application. Escalate to the partner immediately.` };
}
