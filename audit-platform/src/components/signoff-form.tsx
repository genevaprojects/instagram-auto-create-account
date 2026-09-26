"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

export function SignoffForm({ engagementId, stage, statement, name, warning }: { engagementId: string; stage: "preparer" | "reviewer" | "partner"; statement: string; name: string; warning?: string }) {
  const router = useRouter();
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/engagements/${engagementId}/signoff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, typedName, password, agree }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setPassword("");
    if (!res.ok) return setError(body.error ?? "Could not sign.");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="rounded-md bg-paper px-4 py-3 text-sm leading-relaxed text-ink-2">{statement}</p>
      {warning ? <p className="text-sm font-medium text-danger">{warning}</p> : null}
      <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />I make this statement.</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Type your full name<input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={name} autoComplete="off" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" /></label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-2">Password (your signature)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-9 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink" /></label>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div>
        <button type="submit" disabled={busy || !agree || !typedName || !password} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          <PenLine className="size-4" aria-hidden />{busy ? "Signing…" : "Sign off"}
        </button>
      </div>
    </form>
  );
}
