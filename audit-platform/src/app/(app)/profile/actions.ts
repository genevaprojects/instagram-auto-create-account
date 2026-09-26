"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, str } from "@/lib/actions-core";
import type { ActionState } from "@/components/action-form";

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");
  const full_name = str(fd, "full_name");
  const initials = str(fd, "initials").toUpperCase();
  if (!full_name) return { error: "Enter your full name." };
  if (!/^[A-Z]{2,6}$/.test(initials)) return { error: "Initials must be 2 to 6 letters." };
  const { error } = await supabase.from("profiles").update({ full_name, initials }).eq("id", uid);
  if (error) return { error: friendlyDbError(error.message) };
  if (fd.get("setup") === "1") redirect("/");
  return { ok: "Profile saved. New sign-offs will use this name and these initials." };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const { verifyPassword } = await import("@/lib/supabase/server");
  const { logEvent } = await import("@/lib/session");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const c = claims?.claims as { sub?: string; email?: string; amr?: { method: string; timestamp: number }[] } | undefined;
  if (!c?.sub || !c.email) redirect("/login");
  const next = String(fd.get("new_password") ?? "");
  const confirm = String(fd.get("confirm_password") ?? "");
  const current = String(fd.get("current_password") ?? "");
  if (next.length < 12) return { error: "Use at least 12 characters." };
  if (next !== confirm) return { error: "The two new passwords do not match." };
  // A session created from an emailed reset link within the last 15 minutes may skip the current password
  const recovered = (c.amr ?? []).some((a) => ["otp", "recovery", "magiclink"].includes(a.method) && Date.now() / 1000 - a.timestamp < 900);
  if (!recovered && !(await verifyPassword(c.email, current))) return { error: "Your current password is incorrect." };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  await logEvent(supabase, "auth.password_changed", { entityType: "profiles", entityId: c.sub, details: { via: recovered ? "reset_link" : "current_password" } });
  return { ok: "Password changed. Use it for signing from now on." };
}
