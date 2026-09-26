import type { FsGroup } from "./audit/catalog";

export type StaffRole = "admin" | "partner" | "manager" | "senior" | "associate";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  initials: string;
  role: StaffRole;
  status: "active" | "suspended";
  created_at: string;
  last_login_at: string | null;
}

export interface Client {
  id: string;
  name: string;
  registration_no: string | null;
  principal_activity: string | null;
  framework: "MPERS" | "MFRS";
  registered_address: string | null;
  business_address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  directors: string[];
  created_at: string;
}

export interface Engagement {
  id: string;
  client_id: string;
  fy_start: string;
  fy_end: string;
  audit_fee: number | null;
  reporting_deadline: string | null;
  status: "planning" | "fieldwork" | "review" | "completed" | "locked";
  preparer_id: string | null;
  reviewer_id: string | null;
  partner_id: string | null;
  materiality: unknown;
  tax_computation: unknown;
  settings: Record<string, unknown>;
  created_at: string;
  locked_at: string | null;
}

export interface DocumentRow {
  id: string;
  engagement_id: string;
  kind: string;
  description: string | null;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
  status: "awaiting_signoff" | "signed" | "superseded";
  signed_by: string | null;
  signed_name: string | null;
  signed_initials: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  declaration: string | null;
  superseded_by: string | null;
}

export type PipelineStep = "extract" | "map" | "adjust" | "analyse" | "papers";

export interface PipelineRun {
  id: string;
  engagement_id: string;
  step: PipelineStep;
  status: "running" | "succeeded" | "needs_review" | "failed";
  started_by: string | null;
  started_at: string;
  finished_at: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  summary: string | null;
  error: string | null;
  output: unknown;
}

export interface TbLineRow {
  id: string;
  engagement_id: string;
  source_document_id: string | null;
  line_no: number;
  account_name: string;
  statement: "BS" | "PL";
  section: string;
  cy_amount: number;
  py_client_amount: number | null;
  fs_caption: string | null;
  fs_group: FsGroup | null;
  wp_ref: string | null;
  mapping_rationale: string | null;
  mapping_confidence: number | null;
  mapping_flags: string[];
  mapped_by: string;
  verified_by: string | null;
  verified_at: string | null;
}

export interface PyBalanceRow {
  id: string;
  engagement_id: string;
  fs_caption: string;
  fs_group: FsGroup | null;
  wp_ref: string | null;
  amount: number;
  source_document_id: string | null;
  note: string | null;
}

export interface AdjustmentLineRow {
  account: string;
  fs_caption: string;
  fs_group: FsGroup;
  wp_ref: string;
  dr: number;
  cr: number;
}

export interface AdjustmentRow {
  id: string;
  engagement_id: string;
  ref: string;
  kind: "AJE" | "RJE";
  description: string;
  rationale: string | null;
  evidence: string | null;
  source: "ai" | "staff";
  status: "proposed" | "accepted" | "rejected" | "uncorrected";
  lines: AdjustmentLineRow[];
  total: number;
  proposed_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface WorkingPaperRow {
  id: string;
  engagement_id: string;
  ref: string;
  title: string;
  content: Record<string, unknown>;
  status: "draft" | "prepared" | "reviewed";
  prepared_by: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface ReviewPointRow {
  id: string;
  engagement_id: string;
  wp_ref: string | null;
  body: string;
  raised_by: string;
  raised_at: string;
  status: "open" | "responded" | "cleared";
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
}

export interface SignoffRow {
  id: string;
  engagement_id: string;
  stage: "preparer" | "reviewer" | "partner";
  signed_by: string;
  signed_name: string;
  initials: string;
  role: StaffRole;
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  statement: string;
  snapshot_hash: string;
}

export interface AuditLogRow {
  id: number;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  engagement_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  prev_hash: string | null;
  hash: string;
}
