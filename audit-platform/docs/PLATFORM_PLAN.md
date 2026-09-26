# AuditFlow platform plan

## Purpose

Staff upload a client's balance sheet and P&L. The platform produces the full working-paper file, from planning and materiality through the ETB, AJEs and lead schedules to completion, in the firm's format. Every step is signed by a named person and recorded.

## Architecture

- **Web app.** Next.js 16 (App Router) on Vercel. Server components and server actions; long AI steps run in API routes with a 300-second limit.
- **Data.** Supabase Postgres, project `mexyzyoyhyigrkposhmu`, with row-level security on every table.
- **Files.** Private Supabase Storage bucket `engagement-files`. The policies allow upload and read only, so nothing can be overwritten or deleted.
- **AI.** Anthropic Claude via the official SDK, with structured outputs, prompt caching and server-side refusal fallbacks.
- **Accounting engine.** Deterministic TypeScript (`src/lib/audit`), integer sen arithmetic, unit-tested against the firm's sample 2026 file (anonymised).
- **Exports.** ExcelJS workbook with live formulas (independently recalculated in tests) and Word documents via `docx`.

## Workflow

1. **Upload.** Upload the client statements, prior-year audited FS or AWP, and supporting evidence. Each file is attested by the uploader.
2. **Read.** The AI transcribes the statements; the platform re-performs all arithmetic and builds a balanced TB.
3. **Map.** The AI maps accounts to captions and lead schedules; staff verify every line.
4. **Adjust.** The AI proposes AJEs, RJEs and the tax computation; a senior or above decides each entry.
5. **Analyse.** Analytical review, going concern, subsequent events and related parties.
6. **Papers.** The planning memo, risk register, lead schedules and completion summary are drafted; each is marked prepared, then reviewed by someone else.
7. **Sign-off.** Preparer, then manager, then partner. The partner's signature locks the engagement.

## Keeping out people who should not be there

1. **Allowlist gate.** A database trigger refuses any sign-up whose email is not on the partner-managed staff list, even if someone calls the API directly.
2. **Email confirmation.** A stranger who registers a staff member's email cannot sign in, because the confirmation link goes to the real inbox.
3. **Instant revocation.** A partner can suspend or remove someone on the Staff page. Row-level security stops every read and write on their next request.
4. **Signatures.** Attestations and sign-offs require the typed full name and the password again, checked server-side. Failed attempts are logged.
5. **Idle sign-out** after 30 minutes. Sessions are HTTP-only cookies refreshed by the proxy.
6. **No public pages** beyond sign-in, sign-up and reset. Search engines are told not to index the site.
7. **Recommended next.** Vercel's firewall can restrict the site to the office IP address, and Supabase supports time-based one-time-password MFA for partners.

## Making staff aware that they are tracked

- The sidebar states on every page that uploads, edits, AI runs, downloads and sign-offs are recorded under the user's name.
- Every attestation spells out what is recorded: identity, time, IP address, device and file fingerprint.
- Anyone can open the Audit trail, filter it by person and verify the hash chain.

## What is recorded

Every insert, update and delete on business tables is recorded by database triggers, so the application cannot forget to log. Explicit events are also recorded:

- sign-in, sign-out and idle sign-out
- attestations, including failed attempts
- AI runs, with model and token counts
- downloads of evidence and exports, with the SHA-256 of the exported file
- sign-offs, with a snapshot hash
- audit-chain verification

Each entry stores the SHA-256 of the previous entry. Altering or deleting a row outside the application breaks the chain, and the verification shows where.

## Roles

| Role | Can |
|---|---|
| Associate | Upload and sign own files, run AI steps, edit mappings, draft papers, respond to review points, preparer sign-off. |
| Senior | Everything above, plus deciding adjustments and clearing AI-raised points. |
| Manager | Everything above, plus choosing the materiality basis, reviewing papers and reviewer sign-off. |
| Partner | Everything above, plus managing staff access and partner sign-off, which locks the file. |
| Administrator | Managing staff access. |

## Cost control

- One engagement is roughly 5 to 7 Claude calls.
- The constitution prompt is cached.
- Statements are sent once per step.
- Token use is recorded on every run and shown on the Overview tab, so cost per engagement is visible.
