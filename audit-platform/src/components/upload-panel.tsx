"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerUpload } from "@/app/(app)/engagements/[id]/documents/actions";
import { SignPanel } from "./sign-panel";

const ACCEPT = ".pdf,.xls,.xlsx,.xlsm,.csv,.doc,.docx,.png,.jpg,.jpeg,.txt";

async function sha256Hex(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UploadPanel({ engagementId, kinds, clientName, me }: { engagementId: string; kinds: { kind: string; label: string; hint: string }[]; clientName: string; me: { name: string; initials: string } }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(kinds[0].kind);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState<{ id: string; filename: string; sha256: string } | null>(null);

  async function onUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a file.");
    if (file.size > 50 * 1024 * 1024) return setError("Files must be 50 MB or smaller.");
    setError(null);
    try {
      setBusy("Fingerprinting file (SHA-256)…");
      const sha256 = await sha256Hex(file);
      setBusy("Uploading…");
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${engagementId}/${crypto.randomUUID()}-${safe}`;
      const supabase = createClient();
      const up = await supabase.storage.from("engagement-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (up.error) throw new Error(up.error.message);
      setBusy("Recording…");
      const res = await registerUpload({ engagementId, kind, description, filename: file.name, storagePath: path, mime: file.type, size: file.size, sha256 });
      if ("error" in res && res.error) throw new Error(res.error);
      setJustUploaded({ id: (res as { id: string }).id, filename: file.name, sha256 });
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (justUploaded) {
    return (
      <SignPanel
        docId={justUploaded.id}
        filename={justUploaded.filename}
        sha256={justUploaded.sha256}
        clientName={clientName}
        me={me}
        onDone={() => {
          setJustUploaded(null);
          router.refresh();
        }}
        intro="Uploaded. Sign the attestation now; the file will not be processed until you do."
      />
    );
  }

  const hint = kinds.find((k) => k.kind === kind)?.hint;
  return (
    <div className="grid gap-4 rounded-md border border-rule bg-surface p-6 sm:grid-cols-2">
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger sm:col-span-2">{error}</p> : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="kind" className="text-sm font-medium text-ink-2">Document type</label>
        <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base">
          {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
        {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="desc" className="text-sm font-medium text-ink-2">Description (optional)</label>
        <input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Bank statement March 2026" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base" />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="file" className="text-sm font-medium text-ink-2">File</label>
        <input id="file" ref={fileRef} type="file" accept={ACCEPT} className="block w-full cursor-pointer rounded-md border border-dashed border-rule-strong bg-paper px-3 py-4 text-sm file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-shelf file:px-3 file:py-1.5 file:text-sm file:font-medium" />
        <p className="text-xs text-ink-3">PDF, Excel (.xls/.xlsx), Word, CSV or scanned images, up to 50 MB. The file is fingerprinted in your browser before it leaves your computer.</p>
      </div>
      <div className="sm:col-span-2">
        <button type="button" onClick={onUpload} disabled={busy !== null} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60">
          <Upload className="size-4" aria-hidden />
          {busy ?? "Upload"}
        </button>
      </div>
    </div>
  );
}
