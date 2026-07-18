# Masterflow SEO Engine

This is the operating map for the Masterflow Plumbing SEO system in
`Valen-Systems-Inc/client-sites`.

Plain read: the repo can build pages, publish approved files to Cloudflare R2,
crawl the live site, ingest outside signals, score pages, and generate next
actions. It cannot force Google to index, rank, or trust the business. That
outside truth comes from GSC, SERP data, GBP/Apple/Bing, citations, reviews,
traffic, and calls.

## Current Snapshot

```text
source repo: git@github.com:Valen-Systems-Inc/client-sites.git
release branch: codex/masterflow-valen-sitemap-theme
canonical site: https://masterflowplumbing.us
decommissioned web domain: https://masterflowplumbing.net
current release: mflow-v.1.0.11
residential output: 432 pages; 102 indexable; 330 noindex
commercial output: 37 pages; 37 indexable; 0 noindex
latest live verification: 2026-07-18T15:46Z
```

The live residential verifier passed 489 artifacts and the commercial verifier
passed 92. Release evidence is recorded in
`seo/reports/*mflow-v.1.0.11*.json`. Older sections that cite June 2026 signal,
rank, or runner snapshots remain historical operating notes and must not
override the v1.0.11 release reports.

## The Owner Split

| Surface | Owner | Current proof | Gap |
| --- | --- | --- | --- |
| Source data | repo | `seo/data/*`, `seo/config/stack.json` | Business/profile facts still need client proof. |
| Page generation | repo | 432 residential pages and 37 commercial pages; 15 guards passing | Generated pages are not ranking proof. |
| Promotion gate | repo/editorial | `root-promotion-artifacts.json`: 32 approved root artifacts | Future pages still need approval. |
| Live site | Valen R2 plus Cloudflare proxy | `mflow-v.1.0.11`: 489 residential and 92 commercial live artifacts pass | Live pages still need Google index/rank proof. |
| Canonical policy | repo/live site | `.us` is served through the Valen CDN proxy; `.net` has no web route | Keep checking after CDN changes. |
| Sitemap | live site/GSC | Parent sitemap plus page, services, areas, post, category, and one-URL accreditation families return standard XML with trailing-slash canonicals and `lastmod`; Valen XSL presentation assets route through the controlled sitemap silo | Search Console submission and indexing remain external steps. |
| SERP truth | manual import/OpenSERP/SerpBear | 36 manual Google SERPs imported, 90 competitors | Continuous tracking is not running yet. |
| GSC | Google | Auth/source connected; sitemap lane exists | 0 rows; 21 first-wave URL requests remain. |
| Analytics | Umami | 19 views, 4 tel clicks in current input | Runner cannot currently pull from Docker/Postgres. |
| Calls | Umami/import | 4 phone-click call events | No qualified/booked call dispositions. |
| Reviews | repo/import | 3 consented local reviews in input | GBP is not connected. |
| GBP/Apple/Bing | client/platforms | Not repo-owned | Need admin/access and profile exports. |
| Citations | repo plus human | Not first-class yet | Need citation targets, crawler, packets, status import. |

## What Exists In Software

### Page And CDN Engine

The repo can generate the SEO page universe, stage approved root pages, build a
CDN deploy plan, and publish to the Cloudflare R2 bucket when explicitly
approved.

Key files:

```text
clients/masterflow-plumbing/seo/reports/build-report.json
clients/masterflow-plumbing/seo/reports/root-promotion-artifacts.json
clients/masterflow-plumbing/seo/reports/cdn-deploy-plan.json
clients/masterflow-plumbing/seo/reports/live-promotion-verification.json
```

Useful commands:

```bash
npm run stack:build
npm run stack:test
npm run stack:stage-promotions
npm run stack:cdn-plan
npm run stack:cdn:dry-run
npm run stack:cdn:publish
```

Do not run the publish command unless the live write is approved.

### Domain, Sitemap, And Crawl Checks

The stack checks canonical/domain policy, sitemap health, robots, and live crawl
inventory.

Key files:

```text
clients/masterflow-plumbing/seo/reports/domain-policy-report.json
clients/masterflow-plumbing/seo/reports/sitemap-plan.json
clients/masterflow-plumbing/seo/reports/live-crawl-siteone.json
```

Current proof:

- `https://masterflowplumbing.us/` serves the canonical site.
- HTTP and `www` `.us` variants redirect to `https://masterflowplumbing.us/`.
- `.net` is intentionally inert: no website DNS, Worker/API route, redirect, or R2 custom domain.
- Homepage title/H1 are centered on `Emergency Plumber in Corona, CA`.
- `robots.txt` and `sitemap.xml` return 200.
- Sitemap has homepage plus 32 live SEO root pages.

