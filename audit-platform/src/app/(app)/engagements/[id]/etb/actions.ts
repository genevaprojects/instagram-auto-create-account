"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { hasRole } from "@/lib/session";

export const saveMaterialityChoice = staffAction(async ({ supabase, profile }, fd) => {
  if (!hasRole(profile, ["manager", "partner", "admin"])) return { error: "The materiality basis is set by a manager or partner." };
  const id = str(fd, "engagement_id");
  const method = str(fd, "method") === "isa320" ? "isa320" : "firm";
  const risk = ["low", "moderate", "high"].includes(str(fd, "risk")) ? str(fd, "risk") : "low";
  const profileKind = ["profit_oriented", "asset_holding", "loss_or_breakeven"].includes(str(fd, "entity_profile")) ? str(fd, "entity_profile") : undefined;
  const reason = str(fd, "reason");
  if (reason.length < 20) return { error: "Record the reason for this basis in at least one full sentence (ISA 320.14)." };
  const { data } = await supabase.from("engagements").select("settings").eq("id", id).single();
  must(await supabase.from("engagements").update({ settings: { ...(data?.settings ?? {}), materiality_method: method, risk_level: risk, entity_profile: profileKind, materiality_reason: reason } }).eq("id", id));
  return { ok: "Materiality basis recorded." };
}, (fd) => `/engagements/${fd.get("engagement_id")}`);
