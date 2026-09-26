"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-3 rounded-md px-3 text-base transition-colors duration-150 ${active ? "bg-surface font-medium text-ink shadow-[0_1px_0_var(--color-rule)]" : "text-ink-2 hover:bg-surface/70 hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

export function TabLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex h-10 items-center border-b-2 px-1 text-base whitespace-nowrap transition-colors duration-150 ${active ? "border-accent font-medium text-ink" : "border-transparent text-ink-2 hover:border-rule-strong hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
