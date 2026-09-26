import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { QualityCheck } from "@/lib/audit/quality";

const ICON = {
  pass: <CircleCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-label="Pass" />,
  critical: <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Critical: fails" />,
  warning: <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Warning" />,
  info: <Info className="mt-0.5 size-4 shrink-0 text-info" aria-label="Note" />,
};

export function QualityPanel({ checks }: { checks: QualityCheck[] }) {
  const order = (c: QualityCheck) => (c.passed ? 3 : c.severity === "critical" ? 0 : c.severity === "warning" ? 1 : 2);
  const sorted = [...checks].sort((a, b) => order(a) - order(b));
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-md border border-rule bg-surface">
      {sorted.map((c) => (
        <li key={c.id} className="flex gap-3 px-4 py-3">
          {c.severity === "info" ? ICON.info : c.passed ? ICON.pass : ICON[c.severity]}
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${c.passed ? "text-ink-2" : "font-medium text-ink"}`}>{c.title}</p>
            <p className="mt-0.5 text-xs text-ink-2">{c.detail}</p>
            <p className="mt-0.5 text-xs text-ink-3">{c.area} · {c.standard}</p>
          </div>
          {!c.passed && c.fixHref ? (
            <Link href={c.fixHref} className="self-start text-sm whitespace-nowrap text-accent hover:underline">Fix</Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
