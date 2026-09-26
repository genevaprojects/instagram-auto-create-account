import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { verifyPassword } from "@/lib/supabase/server";
import { logEvent, requestMeta } from "@/lib/session";
import { loadBundle, latestRun } from "@/lib/pipeline/bundle";
import { snapshotHash } from "@/lib/snapshot";
import { signoffStatement } from "@/lib/declarations";
import { dmy } from "@/lib/export/format";

type Stage = "preparer" | "reviewer" | "partner";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const { supabase, profile } = s;
  const body = (await req.json().catch(() => ({}))) as { stage?: Stage; typedName?: string; password?: string; agree?: boolean };
  const stage = body.stage;
  if (!stage || !["preparer", "reviewer", "partner"].includes(stage)) return NextResponse.json({ error: "Unknown sign-off stage." }, { status: 400 });
  const b = await loadBundle(supabase, id);
  if (!b) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (b.engagement.status === "locked") return NextResponse.json({ error: "Already signed and locked." }, { status: 409 });

  const blockers: string[] = [];
  const papersRun = latestRun(b, "papers");
  if (!papersRun || papersRun.status === "failed") blockers.push("Working papers have not been drafted (step 5).");
  if (b.documents.some((d) => d.status === "awaiting_signoff")) blockers.push("Some uploaded documents are not signed.");
  if (!b.verified) blockers.push("Not every trial-balance line is verified.");
  if (b.adjustments.some((a) => a.status === "proposed")) blockers.push("Some adjustments are still undecided.");
  if (!b.etb?.balanced) blockers.push("The extended trial balance does not balance.");
  if (stage === "preparer" && b.papers.some((p) => p.status === "draft")) blockers.push(`Mark every working paper prepared (${b.papers.filter((p) => p.status === "draft").map((p) => p.ref).join(", ")}).`);
  if (stage !== "preparer" && b.papers.some((p) => p.status !== "reviewed")) blockers.push(`Every working paper must be reviewed first (${b.papers.filter((p) => p.status !== "reviewed").map((p) => p.ref).join(", ")}).`);
  if (stage === "reviewer" && b.reviewPoints.some((r) => r.status === "open")) blockers.push("Some review points have no response yet.");
  if (stage === "partner" && b.reviewPoints.some((r) => r.status !== "cleared")) blockers.push("Every review point must be cleared.");
  if (blockers.length) return NextResponse.json({ error: blockers.join(" ") }, { status: 409 });

  if (!body.agree) return NextResponse.json({ error: "Tick the statement to sign." }, { status: 400 });
  const norm = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  if (norm(body.typedName ?? "") !== norm(profile.full_name)) return NextResponse.json({ error: `Type your full name exactly as on your profile: ${profile.full_name}` }, { status: 400 });
  if (!body.password || !(await verifyPassword(profile.email, body.password))) {
    await logEvent(supabase, "engagement.signoff_failed", { engagementId: id, details: { stage, reason: "password" } });
    return NextResponse.json({ error: "Password incorrect. The failed attempt has been recorded." }, { status: 401 });
  }
  const meta = await requestMeta();
  const hash = snapshotHash(b);
  const statement = signoffStatement(stage, { name: profile.full_name, initials: profile.initials, client: b.client.name, yearEnd: dmy(b.engagement.fy_end) });
  const { error } = await supabase.from("signoffs").insert({ engagement_id: id, stage, signed_name: profile.full_name, initials: profile.initials, role: profile.role, ip: meta.ip, user_agent: meta.ua, statement, snapshot_hash: hash });
  if (error) return NextResponse.json({ error: error.message.replace(/^.*?ERROR:\s*/, "") }, { status: 409 });
  if (stage === "preparer") await supabase.from("engagements").update({ status: "review" }).eq("id", id);
  await logEvent(supabase, "engagement.signoff", { engagementId: id, details: { stage, snapshot_hash: hash } });
  return NextResponse.json({ ok: true, snapshot_hash: hash });
}
