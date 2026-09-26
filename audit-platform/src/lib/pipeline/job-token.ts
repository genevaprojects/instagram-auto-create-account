import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs the hand-off from the pipeline API route to the background function, so the function
 * only runs jobs the app itself issued. The body also carries the staff member's access token,
 * so the work still runs under their identity and row-level security.
 */
export const JOB_MAX_AGE_MS = 2 * 60 * 1000;

function secret() {
  return process.env.PIPELINE_JOB_SECRET || "";
}

export function signJob(body: string): string | null {
  const key = secret();
  return key ? createHmac("sha256", key).update(body).digest("hex") : null;
}

export function verifyJob(body: string, signature: string | null): boolean {
  const expected = signJob(body);
  if (!expected || !signature || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
