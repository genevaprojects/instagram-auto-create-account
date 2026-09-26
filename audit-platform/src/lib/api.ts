import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import type { Profile } from "./db-types";

/** API-route variant of requireStaff: returns JSON errors instead of redirecting. */
export async function apiStaff() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single<Profile>();
  if (!profile || profile.status !== "active") return { error: NextResponse.json({ error: "Your access is suspended." }, { status: 403 }) } as const;
  if (!profile.full_name || !profile.initials) return { error: NextResponse.json({ error: "Complete your profile first." }, { status: 403 }) } as const;
  return { supabase, profile } as const;
}