Useful commands:

```bash
npm run stack:crawl
npm run stack:policy
npm run stack:sitemap
```

### Keyword And SERP Intelligence

The repo can generate the keyword universe and rank seed, then feed competitor
SERP data into the scorecard.

Key files:

```text
clients/masterflow-plumbing/seo/inputs/keyword-universe.json
clients/masterflow-plumbing/seo/inputs/rank-keyword-seed.json
clients/masterflow-plumbing/seo/reports/google-serp-capture-queue.json
clients/masterflow-plumbing/seo/reports/search-intel-report.json
clients/masterflow-plumbing/seo/data/search-intel.json
```

Current proof:

- 144 rank keywords are generated.
- 36 Google SERP captures were imported.
- Latest SERP mode is `google-serp-import`.
- `googleOrganicTop10` is true for that imported batch.
- Current top-10 wins are brand/location searches, not non-brand plumber terms.

Known top-10 hits from the imported batch:

- `masterflow plumbing corona`: homepage rank 1, `/corona-plumber` rank 3.
- `masterflow plumbing lake elsinore`: `/lake-elsinore-plumber` rank 2,
  homepage rank 5, `/lake-elsinore-emergency-plumber` rank 7.
- `masterflow plumbing near lake elsinore`: `/lake-elsinore-plumber` rank 2,
  `/lake-elsinore-emergency-plumber` rank 4, homepage rank 7.

Not proven yet:

- `corona plumber` top 10.
- `emergency plumber corona` top 10.
- `lake elsinore plumber` top 10.
- `pasadena drain cleaning` top 10.
- SFV/Calabasas/Studio City/Hollywood/Topanga/Malibu/Glendale non-brand top 10.

Useful commands:

```bash
npm run stack:keyword-universe
npm run stack:inputs:rank-seed
npm run stack:serp-capture-queue
npm run stack:search-intel
npm run stack:search-intel:google
npm run stack:search-intel:google-goals
```

OpenSERP exists on `valenthree` at:

```text
/home/wrodbvf/.local/bin/openserp
/home/wrodbvf/go/bin/openserp
```

But OpenSERP is not currently a durable Docker service in this repo. It can
still hit Google CAPTCHA. Free compute helps the loop run; it does not by
itself buy clean Google SERP access.

### Self-Hosted OSS Stack

The repo has a Docker Compose stack for:

- Umami plus Postgres.
- SerpBear.
- Gitea.

Key files:

```text
oss-stack/docker-compose.yml
oss-stack/README.md
oss-stack/better-search-console/README.md
```

Useful commands:

```bash
npm run stack:env:init
npm run stack:compose:install
npm run stack:compose:config
npm run stack:compose:up
npm run stack:compose:ps
npm run stack:inputs:seed-serpbear
npm run stack:inputs:pull-serpbear
npm run stack:inputs:sync-umami
npm run stack:inputs:pull-umami
npm run stack:inputs:pull-calls
```

Current gap: the latest local `input-sync-report.json` shows SerpBear fetches
failing and Umami/call pulls failing because Docker/Postgres is not reachable.
The read-only `valenthree` check also reported Docker API permission denied and
Compose unavailable from the checkout.

### Search Console

The stack can use direct GSC OAuth/API pulls and manual imports.

Key files:

```text
clients/masterflow-plumbing/seo/inputs/search-console.json
clients/masterflow-plumbing/seo/reports/search-console-indexing-requests.json
clients/masterflow-plumbing/seo/reports/signal-inventory.json
```

Useful commands:

```bash
npm run stack:inputs:gsc-sites
npm run stack:inputs:gsc-submit-sitemap -- --site-url=https://masterflowplumbing.us/ --sitemap=https://masterflowplumbing.us/sitemap.xml
npm run stack:inputs:pull-gsc -- --site-url=https://masterflowplumbing.us/
npm run stack:inputs:import-gsc -- --file=path/to/gsc-export.csv
```

Current proof/gap:

- GSC source is connected.
- Sitemap submission lane exists and has been used.
- Latest Search Console input still has 0 rows.
- Manual URL Inspection request-indexing is partial: 11 requested, 21 remaining.
- Request indexing is a Search Console UI/quota gate, not a repo command.

### Feedback Loop

The loop scores the pages from actual evidence. It should stay conservative.

Key files:

```text
clients/masterflow-plumbing/seo/reports/signal-inventory.json
clients/masterflow-plumbing/seo/reports/feedback-loop.json
clients/masterflow-plumbing/seo/reports/visibility-scorecard.json
clients/masterflow-plumbing/seo/reports/live-action-plan.json
clients/masterflow-plumbing/seo/reports/loop-state.json
```

