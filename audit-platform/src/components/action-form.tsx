"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Notice } from "./ui";

export type ActionState = { error?: string; ok?: string } | null;
export type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, className = "", resetOnOk = false }: { action: FormAction; children: ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state?.ok ? <Notice tone="accent">{state.ok}</Notice> : null}
      {children}
    </form>
  );
}

export function Submit({ children, variant = "primary", pendingText, className = "", name, value }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; pendingText?: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "bg-surface text-ink border border-rule-strong hover:bg-shelf",
    danger: "bg-surface text-danger border border-rule-strong hover:bg-danger-soft",
    ghost: "text-ink-2 hover:bg-shelf hover:text-ink",
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-base font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-wait disabled:opacity-60 ${styles} ${className}`}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
