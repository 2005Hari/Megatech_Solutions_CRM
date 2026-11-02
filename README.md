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

## WhatsApp bot: paste a requirement, get a draft quotation

A staff member forwards a customer's requirement text to a dedicated WhatsApp number; the bot parses it,
matches each line against the **Products**/**Services** catalogue in Settings, creates a Draft quotation
from whatever matched, and replies **on that same staff chat** with the totals and a review link.

```
Customer → (your normal WhatsApp number) → Staff reads it
  → Staff forwards/pastes it to the bot number
    → Bot creates a Draft quotation, replies to STAFF with a summary + link
      → Staff reviews/edits in the app and sends it to the customer themselves
```

The bot never messages a customer directly - it only ever replies to the staff number that wrote to it.
There is no in-app review step before the quotation is created (by design - see the chat history this was
built from), so two things matter more than usual here:

- **The allowlist is the only gate.** Only numbers added under Settings → "WhatsApp bot - allowed numbers"
  can trigger it; anyone else is silently ignored and logged as `IGNORED_UNAUTHORIZED`.
- **A line is never guessed.** If the bot isn't confident a line matches something in the catalogue, that
  line is left OUT of the created quotation (never priced at ₹0) and named explicitly in the WhatsApp reply
  so nothing is silently dropped. Every message the bot acts on - matched, unmatched, or failed - is logged
  in the `BotRequirementLog` table for audit.

### Setup (Meta WhatsApp Cloud API)

1. Create a [Meta developer app](https://developers.facebook.com/apps) with the **WhatsApp** product added.
   Meta gives you a test phone number for free to develop against.
2. Under WhatsApp → API Setup, copy the **Phone number ID** and a (temporary, or permanent via a System
   User) **access token** into `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`.
3. Under App Settings → Basic, copy the **App Secret** into `WHATSAPP_APP_SECRET`.
4. Pick any random string for `WHATSAPP_VERIFY_TOKEN` (you choose this, Meta just echoes it back once).
5. Set `ANTHROPIC_API_KEY` (the bot calls Claude to parse the message) and `APP_URL` (your deployment's URL).
6. Deploy, then in the Meta app's WhatsApp → Configuration, set the webhook URL to
   `https://<your-domain>/api/whatsapp/webhook`, the verify token to the value from step 4, and subscribe
   to the `messages` field.
7. In this app, go to Settings and:
   - Add each staff phone number that may use the bot, in international format (e.g. `919876543210`).
   - Check the **Products** catalogue - it's seeded from a short starter list; add your real products so
     the bot has something to match against.
8. From a WhatsApp chat with the test number, send a requirement, e.g.:
   ```
   Customer: Rajan Enterprises
   2 CP Plus dome cameras, 1 4 channel NVR
   ```
   The `Customer: ...` first line is optional - if it matches exactly one existing customer the quotation
   is linked to them; otherwise it's created unlinked.

### Known limitations (v1)

- The bot's WhatsApp reply is plain text with a review link, not a PDF - generating a PDF server-side in a
  webhook needs a headless browser, which doesn't fit well in a serverless function. Staff download/send the
  PDF from the app itself after reviewing.
- The whole catalogue is sent to Claude on every message (`src/lib/whatsapp/catalog.ts`), so this doesn't
  scale past a few hundred products without adding a retrieval/shortlisting step first.
- Customer matching is a single `Customer: <name>` line, matched case-insensitively; there's no interactive
  "did you mean X or Y" follow-up yet.
- I could not test the Claude extraction or real WhatsApp delivery live while building this - there were no
  API credentials in the environment. The webhook's signature verification, allowlist enforcement, logging,
  and the outbound Meta Graph API request shape were all exercised against the real Graph API's auth check
  (see the PR/commit this came from); only the actual parsing quality and message delivery are unverified.

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
- Money is stored as `Float` and rounded to 2 decimals at the server boundary.
- One shared password, no per-user accounts or audit trail (the WhatsApp bot has its own separate audit
  trail - `BotRequirementLog` - since staff identity there is a phone number, not a login).
- See "WhatsApp bot" above for that feature's own v1 limitations.
