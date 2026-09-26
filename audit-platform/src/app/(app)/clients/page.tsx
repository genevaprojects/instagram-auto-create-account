import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { EmptyState, Field, Input, PageHeader, Section, Select, Textarea } from "@/components/ui";
import type { Client } from "@/lib/db-types";
import { createClientAction } from "./actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("clients").select("*, engagements(id, fy_end, status)").order("name");
  const clients = (data ?? []) as (Client & { engagements: { id: string; fy_end: string; status: string }[] })[];
  return (
    <div className="max-w-[1100px]">
      <PageHeader title="Clients" description="Permanent information carried into every engagement: directors, addresses, framework and principal activity." />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet">Add the first client below.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-md border border-rule bg-surface">
          <table className="ledger">
            <thead>
              <tr><th>Company</th><th>Registration no.</th><th>Principal activity</th><th>Framework</th><th>Engagements</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="ref">{c.registration_no}</td>
                  <td className="text-ink-2">{c.principal_activity}</td>
                  <td>{c.framework}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {c.engagements.map((e) => (
                        <Link key={e.id} href={`/engagements/${e.id}`} className="text-accent hover:underline">YE {new Date(e.fy_end).getUTCFullYear()}</Link>
                      ))}
                      <Link href={`/engagements/new?client=${c.id}`} className="text-ink-3 hover:text-ink hover:underline">+ New</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-10">
        <Section title="Add a client" description="Directors' names appear on the adjusting journal approval block (DC1) and the planning memo.">
          <ActionForm action={createClientAction} resetOnOk className="grid max-w-[760px] gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Company name" htmlFor="name"><Input id="name" name="name" required placeholder="Example Holdings Sdn. Bhd." /></Field></div>
            <Field label="Registration no." htmlFor="registration_no"><Input id="registration_no" name="registration_no" placeholder="202001000001 (1234567-X)" /></Field>
            <Field label="Reporting framework" htmlFor="framework"><Select id="framework" name="framework" defaultValue="MPERS"><option>MPERS</option><option>MFRS</option></Select></Field>
            <div className="sm:col-span-2"><Field label="Principal activity" htmlFor="principal_activity" hint="Used to suggest the ISA 320 materiality benchmark."><Input id="principal_activity" name="principal_activity" placeholder="Property letting" /></Field></div>
            <div className="sm:col-span-2"><Field label="Directors" htmlFor="directors" hint="One per line."><Textarea id="directors" name="directors" rows={2} /></Field></div>
            <Field label="Registered address" htmlFor="registered_address"><Textarea id="registered_address" name="registered_address" rows={2} /></Field>
            <Field label="Business / correspondence address" htmlFor="business_address"><Textarea id="business_address" name="business_address" rows={2} /></Field>
            <Field label="Key contact" htmlFor="contact_person"><Input id="contact_person" name="contact_person" /></Field>
            <Field label="Contact phone" htmlFor="contact_phone"><Input id="contact_phone" name="contact_phone" /></Field>
            <Field label="Contact email" htmlFor="contact_email"><Input id="contact_email" name="contact_email" type="email" /></Field>
            <div className="flex items-end sm:col-span-2"><Submit pendingText="Adding…">Add client</Submit></div>
          </ActionForm>
        </Section>
      </div>
    </div>
  );
}
