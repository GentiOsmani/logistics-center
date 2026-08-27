# Logistics Center — Industrial Supply & Technical Services

A bilingual (Albanian / English) catalogue and technical-services platform for an
industrial supply company serving factories in Kosovo and Albania.

Customers can search by part number, browse the catalogue, download datasheets,
build a quotation request and file a technical support call. Staff manage
everything through a built-in admin panel.

---

## Why it is built this way

The brief asked for the lowest reasonable browser resource consumption. That ruled
out a client-side framework, so the whole site is **server-rendered HTML with one
stylesheet**. What is left is small enough to measure:

| Page | HTML over the wire | Requests | Client JS |
| --- | --- | --- | --- |
| Home | ~8.9 KB (brotli) | 3 | 687 B |
| Catalogue | ~7.1 KB | 3 | 687 B |
| Product detail | ~4.4 KB | 2 | 0 |
| Service detail | ~3.4 KB | 2 | 0 |

Server render times, measured with `npm run bench` (300 requests per route,
keep-alive, including SQLite queries and brotli compression):

```
route                 status   bytes(br)     avg      p50      p95
home                     200       8903     1.45     1.42     1.85
catalogue                200       7122     1.52     1.48     1.94
search (part no.)        200       4333     1.10     1.06     1.40
product detail           200       4425     0.88     0.83     1.18
service detail           200       3430     0.59     0.56     0.78
stylesheet               200       7893     0.12     0.11     0.17
```

The decisions behind those numbers:

- **Zero npm dependencies.** No framework, no bundler, no build step, no
  `node_modules`. The database is Node's built-in `node:sqlite`. Deployment is
  `git pull && node server.js`.
- **687 bytes of JavaScript, on two pages only.** The single script adds
  part-number suggestions to the search box. Everything else — the mobile
  navigation drawer, filter accordions, the quote basket, delete confirmations —
  is plain HTML and CSS. With JavaScript disabled the entire site still works.
- **One stylesheet, no web fonts.** 44 KB of hand-written CSS (7.9 KB brotli),
  a system font stack, and icons inlined as SVG. The blueprint grids, corner
  brackets and hazard stripes are CSS gradients, so the site ships **no image
  files at all** — the favicon is an inline data URI.
- **Assets hashed and pre-compressed at boot.** Brotli-11 and gzip-9 are computed
  once at startup and served from memory with `immutable` caching. HTML is
  compressed per response at brotli quality 4, which is cheap, and carries a
  content ETag so unchanged pages cost one 304.
- **Every SQL statement is prepared once** and cached for the process lifetime.
  Part-number lookups hit an index on a normalised column; text search uses SQLite
  FTS5.

---

## Getting started

Requires **Node.js 22.5 or newer** (for the stable `node:sqlite` module). It was
developed and tested on Node 26.

```bash
node server.js
```

That is the whole setup. On first run the database is created, the schema applied
and the catalogue seeded automatically. Then open:

- Public site — <http://localhost:3000> (redirects to `/sq` or `/en` by `Accept-Language`)
- Admin panel — <http://localhost:3000/admin>

Default administrator: `admin@logisticscenter.com` / `ndrysho-fjalekalimin`.
**Change it before deploying:**

```bash
node scripts/user.js password admin@logisticscenter.com "a-long-passphrase"
```

### Scripts

```bash
npm start          # run the server
npm run dev        # run with --watch for auto-reload
npm run seed       # seed the catalogue (add -- --force to wipe and reseed)
npm run db:reset   # delete the database file
npm run user       # list / add / password / disable admin users
npm run bench      # latency benchmark against a running server
```

### Configuration

All settings come from environment variables and have working defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listening port |
| `HOST` | `0.0.0.0` | Bind address |
| `APP_SECRET` | dev placeholder | **Set in production.** Signs the basket cookie |
| `DB_FILE` | `data/app.db` | SQLite database path |
| `TRUST_PROXY` | off | Set to `1` behind nginx/Caddy to honour `X-Forwarded-*` |
| `NODE_ENV` | — | Set to `production` when deployed |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | see above | Seed administrator on first run |

Company details (name, addresses, phone numbers, VAT number) live in
[`src/config.js`](src/config.js) — edit them there.

---

## Project layout

