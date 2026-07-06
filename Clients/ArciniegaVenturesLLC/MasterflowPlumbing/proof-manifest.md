# Masterflow Plumbing Proof Manifest

This manifest keeps the client artifact honest.

## Artifact

| Field | Value |
| --- | --- |
| Client owner folder | `Sites/Clients/ArciniegaVenturesLLC/MasterflowPlumbing/` |
| Wrapper file | `landing.tsx` |
| Static entry | `index.html` |
| Target R2 bucket | `masterflowplumbing-cdn` |
| Target custom domain | `masterflowplumbing.net` |
| Business | Masterflow Plumbing |
| Artifact type | Sanitized Audos-style landing page source plus R2-ready static entry |

## Current Proof

| Proof item | Status |
| --- | --- |
| Wrapper file exists in repo | Present. |
| Static entry exists in repo | Present. |
| Remote R2 bucket | Created: `masterflowplumbing-cdn`. |
| Remote R2 upload | `index.html`, empty root object key, `index`, `cdn-manifest.json`, `landing.tsx`, and `r2-cors.json` uploaded on 2026-06-16; root, `index.html`, and key objects hash-verified against `index.html`. |
| Custom domain | Active: `masterflowplumbing.net`, SSL active, minimum TLS 1.2. |
| WWW custom domain | Active: `www.masterflowplumbing.net`; public root returned the hash-matched R2 object on 2026-06-16. Cloudflare SSL status was still pending immediately after binding. |
| CORS | Applied read-only GET/HEAD CORS policy; live response includes `access-control-allow-origin: *` for cross-origin requests. |
| Wrapper compile proof | `landing.tsx` bundles with esbuild. |
| SEO handoff | Present: `seo-handoff-2026-06-23.md` captures the canonical `.us` decision, redirect priority, missing production sitemap, homepage title/H1 recommendation, media-performance findings, and first page-promotion queue. |
| SEO engine source | Present: `seo/` contains the local SEO engine, source data, generation scripts, and latest reports. Preview output remains intentionally separate from the reviewed root homepage. |
| Local build proof | Not attached in this repo. |
| Screenshot proof | Not attached in this repo. |
| Live URL proof | `https://masterflowplumbing.net/`, `https://www.masterflowplumbing.net/`, and `https://masterflowplumbing.net/index.html?release=masterflow-plumbing-r2-20260616` returned the hash-matched R2 object on 2026-06-16. |
| Approval state | Not recorded in this repo. |
| Source/import note | This file is a sanitized client artifact. It is not a deployment receipt. |

## Sanitized Versus Public

Keep:

- public business copy that belongs on the client page
- public phone/social/location values when they are part of the page
- layout, styling, and offer structure

Do not add without fresh approval:

- private workspace IDs
- private app IDs
- unpublished Audos routes
- private customer data
- platform secrets
- payment or publish credentials

Next proof to attach: screenshot plus live URL or draft URL, with the date and
who approved the artifact state.

Next SEO execution step: promote the approved service/location pages from the
generated preview state only after redirects, production sitemap, and indexable
URL decisions are confirmed.

## Output Validation — 2026-07-06

