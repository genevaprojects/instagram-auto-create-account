"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignPanel } from "./sign-panel";

export function SignInline(p: { docId: string; filename: string; sha256: string; clientName: string; me: { name: string; initials: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 cursor-pointer items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover">
        Sign
      </button>
    );
  }
  return (
    <div className="mt-3">
      <SignPanel {...p} onDone={() => { setOpen(false); router.refresh(); }} />
    </div>
  );
}
