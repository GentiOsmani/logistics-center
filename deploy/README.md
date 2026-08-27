# Deploying: GitHub Pages + Cloudflare Workers (permanent, $0, never sleeps)

## Why this shape

The site is now split in two pieces (see the project's top-level `README.md`
for the architecture and what changed vs. the original single Node server):

- **The public catalogue site** is pre-built static HTML, published to
  **GitHub Pages** — a CDN, not a server, so there's nothing to sleep or
  hibernate. Free forever, no card, no country restriction.
- **Admin panel + form submissions** run on a **Cloudflare Worker** backed by
  **D1** (database) — request-driven, so again nothing sits idle waiting to
  time out. Free tier needs no card for Workers/D1 themselves.
- **Datasheet PDFs** are committed straight into the repo (`data/datasheets/`)
  and served as static files by GitHub Pages, same as everything else. This
  isn't a workaround bolted on later — it's the deployed setup: Cloudflare R2
  (the natural place for uploaded files) needs a card-verified account, which
  wasn't obtainable here, so the admin panel registers a datasheet's metadata
  and you commit the actual PDF via git instead of a live upload widget.

This replaces an earlier attempt at a free always-on Oracle Cloud VM, which
turned out to be blocked because Oracle's (and Google Cloud's) signup flow
doesn't accept Kosovo as a billing country — not something fixable from this
end, hence the redesign.

An admin save fires a GitHub Actions rebuild automatically, so the static
site catches up within roughly a minute — see **Content updates** below.

---

## 1. Cloudflare account + Wrangler CLI

- Sign up at **https://dash.cloudflare.com/sign-up** — email + password only,
  no card required for the free Workers/D1 tier.
- Install the CLI and log in:
  ```bash
  npm install -g wrangler
  wrangler login
  ```

## 2. Create the D1 database

```bash
cd worker
npx wrangler d1 create logistics-center
```

Copy the `database_id` it prints into `worker/wrangler.toml`'s
`database_id = "REPLACE_WITH_D1_DATABASE_ID"` line.

## 3. Datasheet storage (no R2)

Nothing to provision here — this deployment skips R2 (it wanted a
card-verified account). To attach a datasheet to a product: commit the PDF to
`data/datasheets/` in the repo, then register it by filename in
`/admin/products/:id` (or `/admin/datasheets`) on the Worker. `git push`
copies it into the live site's `/files/` path automatically on the next build.

## 4. Set Worker secrets

```bash
# from worker/
npx wrangler secret put APP_SECRET
# paste a random value, e.g. the output of: openssl rand -hex 32

npx wrangler secret put ADMIN_EMAIL      # your admin login email
npx wrangler secret put ADMIN_PASSWORD   # a strong password — this becomes the real admin login
```

`PAGES_ORIGIN`, `GH_REPO`, and `GH_DISPATCH_TOKEN` come in steps 7–8 below,
once the GitHub Pages URL exists.

## 5. Seed the catalogue

Generates SQL from the same seed data the original app used, then loads it
into D1:

```bash
# from the repo root
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="a-strong-password" node worker/seed.js > worker/seed.sql
npx wrangler d1 execute logistics-center --remote --file=worker/seed.sql --config worker/wrangler.toml
```

(The admin user this creates in D1 is separate from the `ADMIN_EMAIL`/
`ADMIN_PASSWORD` secrets in step 4 — keep them the same value so there's only
one login to remember.)

## 6. Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

This prints your Worker's URL, something like
`https://logistics-center-api.<your-subdomain>.workers.dev` — copy it, it's
needed everywhere below as `WORKER_ORIGIN`.

Log into `https://<that-url>/admin` now to confirm it works before moving on.

## 7. Enable GitHub Pages

- Repo → **Settings → Pages → Source: GitHub Actions**. Nothing else to
  configure here — `.github/workflows/deploy.yml` handles the rest.
- Your Pages URL will be `https://<github-username>.github.io/<repo-name>/`
  unless you own a custom domain (not required, and not free, so skipped
  here).

## 8. Set repo variables and secrets

Repo → **Settings → Secrets and variables → Actions**:

**Variables** tab (plain, non-secret config the build reads):
| Name | Value |
| --- | --- |
| `SITE_ORIGIN` | `https://<github-username>.github.io` |
| `BASE_PATH` | `/<repo-name>` |
| `WORKER_ORIGIN` | the Worker URL from step 6 |

**Secrets** tab:
| Name | Value |
| --- | --- |
| *(none needed here — the rebuild-trigger token lives on the Worker side, next)* | |

Now go back to the Worker and set the two secrets that let it trigger a
rebuild after an admin save:

```bash
cd worker
npx wrangler secret put PAGES_ORIGIN
# https://<github-username>.github.io  (must match SITE_ORIGIN above — used for the API's CORS allow-list)

npx wrangler secret put GH_REPO
# <github-username>/<repo-name>

npx wrangler secret put GH_DISPATCH_TOKEN
# a fine-grained GitHub PAT: github.com/settings/personal-access-tokens/new
# → Repository access: only this repo
# → Permissions: Actions = Read and write (that's the only permission it needs)
```

## 9. First deploy

```bash
git push origin main
```

This triggers `.github/workflows/deploy.yml`, which runs
`node build/generate.js` (fetching the catalogue from `GET /api/export` on
your Worker) and publishes `dist/` to Pages. Check the Actions tab for
progress; the site is live at the Pages URL a minute or two later.

## 10. Verify

- Pages URL loads, both `/sq` and `/en`, catalogue search/filter work
  instantly (client-side — see the project README for why).
- Submit the contact form — should reach `/admin/inquiries` on the Worker
  within seconds.
- Log into `/admin` on the Worker, edit a product, save — the Pages site
  should reflect it within about a minute (Actions tab shows a run triggered
  by `repository_dispatch`).
- "No hibernation" isn't really testable by waiting, since neither GitHub
  Pages (a CDN) nor Workers (request-driven) have a sleep/wake cycle to
  begin with — that's the property this whole design is for.

---

## Content updates

Two ways to change what's on the site:

- **Day-to-day** (products, categories, brands, inquiry status): use the
  admin panel at `https://<worker-url>/admin`. Every save triggers the
  GitHub Actions rebuild automatically.
- **Code/design changes**: edit and `git push` as normal — the same workflow
  rebuilds on every push to `main`.

## Ongoing cost: $0, with the same two caveats as any free tier

- Stay within Cloudflare's free Workers/D1/R2 limits (generous for a
  catalogue this size — see cloudflare.com/plans for current numbers) and
  GitHub's free Pages/Actions minutes (2,000 min/month on a private repo,
  unlimited on a public one).
- If Cloudflare or GitHub change free-tier terms in the future, that's
  outside anyone's control here — same caveat as it would be for any "free
  forever" platform.

## Local development

```bash
npm run build:local      # generates dist/ from the seed data, no Worker needed
npx serve dist            # preview it locally

cd worker && npx wrangler dev   # run the Worker + a local D1 for admin/API testing
```