```
server.js                  HTTP entry point, routing, sitemap/robots, shutdown
src/
  config.js                Environment config and company details
  core/                    Framework-shaped primitives, no business logic
    html.js                Auto-escaping html`` template tag
    router.js              Pattern → RegExp router
    body.js                urlencoded + multipart parsers
    respond.js             HTML/JSON/text responses, compression, ETags, CSP
    static.js              Hashed, pre-compressed in-memory asset store
    context.js             Per-request view context (locale, cart, assets)
    cookies.js, crypto.js  Cookie parsing; HMAC signing and scrypt passwords
  db/
    schema.sql             Full schema, including the FTS5 index
    db.js                  Connection, pragmas, prepared-statement cache
    repo/                  One module per aggregate; all SQL lives here
    seed/                  Seed catalogue: 42 products, 28 brands, 8 services
  i18n/                    sq.js / en.js dictionaries and locale negotiation
  lib/                     slug, validation, rate limiting
  routes/
    public.js              Public site routes
    admin.js               Admin routes, session gate, CSRF
  views/
    layout.js              Document shell, header, footer
    partials/              Icons and shared components
    pages/                 One module per public page
    admin/                 Admin shell and pages
public/assets/             main.css, admin.css, suggest.js
data/                      SQLite database and uploaded datasheets (git-ignored)
scripts/                   seed, reset, user management, benchmark
```

The layering is strict: `views` never touch the database, `routes` never write
SQL, and `db/repo` never emits HTML.

---

## Features

### Catalogue and part-number search

Search is built for the way a maintenance engineer actually types. The query is
normalised to uppercase alphanumerics, so `6ES7 214-1AG40`, `6es7214-1ag40` and
`6ES72141AG400XB0` all resolve to the same CPU. Results are ranked in tiers:

1. exact part number
2. exact cross-reference (OEM, equivalent or superseded number)
3. part-number prefix
4. full-text match on titles, summaries, brand and category (FTS5, diacritic-insensitive,
   so `kushineta` and `kushinetë` both match)

Cross-references matter in practice: searching the Rexroth material number
`R900561276` finds the valve catalogued as `4WE6D6X/EG24N9K4`.

### Quotation requests

The basket is stored server-side and referenced by one short signed cookie, so
the basket contents are never re-uploaded on every request. Customers can add
catalogue items or paste a block of part numbers with quantities
(`6205-2RSH, 4`). Submitted requests are matched against the catalogue where
possible and given a reference like `KUO-2026-0001`.

### Technical support section

A dedicated section for troubleshooting and on-site intervention: an urgency
selector (normal / urgent / line down), machine identification, problem
description, a visible emergency phone number, and a five-step explanation of how
a call is handled. Requests are filed as `SUP-…` and flagged in the admin
dashboard when the line is down.

### Admin panel

Session login (scrypt password hashing, server-side sessions, 8-hour expiry),
dashboard with inquiry counters, full CRUD for products (including bilingual
copy, specification rows and cross-references), categories, brands, datasheet
upload, and inquiry handling with status workflow and internal notes.

### Bilingual

Every page exists at `/sq/...` and `/en/...`. Content columns are suffixed `_sq`
and `_en` in the database and selected per request; the language switcher
preserves the current path and query string, and pages emit `hreflang`
alternates. A missing translation falls back rather than breaking a page.

---

## Security notes

- Strict CSP: `script-src 'self'`, `style-src 'self'`, `base-uri 'none'`. There
  are no inline scripts, no inline event handlers and no `style` attributes
  anywhere in the output — a small utility class layer in the stylesheet exists
  precisely so templates never need one.
- Admin sessions are server-side and revocable. Every mutating admin request must
  carry the session's CSRF token; the check runs regardless of `Content-Type`, so
  a request with no parsable body is rejected rather than passing through.
- Public forms carry no session, so they are protected by an origin check, a
  honeypot field and a per-IP rate limit instead of a token round-trip.
- Uploads are restricted by extension, stored under a generated filename, and
  served only through a filename allowlist.
- All template interpolation is escaped by default; raw HTML requires an explicit
  `raw()` call.

Behind a reverse proxy set `TRUST_PROXY=1` so rate limiting sees real client
addresses, and terminate TLS at the proxy.

---

## Things worth knowing before going live

- **Inquiries are stored, not emailed.** Quote and support requests land in the
  database and appear in the admin panel. If the company wants email
  notifications, that is one function called from `createInquiry`.
- **Seed data is illustrative.** The 42 products use real manufacturer part-number
  formats so that search behaves realistically, but prices, stock status and lead
  times are placeholders. Replace them through the admin panel, and update the
  contact details in `src/config.js`.
- **Single-process design.** The rate limiter keeps its counters in memory and
  SQLite runs in WAL mode, which suits one server process comfortably. Running
  multiple processes behind a load balancer would need a shared rate-limit store.
