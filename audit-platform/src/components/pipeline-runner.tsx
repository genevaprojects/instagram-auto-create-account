"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, CircleDashed, Loader2, Play, TriangleAlert } from "lucide-react";

export interface StepView {
  step: "extract" | "map" | "adjust" | "analyse" | "papers";
  title: string;
  description: string;
  status: "not_run" | "running" | "succeeded" | "needs_review" | "failed";
  summary: string | null;
  lastRun: string | null;
  runBy: string | null;
  tokens: string | null;
  blockedReason: string | null;
  reviewHref: string;
}

const ICON = {
  not_run: <CircleDashed className="size-5 text-ink-3" aria-hidden />,
  running: <Loader2 className="size-5 animate-spin text-accent" aria-hidden />,
  succeeded: <Check className="size-5 text-accent" aria-hidden />,
  needs_review: <TriangleAlert className="size-5 text-warn" aria-hidden />,
  failed: <CircleAlert className="size-5 text-danger" aria-hidden />,
};
const LABEL = { not_run: "Not run", running: "Running", succeeded: "Done", needs_review: "Done, needs review", failed: "Failed" };

export function PipelineRunner({ engagementId, steps, locked }: { engagementId: string; steps: StepView[]; locked: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ step: string; tone: "danger" | "warn" | "accent"; text: string } | null>(null);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const i = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(i);
  }, [running]);

  async function run(step: string) {
    setRunning(step);
    setElapsed(0);
    setMessage(null);
    try {
      const res = await fetch(`/api/engagements/${engagementId}/pipeline/${step}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { status?: string; summary?: string; error?: string };
      const text = body.summary ?? body.error ?? `Request failed (${res.status}).`;
      setMessage({ step, tone: body.status === "succeeded" ? "accent" : body.status === "needs_review" ? "warn" : "danger", text });
    } catch {
      setMessage({ step, tone: "danger", text: "The connection dropped while the step was running. Refresh to see whether it finished." });
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const status = running === s.step ? "running" : s.status;
        const msg = message?.step === s.step ? message : null;
        return (
          <li key={s.step} className="grid grid-cols-[32px_1fr] gap-x-3 border-b border-rule py-5 last:border-b-0 sm:grid-cols-[32px_1fr_auto]">
            <div className="pt-0.5">{ICON[status]}</div>
            <div className="min-w-0">
              <p className="font-medium">
                <span className="mr-2 text-ink-3 tabular-nums">{i + 1}.</span>
                {s.title}
                <span className="ml-3 text-sm font-normal text-ink-3">{status === "running" ? `Running… ${elapsed}s` : LABEL[status]}</span>
              </p>
              <p className="mt-1 max-w-[70ch] text-sm text-ink-2">{s.description}</p>
              {s.summary && !msg ? <p className={`mt-2 max-w-[80ch] text-sm ${s.status === "failed" ? "text-danger" : "text-ink"}`}>{s.summary}</p> : null}
              {msg ? <p role="status" className={`mt-2 max-w-[80ch] text-sm ${msg.tone === "danger" ? "text-danger" : msg.tone === "warn" ? "text-warn" : "text-accent-ink"}`}>{msg.text}</p> : null}
              {s.lastRun ? <p className="mt-1 text-xs text-ink-3">Last run {s.lastRun} by {s.runBy}{s.tokens ? ` · ${s.tokens}` : ""}</p> : null}
              {s.blockedReason && status !== "running" ? <p className="mt-2 text-sm text-ink-3">{s.blockedReason}</p> : null}
            </div>
            <div className="col-start-2 mt-3 flex items-start gap-2 sm:col-start-3 sm:mt-0">
              {s.status !== "not_run" ? <a href={s.reviewHref} className="inline-flex h-9 items-center rounded-md px-3 text-base text-accent hover:bg-shelf">Review</a> : null}
              <button
                type="button"
                onClick={() => run(s.step)}
                disabled={locked || running !== null || Boolean(s.blockedReason)}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-4 text-base font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${s.status === "not_run" && !s.blockedReason ? "bg-accent text-white hover:bg-accent-hover" : "border border-rule-strong bg-surface hover:bg-shelf"}`}
              >
                {status === "running" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {s.status === "not_run" ? "Run" : "Run again"}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
