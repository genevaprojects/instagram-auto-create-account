"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/session";
import type { ActionState } from "@/components/action-form";

async function origin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/");
  if (!email || !password) return { error: "Enter your firm email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Confirm your email address first. Check your inbox for the link we sent when you created your account." };
    return { error: "That email and password do not match a staff account." };
  }
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).single();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: "Your access has been suspended. Speak to a partner." };
  }
  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
  await logEvent(supabase, "auth.sign_in", { entityType: "profiles", entityId: data.user.id });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fullName = String(fd.get("full_name") ?? "").trim();
  const initials = String(fd.get("initials") ?? "").trim().toUpperCase();
  if (!email || !fullName || !initials) return { error: "Fill in every field." };
  if (!/^[A-Z]{2,6}$/.test(initials)) return { error: "Initials must be 2 to 6 letters, as you sign working papers (for example AL or KCT)." };
  if (password.length < 12) return { error: "Use a password of at least 12 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback`, data: { full_name: fullName, initials } },
  });
  if (error) {
    if (/database error|STAFF_NOT_AUTHORISED/i.test(error.message)) {
      return { error: "This email is not on the firm's staff list. Ask a partner to add you on the Staff page, then try again." };
    }
    if (/already registered|already exists/i.test(error.message)) return { error: "An account already exists for this email. Sign in instead." };
    return { error: error.message };
  }
  return { ok: "Account created. Open the confirmation email we just sent, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  try {
    await logEvent(supabase, "auth.sign_out");
  } catch {
    // session may already be gone
  }
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your firm email." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/profile?password=reset")}` });
  // Same response whether or not the account exists, so the form cannot be used to probe staff emails
  return { ok: "If that email belongs to a staff account, a reset link is on its way." };
}
