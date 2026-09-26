"use server";
import { staffAction, must, str } from "@/lib/actions-core";
import { ALL_GROUPS, LEAD_REFS } from "@/lib/audit/catalog";
import type { TbLineRow } from "@/lib/db-types";

export const saveMapping = staffAction(async ({ supabase, profile }, fd) => {
  const engagementId = str(fd, "engagement_id");
  const intent = str(fd, "intent");
  const lines = must(await supabase.from("tb_lines").select("*").eq("engagement_id", engagementId)) as TbLineRow[];
  let changed = 0;
  let verified = 0;
  const now = new Date().toISOString();
  for (const l of lines) {
    if (l.verified_by) continue;
    const caption = str(fd, `caption_${l.id}`);
    const group = str(fd, `group_${l.id}`);
    const ref = str(fd, `ref_${l.id}`);
    const tick = fd.get(`verify_${l.id}`) === "on" || intent === "verify_all";
    const patch: Record<string, unknown> = {};
    if (caption && caption !== l.fs_caption) patch.fs_caption = caption;
    if (group && group !== l.fs_group) {
      if (!ALL_GROUPS.includes(group as never)) throw new Error(`Unknown group "${group}".`);
      patch.fs_group = group;
    }
    if (ref && ref !== l.wp_ref) {
      if (!LEAD_REFS.includes(ref)) throw new Error(`"${ref}" is not a lead schedule in the firm index.`);
      patch.wp_ref = ref;
    }
    if (Object.keys(patch).length) {
      patch.mapped_by = "staff";
      changed++;
    }
    const final = { caption: (patch.fs_caption as string) ?? l.fs_caption, group: (patch.fs_group as string) ?? l.fs_group, ref: (patch.wp_ref as string) ?? l.wp_ref };
    if (tick && intent !== "save") {
      if (!final.caption || !final.group || !final.ref) throw new Error(`${l.account_name} must have a caption, group and lead reference before it can be verified.`);
      patch.verified_by = profile.id;
      patch.verified_at = now;
      verified++;
    }
    if (Object.keys(patch).length) must(await supabase.from("tb_lines").update(patch).eq("id", l.id));
  }
  return { ok: `${changed} mapping(s) changed, ${verified} verified.` };
}, (fd) => `/engagements/${fd.get("engagement_id")}`);

export const reopenLine = staffAction(async ({ supabase }, fd) => {
  const engagementId = str(fd, "engagement_id");
  const decided = must(await supabase.from("adjustments").select("id").eq("engagement_id", engagementId).neq("status", "proposed")) as unknown[];
  if (decided.length) return { error: "Adjustments have already been decided on this mapping. Reopening is locked; raise a review point instead." };
  must(await supabase.from("tb_lines").update({ verified_by: null, verified_at: null }).eq("id", str(fd, "id")));
  return { ok: "Reopened for editing." };
}, (fd) => `/engagements/${fd.get("engagement_id")}`);
