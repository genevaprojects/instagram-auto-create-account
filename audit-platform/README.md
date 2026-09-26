# AuditFlow

Internal audit working-paper platform. Staff upload a client's balance sheet and P&L, and AuditFlow produces the full audit file in the firm's format, with every step signed by a named person and recorded in a tamper-evident trail. The file runs from planning and materiality (AB2) through DB-1, DB-2, DC1, the extended trial balance and every lead schedule to completion.

Read first:

- [docs/PLATFORM_PLAN.md](docs/PLATFORM_PLAN.md): architecture, workflow, access controls, tracking.
- [docs/AUDIT_METHODOLOGY.md](docs/AUDIT_METHODOLOGY.md): the firm template, the ISA and MIA benchmark review, and the improvements.
- [docs/AI_INSTRUCTIONS.md](docs/AI_INSTRUCTIONS.md): the AI's standing orders and guardrails.

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Tests

```bash
npx tsx tests/deterministic.test.ts                          # casting, TB, materiality, ETB, tax
npx tsx --conditions=react-server tests/export.test.ts       # builds the workbook and recalculates every formula
```

## Database

The SQL in `supabase/migrations` has been applied to project `mexyzyoyhyigrkposhmu`. The firm owner's email was seeded as the first partner. Sign up with it at `/signup`, then add staff on the Staff access page.

## Deploy (Netlify, production at x1knows.com)

The Netlify project is `x1knows` (team genevaprojects). `netlify.toml` at the repository root sets the base directory (`audit-platform`), the build command and the functions directory.

1. **Link the repository (once).** In Netlify, open **x1knows → Project configuration → Build & deploy → Link repository**. Choose GitHub → `genevaprojects/instagram-auto-create-account`, then pick the production branch. After that, every push deploys.
2. **Environment variables.** These are already set on the project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`
   - `NEXT_PUBLIC_SITE_URL`
   - `PIPELINE_MODE=background`
   - `PIPELINE_JOB_SECRET` (secret)

   Add `ANTHROPIC_API_KEY` as a secret, and `FIRM_NAME`.
3. **Domain.** Under **Domain management → Add a domain**, add `x1knows.com`. Hostinger DNS already points at Netlify. If Netlify reports the domain is attached to another project, remove it there first.
4. **Supabase Auth.** Under **Authentication → URL Configuration**, set Site URL to `https://x1knows.com` and add `https://x1knows.com/auth/callback` as a redirect URL.

**Why background functions.** Netlify ends a normal request after about a minute. A step on Claude Opus 5.5 at high effort can take several minutes. So on Netlify the API route validates the step, records it as running, and hands it to `netlify/functions/pipeline-background.mts`, which can run for up to 15 minutes. The browser polls until the step finishes.

The hand-off is signed with `PIPELINE_JOB_SECRET` and expires after 2 minutes. The worker acts as the staff member who started the step, using their forwarded access token, so row-level security, the audit trail and the "started by" name are unchanged. A step still running after 16 minutes is shown as failed and can be run again.

## Deploy (Vercel, alternative)

Root directory: `audit-platform`. Environment variables are listed in `.env.example`.

Set the Supabase Auth Site URL and redirect URL to the deployed domain so confirmation and reset emails link back correctly:

- Site URL: `https://<domain>`
- Redirect URL: `https://<domain>/auth/callback`

On Vercel, steps run inline, within the 300-second route limit. Leave `PIPELINE_MODE` unset.
