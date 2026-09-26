"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { hasRole } from "@/lib/session";
import type { ReviewPointRow } from "@/lib/db-types";

const rev = (fd: FormData) => `/engagements/${fd.get("engagement_id")}`;

export const raisePoint = staffAction(async ({ supabase }, fd) => {
  const body = str(fd, "body");
  if (body.length < 5) return { error: "Describe the point." };
  must(await supabase.from("review_points").insert({ engagement_id: str(fd, "engagement_id"), wp_ref: str(fd, "wp_ref") || null, body }));
  return { ok: "Review point raised." };
}, rev);

export const respondPoint = staffAction(async ({ supabase, profile }, fd) => {
  const response = str(fd, "response");
  if (response.length < 5) return { error: "Write a response describing what was done." };
  must(await supabase.from("review_points").update({ response, responded_by: profile.id, responded_at: new Date().toISOString(), status: "responded" }).eq("id", str(fd, "id")));
  return { ok: "Response recorded." };
}, rev);

export const clearPoint = staffAction(async ({ supabase, profile }, fd) => {
  const p = must(await supabase.from("review_points").select("*").eq("id", str(fd, "id")).single()) as ReviewPointRow;
  const aiRaised = p.body.startsWith("[AI]");
  if (!aiRaised && p.raised_by !== profile.id && !hasRole(profile, ["manager", "partner"])) return { error: "Only the person who raised the point, a manager or a partner can clear it." };
  if (aiRaised && !hasRole(profile, ["senior", "manager", "partner"])) return { error: "AI-raised points are cleared by a senior, manager or partner." };
  if (p.status === "open") return { error: "Record a response before clearing." };
  must(await supabase.from("review_points").update({ status: "cleared", cleared_by: profile.id, cleared_at: new Date().toISOString() }).eq("id", p.id));
  return { ok: "Cleared." };
}, rev);
