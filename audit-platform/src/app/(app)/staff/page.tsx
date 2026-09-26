import { redirect } from "next/navigation";
import { requireStaff, hasRole, ROLE_LABEL } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, Field, Input, PageHeader, Section, Select, when } from "@/components/ui";
import type { Profile, StaffRole } from "@/lib/db-types";
import { addStaff, updateStaff } from "./actions";

export const metadata = { title: "Staff access" };

type Allow = { email: string; full_name: string | null; initials: string | null; role: StaffRole; created_at: string; revoked_at: string | null };

export default async function StaffPage() {
  const { supabase, profile } = await requireStaff();
  if (!hasRole(profile, ["admin", "partner"])) redirect("/");
  const [{ data: allow }, { data: people }] = await Promise.all([
    supabase.from("staff_allowlist").select("*").order("created_at"),
    supabase.from("profiles").select("*"),
  ]);
  const profiles = new Map(((people ?? []) as Profile[]).map((p) => [p.email, p]));
  const roles = Object.entries(ROLE_LABEL) as [StaffRole, string][];
  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Staff access"
        description="Only emails on this list can create an account. Removing someone ends their access immediately; their past work stays in the audit trail under their name."
      />
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="ledger">
          <thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Last sign-in</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {((allow ?? []) as Allow[]).map((a) => {
              const p = profiles.get(a.email);
              const status = a.revoked_at ? "Removed" : !p ? "Invited, not registered" : p.status === "suspended" ? "Suspended" : "Active";
              return (
                <tr key={a.email}>
                  <td>
                    <p className="font-medium">{p?.full_name || a.full_name || a.email}</p>
                    <p className="text-xs text-ink-3">{a.email}{p?.initials ? ` · ${p.initials}` : ""}</p>
                  </td>
                  <td>
                    <ActionForm action={updateStaff} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p?.id ?? ""} />
                      <input type="hidden" name="email" value={a.email} />
                      <input type="hidden" name="intent" value="role" />
                      <Select name="role" defaultValue={p?.role ?? a.role} aria-label={`Role for ${a.email}`} disabled={Boolean(a.revoked_at)} className="w-36">
                        {roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                      {!a.revoked_at ? <Submit variant="ghost" pendingText="…">Save</Submit> : null}
                    </ActionForm>
                  </td>
                  <td><Badge tone={status === "Active" ? "accent" : status.startsWith("Invited") ? "info" : "danger"}>{status}</Badge></td>
                  <td className="text-ink-2">{when(p?.last_login_at) || "-"}</td>
                  <td>
                    {a.revoked_at || a.email === profile.email ? null : (
                      <div className="flex justify-end gap-2">
                        {p ? (
                          <ActionForm action={updateStaff}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="email" value={a.email} />
                            <input type="hidden" name="intent" value={p.status === "active" ? "suspend" : "reactivate"} />
                            <Submit variant="secondary" pendingText="…">{p.status === "active" ? "Suspend" : "Reactivate"}</Submit>
                          </ActionForm>
                        ) : null}
                        <ActionForm action={updateStaff}>
                          <input type="hidden" name="id" value={p?.id ?? ""} />
                          <input type="hidden" name="email" value={a.email} />
                          <input type="hidden" name="intent" value="revoke" />
                          <Submit variant="danger" pendingText="…">Remove</Submit>
                        </ActionForm>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-10">
        <Section title="Add a staff member" description="They then register at /signup with this exact email and confirm it from their inbox.">
          <ActionForm action={addStaff} resetOnOk className="grid max-w-[760px] gap-4 sm:grid-cols-2">
            <Field label="Firm email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
            <Field label="Role" htmlFor="role"><Select id="role" name="role" defaultValue="associate">{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Full name (optional)" htmlFor="full_name"><Input id="full_name" name="full_name" /></Field>
            <Field label="Initials (optional)" htmlFor="initials"><Input id="initials" name="initials" maxLength={6} className="uppercase" /></Field>
            <div className="sm:col-span-2"><Submit pendingText="Adding…">Add to staff list</Submit></div>
          </ActionForm>
        </Section>
      </div>
    </div>
  );
}
