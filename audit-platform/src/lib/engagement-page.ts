import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireStaff } from "./session";
import { loadBundle } from "./pipeline/bundle";

/** Load the engagement bundle once per request for layout and page. */
export const getEngagement = cache(async (id: string) => {
  const staff = await requireStaff();
  const b = await loadBundle(staff.supabase, id);
  if (!b) notFound();
  return { ...staff, b };
});
