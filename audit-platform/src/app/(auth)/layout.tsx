export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <aside className="hidden flex-col justify-between bg-accent p-12 text-paper lg:flex">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#faf8f3" />
            <path d="M9 17.5l4.5 4.5L23 10.5" fill="none" stroke="#0f5e4a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-md font-semibold tracking-tight">AuditFlow</span>
        </div>
        <div className="max-w-[46ch]">
          <p className="text-xl leading-snug font-medium">From the client&apos;s balance sheet to a signed, referenced audit file.</p>
          <p className="mt-4 text-base text-paper/80">
            Every upload is signed by the staff member who made it. Every AI step, edit, download and sign-off is written to a tamper-evident trail.
          </p>
        </div>
        <p className="text-xs text-paper/70">Internal system. Authorised firm staff only. Access is monitored.</p>
      </aside>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
              <rect width="32" height="32" rx="6" fill="#0f5e4a" />
              <path d="M9 17.5l4.5 4.5L23 10.5" fill="none" stroke="#faf8f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-md font-semibold tracking-tight">AuditFlow</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
