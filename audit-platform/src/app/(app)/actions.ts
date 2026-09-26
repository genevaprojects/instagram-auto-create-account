"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/session";

export async function idleSignOut() {
  const supabase = await createClient();
  try {
    await logEvent(supabase, "auth.idle_sign_out");
  } catch {}
  await supabase.auth.signOut();
  redirect("/login?error=idle");
}
