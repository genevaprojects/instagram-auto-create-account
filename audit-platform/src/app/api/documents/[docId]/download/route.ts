import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { logEvent } from "@/lib/session";
import { BUCKET } from "@/lib/pipeline/documents";
import type { DocumentRow } from "@/lib/db-types";

export async function GET(_req: Request, ctx: { params: Promise<{ docId: string }> }) {
  const { docId } = await ctx.params;
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const { data: doc } = await s.supabase.from("documents").select("*").eq("id", docId).single<DocumentRow>();
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data, error } = await s.supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.filename });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create link." }, { status: 500 });
  await logEvent(s.supabase, "document.downloaded", { entityType: "documents", entityId: docId, engagementId: doc.engagement_id, details: { filename: doc.filename } });
  return NextResponse.redirect(data.signedUrl);
}
