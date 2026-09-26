import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { EmptyState, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import type { Client, Profile } from "@/lib/db-types";
import { createEngagement } from "../actions";

export const metadata = { title: "New engagement" };

export default async function NewEngagement({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireStaff();
  const [{ data: clients }, { data: people }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, initials, role, status").eq("status", "active").order("full_name"),
  ]);
  const staff = (people ?? []) as Profile[];
  if (!clients?.length) {
    return (
      <div className="max-w-[720px]">
        <PageHeader title="New engagement" />
        <EmptyState title="Add a client first" action={<LinkButton href="/clients" variant="primary">Go to clients</LinkButton>}>
          An engagement belongs to a client and a financial year.
        </EmptyState>
      </div>
    );
  }
  const opt = (roles: string[]) => staff.filter((s) => roles.includes(s.role)).map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.initials})</option>);
  return (
    <div className="max-w-[720px]">
      <PageHeader title="New engagement" description={<>One engagement per client per financial year. Missing client? <Link href="/clients" className="text-accent underline">Add it</Link>.</>} />
      <ActionForm action={createEngagement} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Client" htmlFor="client_id">
            <Select id="client_id" name="client_id" defaultValue={sp.client ?? ""} required>
              <option value="" disabled>Choose a client</option>
              {(clients as Pick<Client, "id" | "name">[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Financial year start" htmlFor="fy_start"><Input id="fy_start" name="fy_start" type="date" required /></Field>
        <Field label="Financial year end" htmlFor="fy_end"><Input id="fy_end" name="fy_end" type="date" required /></Field>
        <Field label="Audit fee (RM)" htmlFor="audit_fee" hint="Used for the audit fee accrual (AJE)."><Input id="audit_fee" name="audit_fee" inputMode="decimal" placeholder="1,400.00" /></Field>
        <Field label="Reporting deadline" htmlFor="reporting_deadline"><Input id="reporting_deadline" name="reporting_deadline" type="date" /></Field>
        <Field label="Preparer" htmlFor="preparer_id"><Select id="preparer_id" name="preparer_id" defaultValue={profile.id}>{opt(["associate", "senior", "manager", "partner", "admin"])}</Select></Field>
        <Field label="Reviewer (manager)" htmlFor="reviewer_id"><Select id="reviewer_id" name="reviewer_id" defaultValue=""><option value="">Assign later</option>{opt(["manager", "partner"])}</Select></Field>
        <Field label="Engagement partner" htmlFor="partner_id"><Select id="partner_id" name="partner_id" defaultValue=""><option value="">Assign later</option>{opt(["partner"])}</Select></Field>
        <div className="flex items-end sm:col-span-2"><Submit pendingText="Creating…">Create engagement and upload documents</Submit></div>
      </ActionForm>
    </div>
  );
}
