import { createHash } from "node:crypto";
import type { Bundle } from "./pipeline/bundle";

/** Canonical fingerprint of everything a sign-off vouches for. */
export function snapshotHash(b: Bundle): string {
  const canonical = {
    engagement: { id: b.engagement.id, fy_end: b.engagement.fy_end, materiality: b.materiality, tax: b.engagement.tax_computation },
    documents: b.documents.filter((d) => d.status === "signed").map((d) => [d.id, d.sha256, d.signed_by]).sort(),
    tb: b.tbLines.map((l) => [l.line_no, l.account_name, l.cy_amount, l.fs_caption, l.fs_group, l.wp_ref, l.verified_by]),
    adjustments: b.adjustments.map((a) => [a.ref, a.status, a.lines]),
    papers: b.papers.map((p) => [p.ref, p.status, p.content]).sort(),
    etb: b.etb?.totals ?? null,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
