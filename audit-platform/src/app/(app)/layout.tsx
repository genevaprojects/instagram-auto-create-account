import { LayoutDashboard, FolderOpen, Building2, ScrollText, Users, UserRound, LogOut, ShieldCheck, GraduationCap } from "lucide-react";
import { requireStaff, hasRole, ROLE_LABEL } from "@/lib/session";
import { NavLink } from "@/components/nav-link";
import { IdleTimeout } from "@/components/idle-timeout";
import { signOut } from "../(auth)/actions";
import { idleSignOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff({ allowIncompleteProfile: true });
  const icon = "size-4 shrink-0";
  return (
    <div className="grid min-h-dvh md:grid-cols-[232px_1fr]">
      <IdleTimeout minutes={30} onIdle={idleSignOut} />
      <aside className="flex flex-col border-r border-rule bg-shelf md:sticky md:top-0 md:h-dvh">
        <div className="flex items-center gap-2 px-5 pt-5 pb-6">
          <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#0f5e4a" />
            <path d="M9 17.5l4.5 4.5L23 10.5" fill="none" stroke="#faf8f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-md font-semibold tracking-tight">AuditFlow</span>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 px-3">
          <NavLink href="/" exact><LayoutDashboard className={icon} aria-hidden />Dashboard</NavLink>
          <NavLink href="/engagements"><FolderOpen className={icon} aria-hidden />Engagements</NavLink>
          <NavLink href="/clients"><Building2 className={icon} aria-hidden />Clients</NavLink>
          <NavLink href="/training"><GraduationCap className={icon} aria-hidden />Training</NavLink>
          <NavLink href="/activity"><ScrollText className={icon} aria-hidden />Audit trail</NavLink>
          {hasRole(profile, ["admin", "partner"]) ? <NavLink href="/staff"><Users className={icon} aria-hidden />Staff access</NavLink> : null}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-3 pb-4">
          <div className="flex items-start gap-2 rounded-md bg-surface px-3 py-2 text-xs text-ink-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <p>Your uploads, edits, AI runs, downloads and sign-offs are recorded under your name in the audit trail.</p>
          </div>
          <NavLink href="/profile">
            <UserRound className={icon} aria-hidden />
            <span className="min-w-0 truncate">
              {profile.full_name || profile.email}
              <span className="ml-1 text-xs text-ink-3">{profile.initials} · {ROLE_LABEL[profile.role]}</span>
            </span>
          </NavLink>
          <form action={signOut}>
            <button type="submit" className="flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-base text-ink-2 transition-colors duration-150 hover:bg-surface/70 hover:text-ink">
              <LogOut className={icon} aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}
