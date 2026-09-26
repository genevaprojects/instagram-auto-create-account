import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { verifyPassword } from "@/lib/supabase/server";
import { logEvent, requestMeta } from "@/lib/session";
import { uploadDeclaration } from "@/lib/declarations";
import type { DocumentRow } from "@/lib/db-types";

export async function POST(req: Request, ctx: { params: Promise<{ docId: string }> }) {
  const { docId } = await ctx.params;
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const { supabase, profile } = s;
  const body = (await req.json().catch(() => ({}))) as { typedName?: string; password?: string; agree?: boolean };
  const { data: doc } = await supabase.from("documents").select("*, engagements(clients(name))").eq("id", docId).single<DocumentRow & { engagements: { clients: { name: string } } }>();
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (doc.status !== "awaiting_signoff") return NextResponse.json({ error: "This document has already been signed or superseded." }, { status: 409 });
  if (doc.uploaded_by !== profile.id) return NextResponse.json({ error: "Only the staff member who uploaded a file can sign its attestation." }, { status: 403 });
  if (!body.agree) return NextResponse.json({ error: "Tick the declaration to sign." }, { status: 400 });
  const norm = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  if (norm(body.typedName ?? "") !== norm(profile.full_name)) {
    return NextResponse.json({ error: `Type your full name exactly as on your profile: ${profile.full_name}` }, { status: 400 });
  }
  if (!body.password || !(await verifyPassword(profile.email, body.password))) {
    await logEvent(supabase, "document.sign_failed", { entityType: "documents", entityId: docId, engagementId: doc.engagement_id, details: { reason: "password" } });
    return NextResponse.json({ error: "Password incorrect. The failed attempt has been recorded." }, { status: 401 });
  }
  const meta = await requestMeta();
  const declaration = uploadDeclaration({ name: profile.full_name, initials: profile.initials, client: doc.engagements.clients.name, filename: doc.filename, sha256: doc.sha256 });
  const { error } = await supabase
    .from("documents")
    .update({ status: "signed", signed_by: profile.id, signed_name: profile.full_name, signed_initials: profile.initials, signed_at: new Date().toISOString(), signed_ip: meta.ip, signed_user_agent: meta.ua, declaration })
    .eq("id", docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logEvent(supabase, "document.signed", { entityType: "documents", entityId: docId, engagementId: doc.engagement_id, details: { filename: doc.filename, sha256: doc.sha256 } });
  return NextResponse.json({ ok: true });
}
