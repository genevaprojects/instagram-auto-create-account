import type { SupabaseClient } from "@supabase/supabase-js";

export interface RequestMeta {
  ip: string | null;
  ua: string | null;
}

/**
 * Explicit audit-trail event. Free of Next.js request APIs so the pipeline can also
 * write events from a Netlify background function; the caller supplies the request metadata.
 */
export async function writeEvent(
  supabase: SupabaseClient,
  action: string,
  opts: { entityType?: string; entityId?: string; engagementId?: string | null; details?: Record<string, unknown> },
  meta: RequestMeta,
) {
  const { error } = await supabase.rpc("log_event", {
    p_action: action,
    p_entity_type: opts.entityType ?? null,
    p_entity_id: opts.entityId ?? null,
    p_engagement: opts.engagementId ?? null,
    p_details: opts.details ?? {},
    p_ip: meta.ip,
    p_ua: meta.ua,
  });
  if (error) throw new Error(`Audit trail write failed: ${error.message}`);
}
