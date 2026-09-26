import { getEngagement } from "@/lib/engagement-page";
import { DOCUMENT_KINDS, documentKindLabel } from "@/lib/audit/catalog";
import { UploadPanel } from "@/components/upload-panel";
import { SignInline } from "@/components/sign-inline";
import { Badge, EmptyState, Notice, Section, when } from "@/components/ui";
import { supersede } from "./actions";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { b, profile } = await getEngagement(id);
  const locked = b.engagement.status === "locked";
  const docs = [...b.documents].reverse();
  const me = { name: profile.full_name, initials: profile.initials };
  const hasBS = b.documents.some((d) => d.kind === "cy_bs" && d.status !== "superseded");
  const hasPL = b.documents.some((d) => d.kind === "cy_pl" && d.status !== "superseded");
  return (
    <div>
      {!hasBS || !hasPL ? (
        <div className="mb-6"><Notice tone="info" title="Start here">Upload the client&apos;s current-year balance sheet and profit and loss account. Add last year&apos;s audited financial statements or working papers so comparatives and opening balances can be agreed. Supporting evidence (bank statements, tenancy agreements, invoices, tax forms) lets the AI evidence its procedures.</Notice></div>
      ) : null}
      {!locked ? (
        <Section title="Upload" description="Each file is fingerprinted, stored unchangeably, and must be signed by the person who uploaded it before any processing.">
          <UploadPanel engagementId={id} kinds={DOCUMENT_KINDS} clientName={b.client.name} me={me} />
        </Section>
      ) : null}
      <Section title="Evidence on file" description={`${docs.filter((d) => d.status === "signed").length} signed · ${docs.filter((d) => d.status === "awaiting_signoff").length} awaiting signature · ${docs.filter((d) => d.status === "superseded").length} superseded`}>
        {docs.length === 0 ? (
          <EmptyState title="No documents uploaded" />
        ) : (
          <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
            {docs.map((d) => {
              const uploader = b.people.get(d.uploaded_by);
              return (
                <li key={d.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <a href={`/api/documents/${d.id}/download`} className={`hover:underline ${d.status === "superseded" ? "text-ink-3 line-through" : ""}`}>{d.filename}</a>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-2">{documentKindLabel(d.kind)}{d.description ? ` · ${d.description}` : ""}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        Uploaded {when(d.uploaded_at)} by {uploader?.full_name ?? "unknown"} · <span className="ref" title={d.sha256}>SHA-256 {d.sha256.slice(0, 16)}…</span>
                      </p>
                      {d.status === "signed" ? <p className="mt-1 text-xs text-accent-ink">Signed by {d.signed_name} ({d.signed_initials}) {when(d.signed_at)}{d.signed_ip ? ` from ${d.signed_ip}` : ""}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {d.status === "signed" ? <Badge tone="accent">Signed</Badge> : d.status === "superseded" ? <Badge>Superseded</Badge> : <Badge tone="warn">Awaiting signature</Badge>}
                      {!locked && d.status !== "superseded" ? (
                        <form action={supersede}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="engagement_id" value={id} />
                          <button type="submit" className="h-8 cursor-pointer rounded-md px-2 text-sm text-ink-3 hover:bg-shelf hover:text-ink" title="Exclude this file from processing. It stays on record.">Supersede</button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {!locked && d.status === "awaiting_signoff" ? (
                    d.uploaded_by === profile.id ? (
                      <div className="mt-2"><SignInline docId={d.id} filename={d.filename} sha256={d.sha256} clientName={b.client.name} me={me} /></div>
                    ) : (
                      <p className="mt-2 text-sm text-warn">Waiting for {uploader?.full_name ?? "the uploader"} to sign. It will not be processed until then.</p>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
