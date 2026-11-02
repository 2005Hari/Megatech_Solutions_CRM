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

## WhatsApp assistant: ask it for anything in the system, or tell it to do something

A staff member chats with a dedicated WhatsApp number. It's a real multi-turn conversation (it remembers
context within a chat), backed by Claude with tool access to your actual data - quotations, customer POs,
supplier POs, customers, margins - plus the ability to create a quotation, move something to a new status,
set supplier buy prices, or delete a record (with a confirmation step - see below). It never messages a
customer directly; it only ever replies to the staff number that wrote to it.

```
Staff, on WhatsApp: "what's the status of MTS-2026-014"
Bot: looks it up, replies with status/items/totals

Staff: "2 cp plus dome cameras and 1 nvr for Rajan Enterprises"
Bot: matches the catalogue, creates a Draft quotation, replies with the total + a review link

Staff: "mark SPO-2026-0007 as sent"
Bot: checks it's allowed (supplier assigned, every item priced), does it, confirms

Staff: "delete CPO-2026-003"
Bot: "Are you sure? Reply yes to confirm." → only deletes once staff replies "yes"
```

There is no in-app review step before most of this runs (by design - see the chat history this was built
from), so three things matter more than usual here:

- **The allowlist is the only gate.** Only numbers added under Settings → "WhatsApp bot - allowed numbers"
  can talk to it; anyone else is silently ignored and logged as `IGNORED_UNAUTHORIZED`.
- **A line is never guessed.** Creating a quotation only prices items the model can match exactly to your
  Products/Services catalogue (by an exact key it was given - if it invents one, that's treated as no
  match, not trusted). Anything unmatched is left out and named explicitly in the reply.
- **Deletes need a real confirmation, enforced by code, not by asking the model nicely.** When a delete is
  requested, the bot asks "are you sure?" and stores exactly what would be deleted. The ACTUAL delete only
  runs if the very next message is a clear "yes" - and runs directly against the same database function the
  app's own delete button uses, without going back through the model. Any other reply cancels it. Every
  write (and every refused/unauthorized message) is logged to `BotActionLog` for audit.

What it deliberately can't do from chat: create or edit customers/suppliers, edit the product catalogue, or
touch its own allowlist - those stay in the app UI, so a misread message can't quietly create bad contact
records or let someone add themselves to the allowlist.

### Setup (Meta WhatsApp Cloud API)

1. Create a [Meta developer app](https://developers.facebook.com/apps) with the **WhatsApp** product added.
   Meta gives you a test phone number for free to develop against.
2. Under WhatsApp → API Setup, copy the **Phone number ID** and a (temporary, or permanent via a System
   User) **access token** into `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`.
3. Under App Settings → Basic, copy the **App Secret** into `WHATSAPP_APP_SECRET`.
4. Pick any random string for `WHATSAPP_VERIFY_TOKEN` (you choose this, Meta just echoes it back once).
5. Set `ANTHROPIC_API_KEY` (the assistant runs on Claude) and `APP_URL` (your deployment's URL, used to build
   review links).
6. Deploy, then in the Meta app's WhatsApp → Configuration, set the webhook URL to
   `https://<your-domain>/api/whatsapp/webhook`, the verify token to the value from step 4, and subscribe
   to the `messages` field.
7. In this app, go to Settings and:
   - Add each staff phone number that may use the bot, in international format (e.g. `919876543210`).
   - Check the **Products** catalogue - it's seeded from a short starter list; add your real products so
     the bot has something to match against and quote correctly.
8. Message the number and try it: ask it something ("what's open right now"), or give it a requirement
   ("Customer: Rajan Enterprises, 2 CP Plus dome cameras, 1 4 channel NVR").

### Known limitations (v1)

- Replies are plain text with a review link, not a PDF - generating a PDF server-side in a webhook needs a
  headless browser, which doesn't fit well in a serverless function. Staff download/send the PDF from the
  app itself after reviewing.
- The whole product/service catalogue is sent to Claude on every message (`src/lib/whatsapp/catalog.ts`), so
  this doesn't scale past a few hundred products without adding a retrieval/shortlisting step first.
- Conversation history resets after 3 hours of inactivity and is trimmed to the most recent ~12 exchanges
  (`src/lib/whatsapp/conversation.ts`) - there's no long-term memory across sessions.
- Customer matching (by name, in a message) is case-insensitive partial matching; ambiguous or unknown names
  are never guessed, but there's no interactive "did you mean X or Y" follow-up yet.
- Creating/editing customers and suppliers, editing the catalogue, and managing the allowlist stay app-only
  by design (see above) - not a gap, a boundary.
- I could not test the Claude side or real WhatsApp delivery live while building this - there were no API
  credentials in the environment. What I did verify: the full tool-calling loop and the confirmation flow
  against real Postgres with the model stubbed (106 tests total), and the webhook's signature verification,
  allowlist enforcement, logging and outbound Meta Graph API request shape against the real Graph API's auth
  check. Not verified: the model's actual judgement in a live conversation, and real message delivery.

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
- One shared password, no per-user accounts or audit trail (the WhatsApp assistant has its own separate
  audit trail - `BotActionLog` - since staff identity there is a phone number, not a login).
- See "WhatsApp assistant" above for that feature's own v1 limitations.
