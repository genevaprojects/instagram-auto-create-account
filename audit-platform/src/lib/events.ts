import type { AuditLogRow } from "./db-types";

const TABLE_NOUN: Record<string, string> = {
  documents: "document",
  engagements: "engagement",
  clients: "client",
  tb_lines: "trial balance line",
  py_balances: "prior-year balance",
  adjustments: "adjustment",
  working_papers: "working paper",
  review_points: "review point",
  signoffs: "sign-off",
  staff_allowlist: "staff list entry",
  profiles: "staff profile",
  pipeline_runs: "AI run",
  training_records: "training record",
};

/** One human sentence for an audit-trail row. */
export function describeEvent(l: AuditLogRow): string {
  const d = l.details as Record<string, unknown>;
  const row = (d.row ?? {}) as Record<string, unknown>;
  const changes = (d.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
  switch (l.action) {
    case "auth.sign_in": return "signed in";
    case "auth.sign_out": return "signed out";
    case "auth.idle_sign_out": return "was signed out after inactivity";
    case "documents.insert": return `uploaded ${row.filename} (SHA-256 ${String(row.sha256).slice(0, 10)}…)`;
    case "document.signed": return `signed the attestation for ${d.filename}`;
    case "document.downloaded": return `downloaded ${d.filename}`;
    case "export.downloaded": return `downloaded ${d.kind} (SHA-256 ${String(d.sha256).slice(0, 10)}…)`;
    case "engagement.signoff": return `signed off as ${d.stage}`;
    case "engagement.viewed": return "opened the engagement";
    case "audit_chain.verified": return `verified the audit trail chain (${d.checked} entries, ${d.intact ? "intact" : "BROKEN"})`;
  }
  if (l.action.startsWith("pipeline.")) {
    const step = l.action.split(".")[1];
    return l.action.endsWith(".failed") ? `ran AI step "${step}", which failed: ${d.error}` : `ran AI step "${step}" (${d.status})`;
  }
  const [table, op] = l.action.split(".");
  const noun = TABLE_NOUN[table] ?? table;
  if (table === "training_records" && op === "insert") return `${row.passed ? "passed" : "attempted"} training module "${row.module_id}" (${row.score}/${row.total})`;
  if (op === "insert") return `created ${noun}${row.ref ? ` ${row.ref}` : row.name ? ` ${row.name}` : row.email ? ` ${row.email}` : ""}`;
  if (op === "delete") return `removed ${noun}${row.ref ? ` ${row.ref}` : ""}`;
  if (op === "update") {
    const keys = Object.keys(changes);
    if (table === "adjustments" && changes.status) return `marked adjustment ${changes.status.to}`;
    if (table === "tb_lines" && changes.verified_by) return "verified an account mapping";
    if (table === "working_papers" && changes.status) return `marked a working paper ${changes.status.to}`;
    if (table === "review_points" && changes.status) return `set a review point to ${changes.status.to}`;
    if (table === "documents" && changes.status) return `changed a document to ${changes.status.to}`;
    return `updated ${noun} (${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""})`;
  }
  return l.action;
}
