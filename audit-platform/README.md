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

## Deploy (Vercel)

Root directory: `audit-platform`. Environment variables are listed in `.env.example`.

Set the Supabase Auth Site URL and redirect URL to the deployed domain so confirmation and reset emails link back correctly:

- Site URL: `https://<domain>`
- Redirect URL: `https://<domain>/auth/callback`

### Custom domain (x1knows.com, registered at Hostinger)

1. In Vercel, open the project, go to **Settings → Domains**, and add `x1knows.com` and `www.x1knows.com`.
2. In Hostinger, open **Domains → x1knows.com → DNS / Nameservers → DNS records**:
   - Delete the existing `A` records for `@` and `www`.
   - Add `A`, name `@`, pointing to `76.76.21.21`.
   - Add `CNAME`, name `www`, pointing to `cname.vercel-dns.com`.
   - If Vercel's Domains page shows different values, use those.
3. Set `NEXT_PUBLIC_SITE_URL=https://x1knows.com` in Vercel, then redeploy.
4. In Supabase, open **Authentication → URL Configuration**. Set Site URL to `https://x1knows.com` and add `https://x1knows.com/auth/callback` as a redirect URL.

To keep an existing site on the root domain, use a subdomain instead. For example, add `audit.x1knows.com` in Vercel, then add `CNAME audit cname.vercel-dns.com` in Hostinger.
