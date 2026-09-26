import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { logEvent } from "@/lib/session";
import { loadBundle } from "@/lib/pipeline/bundle";
import { buildAwpWorkbook } from "@/lib/export/awp";
import { buildIndexDocx, buildPlanningDocx } from "@/lib/export/word";
import { fileSafe } from "@/lib/export/format";

export const maxDuration = 60;

const KINDS = {
  awp: { label: "Audit working papers (xlsx)", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  planning: { label: "Planning memo (docx)", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  index: { label: "Index - current audit file (docx)", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
} as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await ctx.params;
  const spec = KINDS[kind as keyof typeof KINDS];
  if (!spec) return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const b = await loadBundle(s.supabase, id);
  if (!b) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!b.etb) return NextResponse.json({ error: "Map the trial balance before exporting." }, { status: 409 });
  const firm = process.env.FIRM_NAME || "Chartered Accountants";
  const buf = kind === "awp" ? await buildAwpWorkbook(b, firm) : kind === "planning" ? await buildPlanningDocx(b) : await buildIndexDocx(b);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  await logEvent(s.supabase, "export.downloaded", { entityType: "engagements", entityId: id, engagementId: id, details: { kind: spec.label, sha256, draft: b.engagement.status !== "locked" } });
  const ye = new Date(b.engagement.fy_end).getUTCFullYear();
  const name = `${fileSafe(b.client.name)}_${kind.toUpperCase()}_YE${ye}${b.engagement.status === "locked" ? "_FINAL" : "_DRAFT"}.${spec.ext}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": spec.mime, "content-disposition": `attachment; filename="${name}"`, "x-content-sha256": sha256, "cache-control": "no-store" },
  });
}
