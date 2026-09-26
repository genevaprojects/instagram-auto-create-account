import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import type { Profile, StaffRole } from "./db-types";
import { writeEvent, type RequestMeta } from "./audit-log";

export interface Staff {
  supabase: SupabaseClient;
  profile: Profile;
}

/** Resolve the signed-in, active staff member or redirect. Cached per request. */
export const requireStaff = cache(async (opts: { allowIncompleteProfile?: boolean } = {}): Promise<Staff> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single<Profile>();
  if (!profile) redirect("/login?error=no_profile");
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?error=suspended");
  }
  if (!opts.allowIncompleteProfile && (!profile.full_name.trim() || !profile.initials.trim())) {
    redirect("/profile?setup=1");
  }
  return { supabase, profile };
});

export function hasRole(profile: Profile, roles: StaffRole[]) {
  return roles.includes(profile.role);
}

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
}

/** Explicit audit-trail event (row changes are captured by database triggers). */
export async function logEvent(
  supabase: SupabaseClient,
  action: string,
  opts: { entityType?: string; entityId?: string; engagementId?: string | null; details?: Record<string, unknown> } = {},
) {
  await writeEvent(supabase, action, opts, await requestMeta());
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Administrator",
  partner: "Partner",
  manager: "Manager",
  senior: "Senior",
  associate: "Associate",
};
