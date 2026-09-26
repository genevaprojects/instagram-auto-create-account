"use client";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { uploadDeclaration } from "@/lib/declarations";

export function SignPanel({ docId, filename, sha256, clientName, me, onDone, intro }: { docId: string; filename: string; sha256: string; clientName: string; me: { name: string; initials: string }; onDone: () => void; intro?: string }) {
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${docId}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ typedName, password, agree }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setPassword("");
    if (!res.ok) return setError(body.error ?? "Could not sign.");
    onDone();
  }

  return (
    <form onSubmit={sign} className="flex flex-col gap-4 rounded-md border border-accent/40 bg-surface p-6">
      {intro ? <p className="text-sm font-medium text-accent-ink">{intro}</p> : null}
      <div>
        <p className="font-medium">Attestation for {filename}</p>
        <p className="ref mt-1 break-all text-ink-3">SHA-256 {sha256}</p>
      </div>
      <p className="max-w-[80ch] rounded-md bg-paper px-4 py-3 text-sm leading-relaxed text-ink-2">{uploadDeclaration({ name: me.name, initials: me.initials, client: clientName, filename, sha256 })}</p>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
        I make this declaration.
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`name-${docId}`} className="text-sm font-medium text-ink-2">Type your full name</label>
          <input id={`name-${docId}`} value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={me.name} autoComplete="off" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`pw-${docId}`} className="text-sm font-medium text-ink-2">Password (your signature)</label>
          <input id={`pw-${docId}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base" />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div>
        <button type="submit" disabled={busy || !agree || !typedName || !password} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          <PenLine className="size-4" aria-hidden />
          {busy ? "Signing…" : "Sign attestation"}
        </button>
      </div>
    </form>
  );
}
