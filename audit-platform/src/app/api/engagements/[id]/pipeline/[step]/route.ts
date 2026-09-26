import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { requestMeta } from "@/lib/session";
import { runStep, startRun, PipelineBlocked } from "@/lib/pipeline/steps";
import { effectiveRun } from "@/lib/pipeline/run-status";
import { signJob } from "@/lib/pipeline/job-token";
import type { PipelineRun, PipelineStep } from "@/lib/db-types";

export const maxDuration = 300;
const STEPS: PipelineStep[] = ["extract", "map", "adjust", "analyse", "papers"];

/**
 * "inline" runs the step inside this request (Vercel allows up to 300 s).
 * "background" (the default on Netlify, whose requests stop after about a minute) records the run,
 * hands it to the pipeline-background function (up to 15 minutes) and returns 202; the browser polls GET.
 */
const MODE = process.env.PIPELINE_MODE ?? (process.env.NETLIFY ? "background" : "inline");

export async function POST(req: Request, ctx: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await ctx.params;
  if (!STEPS.includes(step as PipelineStep)) return NextResponse.json({ error: "Unknown step." }, { status: 404 });
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const meta = await requestMeta();
  try {
    if (MODE !== "background") {
      const result = await runStep(s.supabase, id, step as PipelineStep, s.profile, meta);
      return NextResponse.json(result, { status: result.status === "failed" ? 422 : 200 });
    }

    const runId = await startRun(s.supabase, id, step as PipelineStep);
    const fail = async (message: string) => {
      await s.supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", runId);
      return NextResponse.json({ status: "failed", summary: message }, { status: 500 });
    };

    // The background function acts as this staff member (RLS and the audit trail apply), so it
    // needs an access token that outlives the run. Refresh if less than 20 minutes remain.
    let { data: { session } } = await s.supabase.auth.getSession();
    if (!session || (session.expires_at ?? 0) * 1000 - Date.now() < 20 * 60 * 1000) {
      ({ data: { session } } = await s.supabase.auth.refreshSession());
    }
    if (!session) return fail("Your session could not be renewed. Sign in again and re-run the step.");

    const body = JSON.stringify({ runId, engagementId: id, step, token: session.access_token, meta, issuedAt: Date.now() });
    const signature = signJob(body);
    if (!signature) return fail("PIPELINE_JOB_SECRET is not configured on the server.");
    const res = await fetch(new URL("/.netlify/functions/pipeline-background", req.url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-job-signature": signature },
      body,
    }).catch(() => null);
    if (!res || (res.status !== 202 && !res.ok)) return fail(`The background worker could not be started (${res?.status ?? "network error"}).`);
    return NextResponse.json({ runId, status: "running", summary: "Started." }, { status: 202 });
  } catch (e) {
    if (e instanceof PipelineBlocked) return NextResponse.json({ status: "blocked", summary: e.message }, { status: 409 });
    return NextResponse.json({ status: "failed", summary: (e as Error).message }, { status: 500 });
  }
}

/** Progress of one run, polled by the browser while a background step works. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; step: string }> }) {
  const { id } = await ctx.params;
  const runId = new URL(req.url).searchParams.get("run");
  if (!runId) return NextResponse.json({ error: "Missing run." }, { status: 400 });
  const s = await apiStaff();
  if ("error" in s) return s.error;
  const { data } = await s.supabase.from("pipeline_runs").select("*").eq("id", runId).eq("engagement_id", id).maybeSingle<PipelineRun>();
  if (!data) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  const run = effectiveRun(data);
  if (run.status === "failed" && data.status === "running") {
    await s.supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: run.error }).eq("id", runId).eq("status", "running");
  }
  return NextResponse.json({ runId, status: run.status, summary: run.status === "failed" ? run.error : run.summary });
}
