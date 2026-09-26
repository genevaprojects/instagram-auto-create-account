import { createClient } from "@supabase/supabase-js";
import { executeRun } from "../../src/lib/pipeline/steps";
import { verifyJob, JOB_MAX_AGE_MS } from "../../src/lib/pipeline/job-token";
import type { PipelineRun, PipelineStep, Profile } from "../../src/lib/db-types";
import type { RequestMeta } from "../../src/lib/audit-log";

/**
 * Netlify background function (the "-background" suffix gives it 15 minutes and an immediate 202).
 * Runs one AI pipeline step that the API route has already validated and recorded as "running".
 * It acts as the staff member who started the run: their access token is forwarded, so row-level
 * security, the audit triggers and the "started by" attribution are unchanged.
 */
interface Job {
  runId: string;
  engagementId: string;
  step: PipelineStep;
  token: string;
  meta: RequestMeta;
  issuedAt: number;
}

const pipelineBackground = async (req: Request) => {
  const body = await req.text();
  if (!verifyJob(body, req.headers.get("x-job-signature"))) {
    console.error("pipeline-background: rejected job with a bad signature");
    return;
  }
  const job = JSON.parse(body) as Job;
  if (Date.now() - job.issuedAt > JOB_MAX_AGE_MS) {
    console.error(`pipeline-background: rejected stale job for run ${job.runId}`);
    return;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${job.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fail = (message: string) =>
    supabase.from("pipeline_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", job.runId).eq("status", "running");

  const { data: claims } = await supabase.auth.getClaims(job.token);
  const uid = claims?.claims?.sub;
  if (!uid) {
    console.error(`pipeline-background: invalid access token for run ${job.runId}`);
    return;
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single<Profile>();
  if (!profile || profile.status !== "active") {
    await fail("Your access was suspended before the step ran.");
    return;
  }
  const { data: run } = await supabase.from("pipeline_runs").select("*").eq("id", job.runId).maybeSingle<PipelineRun>();
  if (!run || run.status !== "running" || run.started_by !== uid || run.engagement_id !== job.engagementId || run.step !== job.step) {
    console.error(`pipeline-background: run ${job.runId} does not match the job`);
    return;
  }

  const result = await executeRun(supabase, job.runId, job.engagementId, job.step, profile, job.meta);
  console.log(`pipeline-background: run ${job.runId} (${job.step}) ${result.status}`);
};

export default pipelineBackground;
