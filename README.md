# MegaTech OMS

Order-management system for Megatech Solutions: quotations → customer POs → supplier POs, with margin tracking.

Built with Next.js 16 (App Router), React 19, Prisma 5 + PostgreSQL, Tailwind 4.

> Next.js 16 has breaking changes versus older versions (e.g. `middleware` is now `proxy`). See `AGENTS.md`
> and read `node_modules/next/dist/docs/` before changing framework-level code.

## Getting started

```bash
cp .env.example .env      # then fill it in
npm install
npx prisma db push        # create/update tables (dev)
npm run dev
```

With `AUTH_PASSWORD` / `AUTH_SECRET` unset, sign-in is **off** in development. Set both to try the login locally.

## Environment variables

| Variable        | Purpose                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`  | Postgres connection used by the app.                                                      |
| `DIRECT_URL`    | Direct connection used by the Prisma CLI (schema changes).                                |
| `AUTH_PASSWORD` | Shared sign-in password.                                                                  |
| `AUTH_SECRET`   | Signs the session cookie (≥ 16 chars). `openssl rand -base64 32`.                         |

**In production the app fails closed:** unless both `AUTH_*` variables are set, every page returns 503.

## Scripts

| Command                   | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Dev server.                                               |
| `npm run build`           | `prisma generate`, `prisma db push`, `next build`.        |
| `npm run lint`            | ESLint.                                                   |
| `npm run typecheck`       | `tsc --noEmit`.                                           |
| `npm test`                | Unit tests (and DB integration tests if configured).      |
| `npm run db:migrate:deploy` | Apply committed migrations (see below).                 |

### Tests

Unit tests need nothing. The integration suite runs the server actions against a real database and is skipped
unless you point it at a **scratch** database (it truncates tables):

```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/crm_test npx prisma db push   # once, with DATABASE_URL/DIRECT_URL set to the same URL
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/crm_test npm test
```

## How the workflow fits together

```
Quotation (Draft → Sent → Customer Review / Negotiation → …)
   │  "Upload CPO"  (Draft, Sent, Customer Review, Negotiation, or Won)
   ▼
Customer PO  ──creates──▶  Supplier PO draft (one per conversion, items unpriced)
                              Draft → Ready For Review → Sent → (Partially) Received → Closed
```

- Statuses and the allowed moves between them live in **one file**: `src/lib/status.ts`.
- A quotation is editable while `Draft` (or legacy `Pending`). After that, use **New Revision** (`… Rev-1`, `Rev-2`).
- Converting to a customer PO is all-or-nothing: PO, supplier-PO draft and the `Won` status are written in one transaction.
- A customer PO becomes `Fulfilled` only when **every** supplier PO raised for it has been received.
- Profit figures only count orders whose costs are known (estimated costs recorded / every supplier item priced), so
  missing prices never inflate profit. See `src/lib/finance.ts`.
- Reference numbers (`MTS-2026-001`, `SPO-2026-0001`) come from a database counter (`src/lib/refs.ts`).

### Where things live

| Path                | Contents                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `src/app/actions/`  | Server actions. Each one calls `requireAuth()`, validates input, returns `ActionResult`. |
| `src/lib/`          | Pure logic (status rules, totals, finance, validation, refs, auth tokens).  |
| `src/proxy.ts`      | Page-level sign-in gate (Next 16 replacement for `middleware`).             |
| `tests/`            | `unit/` (pure logic) and `integration/` (real database).                     |

Server actions return `{ ok: true, data } | { ok: false, error }` rather than throwing: Next.js hides thrown error
messages in production, so users would only ever see a generic failure. Add new actions with `runAction()`.

## Database migrations

Production has so far been managed with `prisma db push` (that is what `npm run build` still runs). A proper
Postgres baseline migration is committed in `prisma/migrations/`, so you can move to reviewable migrations.
**One-time switch** for the existing production database (it already has the tables, so the baseline must be marked as applied, not run):

```bash
# with DATABASE_URL / DIRECT_URL pointing at production
npm run db:baseline            # prisma migrate resolve --applied 20261102000000_baseline
npm run db:migrate:deploy      # should report: No pending migrations
```

Then change the `build` script to `prisma generate && prisma migrate deploy && next build`, and make future schema
changes with `npx prisma migrate dev --name what_changed` and commit the generated folder.
Running `migrate deploy` on the existing database *before* baselining fails with `P3005` - that is expected and harmless.

## Known limitations

- Customer PO PDFs: only the **file name** is stored; the file itself is not saved anywhere yet.
- The quotation product picker is a fixed starter list in `src/lib/catalog.ts` (there is no Product table).
- Money is stored as `Float` and rounded to 2 decimals at the server boundary.
- One shared password, no per-user accounts or audit trail.