Latest scorecard:

```text
goals: 13
winning: 0
gainingVisibility: 0
needsRevision: 0
waitingForSignals: 11
needsEditorialReview: 2
competitorIntelPresent: true
googleOrganicTop10Intel: true
```

Useful commands:

```bash
npm run stack:signals
npm run stack:feedback
npm run stack:scorecard
npm run stack:plan-live
npm run stack:loop -- --iterations=1 --interval=1
npm run stack:loop:start -- --interval=300
npm run stack:loop:stop
```

A page is not "working" just because it is live. The loop needs GSC rows,
rank tracking, analytics, phone clicks, calls, reviews, citations, or profile
signals before it should call a page a winner.

## What Is Missing

### Runner Health

`valenthree` needs to become the real runner again:

- reconcile the checkout with GitHub `main`,
- decide what to do with dirty generated reports,
- install/enable Docker Compose,
- fix Docker socket/group permission,
- start Umami and SerpBear,
- verify SSH tunnels and APIs.

### Continuous SERP Tracking

Manual Google import works. Continuous tracking is not proven.

Needed:

- run OpenSERP from `valenthree` and record whether Google blocks it,
- start/seed SerpBear,
- pull ranks into `rank-tracking.json`,
- use paid SERP only if OSS remains unstable.

### GSC Rows And Index Coverage

GSC is connected but empty.

Needed:

- finish the remaining URL Inspection requests as quota allows,
- pull GSC daily,
- wait for Google to process/index,
- use GSC query/page rows as the main revision signal.

### GBP, Apple, Bing, Reviews

The repo cannot claim business profiles.

Needed from the human/client lane:

- GBP owner/manager access,
- Apple Business Connect access,
- Bing Places access,
- review link and review request flow,
- profile/service/category/service-area cleanup,
- profile/review exports back into `reviews.json`.

### Citation Engine

The inputs can consume citation/entity data, but the command family does not
exist yet.

Build next:

```text
stack:citations:targets
stack:citations:crawl
stack:citations:packet
stack:citations:import-status
stack:citations:entity-report
```

That should track NAP, directory URL, account owner, submission status,
verification method, live listing URL, last checked date, and human follow-up.

### Qualified Lead Feedback

Phone-click events exist. Revenue-quality feedback does not.

Needed:

- call provider export,
- call disposition import,
- qualified/booked flags,
- landing-page mapping.

### Page Depth And Entity Proof

The live pages need more competitive proof before non-brand searches move.

First content targets:

1. Corona plumber.
2. Corona emergency plumber.
3. Lake Elsinore plumber.
4. Lake Elsinore emergency plumber.
5. Lake Elsinore drain cleaning.
6. Calabasas/SFV/Studio City.
7. Pasadena drain cleaning.
8. Glendale/Hollywood/Topanga/Malibu.

Revision input should come from imported Google SERPs, GSC rows once available,
calls, reviews, local job proof, neighborhood detail, service detail, and
internal-link gaps.

## Smallest Safe Loop

Run this when you want the system to think without publishing:

```bash
cd Clients/ArciniegaVenturesLLC/MasterflowPlumbing
npm run stack:inputs:pull-gsc -- --site-url=https://masterflowplumbing.us/
npm run stack:search-intel
npm run stack:signals
npm run stack:feedback
npm run stack:scorecard
npm run stack:plan-live
```

Run this only after self-hosted services are actually up:

```bash
npm run stack:inputs:seed-serpbear
npm run stack:inputs:pull-serpbear
npm run stack:inputs:pull-umami
npm run stack:inputs:pull-calls
npm run stack:signals
npm run stack:scorecard
```

Run this only after live publish approval:

```bash
npm run stack:stage-promotions
npm run stack:cdn-plan
npm run stack:cdn:dry-run
npm run stack:cdn:publish
```

## Current Honest Claim

Allowed claim:

```text
Masterflow has a live canonical .us site, 32 live indexable SEO root pages, a
production sitemap, Search Console connection, manual Google SERP import,
Cloudflare request inventory, Umami/call event plumbing, and a scorecard loop.
It has brand/location visibility, but it does not yet prove non-brand top-10
organic visibility.
```

Do not claim yet:

- non-brand plumber rankings are won,
- all new pages are indexed,
- SerpBear is actively tracking,
- OpenSERP has solved Google CAPTCHA,
- GBP/local pack is fixed,
- Cloudflare request volume proves SEO improvement,
- phone clicks prove booked revenue.
