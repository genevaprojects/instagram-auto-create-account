import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/api";
import { runStep, PipelineBlocked } from "@/lib/pipeline/steps";
import type { PipelineStep } from "@/lib/db-types";

export const maxDuration = 300;
const STEPS: PipelineStep[] = ["extract", "map", "adjust", "analyse", "papers"];

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await ctx.params;
  if (!STEPS.includes(step as PipelineStep)) return NextResponse.json({ error: "Unknown step." }, { status: 404 });
  const s = await apiStaff();
  if ("error" in s) return s.error;
  try {
    const result = await runStep(s.supabase, id, step as PipelineStep, s.profile);
    return NextResponse.json(result, { status: result.status === "failed" ? 422 : 200 });
  } catch (e) {
    if (e instanceof PipelineBlocked) return NextResponse.json({ status: "blocked", summary: e.message }, { status: 409 });
    return NextResponse.json({ status: "failed", summary: (e as Error).message }, { status: 500 });
  }
}
