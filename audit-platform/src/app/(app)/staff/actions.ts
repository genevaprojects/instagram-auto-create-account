"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { hasRole } from "@/lib/session";

const ROLES = ["admin", "partner", "manager", "senior", "associate"];

export const addStaff = staffAction(async ({ supabase, profile }, fd) => {
  if (!hasRole(profile, ["admin", "partner"])) return { error: "Only a partner or administrator can add staff." };
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  must(await supabase.from("staff_allowlist").insert({ email, role, full_name: str(fd, "full_name") || null, initials: str(fd, "initials").toUpperCase() || null, added_by: profile.id }));
  return { ok: `${email} can now create an account at /signup.` };
}, "/staff");

export const updateStaff = staffAction(async ({ supabase, profile }, fd) => {
  if (!hasRole(profile, ["admin", "partner"])) return { error: "Only a partner or administrator can change access." };
  const id = str(fd, "id");
  const email = str(fd, "email");
  const intent = str(fd, "intent");
  if (intent === "suspend" || intent === "reactivate") {
    if (id === profile.id) return { error: "You cannot change your own access." };
    must(await supabase.from("profiles").update({ status: intent === "suspend" ? "suspended" : "active" }).eq("id", id));
    return { ok: intent === "suspend" ? "Access suspended. Their session ends on the next request." : "Access restored." };
  }
  if (intent === "role") {
    const role = str(fd, "role");
    if (!ROLES.includes(role)) return { error: "Choose a role." };
    if (id) must(await supabase.from("profiles").update({ role }).eq("id", id));
    must(await supabase.from("staff_allowlist").update({ role }).eq("email", email));
    return { ok: "Role updated." };
  }
  if (intent === "revoke") {
    if (email === profile.email) return { error: "You cannot revoke yourself." };
    must(await supabase.from("staff_allowlist").update({ revoked_at: new Date().toISOString() }).eq("email", email));
    if (id) must(await supabase.from("profiles").update({ status: "suspended" }).eq("id", id));
    return { ok: "Removed from the staff list. They can no longer sign in or register." };
  }
  return { error: "Unknown action." };
}, "/staff");