Full validation pass against `Docs/assignments/cufehaco-client-sites-output-validation.md`
(client-sites PR #1, client-site-tools engine PR #41, live site `masterflowplumbing.us`).

| Check | Result |
| --- | --- |
| `npm install` | Clean, 0 vulnerabilities. |
| `npm run seo:preview` (`--limit-markets=10 --limit-services=8`) | 99 pages, 11/11 guards PASS. |
| `npm run seo:build` (`--full`) | 374 pages, 11/11 guards PASS. |
| `npm run seo:test` | Passed: 374 pages, 11 guards. |
| `cdn-manifest.json` uploadedObjects vs local files | All 20 listed objects exist locally. **Stale as an audit record** — see gap below. |
| `seo/data/*.json` (scope, business, services, markets, reviews, faqs/common) | All valid JSON. `reviews.json` service_slug/city_slug refs and `markets.json` nearby_slugs/zips/neighborhoods/local_signals all resolve cleanly across 33 markets / 10 services. |
| `seo/reports/build-report.json` | `allPass: true`, 11/11 guards, `issues: []`. |
| `index.html` — canonical/phone/license/areaServed/serviceType | Canonical `https://masterflowplumbing.us/` ✓, phone `951-612-7912` ✓ (4 occurrences), license `CSLB #1156577` ✓, `areaServed[]` (33 entries) and `serviceType[]` (14 entries) present. **`addressLocality` inconsistency** — see gap below. |
| `landing.tsx` — CDN_BASE/CDN_RELEASE/REWRITABLE_URL_ATTRIBUTES/srcset | `CDN_BASE` correctly `https://masterflowplumbing.us/`, `CDN_RELEASE` matches manifest release tag, `REWRITABLE_URL_ATTRIBUTES` = `["href","poster","src"]`, srcset rewriting implemented. |
| `LLM.txt` / `llms.txt` | Byte-identical; service list matches `services.json` (10/10), priority areas are a valid subset of `markets.json` slugs. |
| `tracking/umami-events.js` | Wires `phone_click`, `email_click`, `form_submit` correctly; loaded in `index.html` alongside the live Umami collector script (`analytics.masterflowplumbing.us/script.js`, confirmed reachable, HTTP 200). |
| Local preview (`python3 -m http.server 4188`) | `/` → 200; `/admin/` → 404 (no exposed admin path); homepage contains "Emergency Plumber in Corona, CA"; references `masterflow-logo-20260704.png`. |

### Gaps found (for next client / follow-up)

1. **Production is serving stale homepage content.** `masterflowplumbing.us/` (last-modified `2026-07-05T01:02:44Z`, `cf-cache-status: DYNAMIC` — not a CDN cache artifact) is missing entire sections present in the committed `index.html` (HEAD, commit `c531c78`, 2026-07-04): the hero video, proof-strip, service-proof, and 5-star-rating sections. Section copy that does exist (about/approach, reviews) also differs from the repo. The repo's `index.html` has zero uncommitted changes, so this is a real repo-vs-production drift, not a working-tree artifact — the deploy step was not run (or ran from stale content) after the last few commits to `index.html`.
2. **`cdn-manifest.json` is a stale audit record.** Its `uploadedObjects[]` array (dated 2026-06-16) still lists 2 media files no longer referenced anywhere (`img-0617.jpg`, `img-0634.jpg`, both leftover from `business.json`'s `media.hero`/`media.gallery` fields, which are themselves stale) and is missing 9 files that `index.html` currently references, including the current logo (`masterflow-logo-20260704.png`), the social card, and 7 job-photo assets added in later publishes. Confirmed via live `curl` that all 9 files are actually being served from production (200 OK), so this is a documentation/proof-accuracy gap, not a live breakage — but the manifest can no longer be trusted as a deploy receipt without a regen step after each media publish.
3. **`index.html` structured-data `addressLocality` says "Murrieta"; `business.json` (source of truth) says "Corona."** The build-engine-generated pages (`seo-preview/`, `seo-production/`) correctly render `addressLocality: "Corona"` from `business.json`. Only the hand-authored root `index.html` (both locally and in production) still hardcodes `"Murrieta"` — likely left over from before the business address was set to Corona. This is a real NAP (name/address/phone) consistency issue across the site's own JSON-LD, which can hurt local SEO signal quality.
4. **No automated check ties the deployed site back to the repo's HEAD commit.** Gap 1 above went undetected because nothing in this repo's workflow diffs live production against the committed static entry file. A lightweight CI/manual step (`curl` prod + diff against `index.html`) would have caught this immediately.
5. **`business.json`'s `media.hero`/`media.gallery` fields are disconnected from what `index.html` actually renders.** They reference an older photo set (`img-0634.jpg`, `img-0617.jpg`, etc.) that the current homepage no longer uses, so this data file no longer reflects the live creative — worth deciding whether `business.json.media` should drive `index.html` directly (single source of truth) or be retired if it's unused by anything except SEO-preview templating.

### File categorization

- **Source (hand-authored, drives everything else):** `seo/data/*.json` (`business.json`, `services.json`, `markets.json`, `reviews.json`, `scope.json`, `faqs/common.json`, `region-enrichment.json`, `search-intel.json`, `sources.json`), `seo/engine/*.mjs`, `seo/templates/`, `index.html`, `landing.tsx`, `privacy.html`, `terms.html`, `LLM.txt`/`llms.txt`, `tracking/umami-events.js`, `cdn-manifest.json`, `r2-cors.json`, `robots.txt`, `.well-known/security.txt`, `package.json`.
- **Generated (deterministic build output):** `seo-production/` (374-page committed build, tracked in git as the deploy proof), the root-level per-market/service directories (`corona-plumber/`, `lake-elsinore-emergency-plumber/`, etc. — confirmed byte-identical copies of the matching `seo-production/` pages), `sitemap.xml`, `sitemap.html`, `seo/reports/*` (build-report.json, microsite-deployment-queue.csv/json, search-intel-report.json, otto-root-microsite-hook-packet.md). `seo-preview/` is also generated but gitignored (local-only, not committed).
- **Stale (needs a decision or a regen):** `cdn-manifest.json` (gap 2), `business.json.media` (gap 5), production deploy of `index.html` (gap 1 — stale relative to repo, not stale in the "delete it" sense).
- **Proof:** `proof-manifest.md` (this file), `seo-handoff-2026-06-23.md`, `bug-report.md` (repo-root QA log, currently uncommitted), `seo/reports/*` (doubles as generated output and build proof).
