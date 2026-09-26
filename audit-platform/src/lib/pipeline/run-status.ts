import type { PipelineRun } from "../db-types";

/** Background functions stop after 15 minutes; a run still "running" after this has died. */
export const RUN_TIMEOUT_MS = 16 * 60 * 1000;
export const RUN_TIMEOUT_MESSAGE = "The step stopped before finishing (time limit reached). Run it again; if it keeps stopping, split the uploaded documents.";

export function isStale(run: Pick<PipelineRun, "status" | "started_at">, now = Date.now()) {
  return run.status === "running" && now - new Date(run.started_at).getTime() > RUN_TIMEOUT_MS;
}

/** How a run should be shown and treated: a stale "running" run counts as failed. */
export function effectiveRun<R extends Pick<PipelineRun, "status" | "started_at" | "error">>(run: R, now = Date.now()): R {
  return isStale(run, now) ? { ...run, status: "failed", error: run.error ?? RUN_TIMEOUT_MESSAGE } : run;
}
