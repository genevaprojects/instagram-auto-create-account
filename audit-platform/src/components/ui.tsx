import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatRM } from "@/lib/audit/money";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 h-9 text-base font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-rule-strong hover:bg-shelf",
  ghost: "text-ink-2 hover:bg-shelf hover:text-ink",
  danger: "bg-surface text-danger border border-rule-strong hover:bg-danger-soft",
};

export function Button({ variant = "secondary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function LinkButton({ variant = "secondary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

const control =
  "h-9 w-full rounded-md border border-rule-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:bg-shelf";

export function Input({ className = "", ...p }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...p} />;
}
export function Select({ className = "", ...p }: ComponentProps<"select">) {
  return <select className={`${control} pr-8 ${className}`} {...p} />;
}
export function Textarea({ className = "", ...p }: ComponentProps<"textarea">) {
  return <textarea className={`${control} h-auto min-h-24 py-2 ${className}`} {...p} />;
}

type Tone = "neutral" | "accent" | "warn" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-shelf text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function Money({ cents, strong }: { cents: number | null | undefined; strong?: boolean }) {
  return <span className={`num ${strong ? "font-semibold" : ""} ${cents !== null && cents !== undefined && cents < 0 ? "text-ink" : ""}`}>{formatRM(cents)}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <div className="mt-1 max-w-[70ch] text-base text-ink-2">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-rule pt-6 pb-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-md font-semibold">{title}</h2>
          {description ? <p className="mt-1 max-w-[72ch] text-sm text-ink-2">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rule-strong bg-surface px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-[56ch] text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
}
export function day(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
}
