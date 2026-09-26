"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { hasRole } from "@/lib/session";
import type { WorkingPaperRow } from "@/lib/db-types";

const rev = (fd: FormData) => `/engagements/${fd.get("engagement_id")}`;

export const setPaperStatus = staffAction(async ({ supabase, profile }, fd) => {
  const id = str(fd, "id");
  const to = str(fd, "to");
  const p = must(await supabase.from("working_papers").select("*").eq("id", id).single()) as WorkingPaperRow;
  const now = new Date().toISOString();
  if (to === "prepared") {
    if (p.status !== "draft") return { error: "Already prepared." };
    must(await supabase.from("working_papers").update({ status: "prepared", prepared_by: profile.id, prepared_at: now }).eq("id", id));
    return { ok: `${p.ref} marked prepared by ${profile.initials}.` };
  }
  if (to === "reviewed") {
    if (!hasRole(profile, ["manager", "partner"])) return { error: "Review requires a manager or partner." };
    if (p.status !== "prepared") return { error: "The paper must be prepared before review." };
    if (p.prepared_by === profile.id) return { error: "You prepared this paper; another person must review it." };
    must(await supabase.from("working_papers").update({ status: "reviewed", reviewed_by: profile.id, reviewed_at: now }).eq("id", id));
    return { ok: `${p.ref} reviewed by ${profile.initials}.` };
  }
  if (to === "draft") {
    if (p.status === "reviewed" && !hasRole(profile, ["manager", "partner"])) return { error: "Only a manager or partner can reopen a reviewed paper." };
    must(await supabase.from("working_papers").update({ status: "draft", reviewed_by: null, reviewed_at: null, prepared_by: null, prepared_at: null }).eq("id", id));
    return { ok: `${p.ref} reopened.` };
  }
  return { error: "Unknown action." };
}, rev);

export const savePaperContent = staffAction(async ({ supabase }, fd) => {
  const id = str(fd, "id");
  const p = must(await supabase.from("working_papers").select("*").eq("id", id).single()) as WorkingPaperRow;
  if (p.status !== "draft") return { error: "Reopen the paper before editing." };
  const content: Record<string, unknown> = { ...p.content };
  for (const [key, value] of Object.entries(p.content)) {
    if (typeof value === "string" && fd.has(`f:${key}`)) content[key] = str(fd, `f:${key}`);
    else if (Array.isArray(value) && value.every((v) => typeof v === "string") && fd.has(`l:${key}`)) {
      content[key] = str(fd, `l:${key}`).split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "heading" in v && "body" in v)) {
      content[key] = (value as { heading: string; body: string }[]).map((s, i) => ({ heading: s.heading, body: fd.has(`s:${key}:${i}`) ? str(fd, `s:${key}:${i}`) : s.body }));
    }
  }
  content.edited_by_staff = true;
  must(await supabase.from("working_papers").update({ content, updated_at: new Date().toISOString() }).eq("id", id));
  return { ok: "Saved. The change is recorded in the audit trail." };
}, rev);
