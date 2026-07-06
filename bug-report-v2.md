# Bug Report — client-sites

Running log of bugs found while inspecting client site artifacts in this repo.
Each entry: client, location, repro, root cause, suggested fix.

---

## OPEN

### 4. Production homepage is stale relative to the committed `index.html`

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/index.html` (deploy target: `masterflowplumbing.us`)
- **Severity**: High — the live site does not reflect the current repo state.
- **Status**: Open.

**Repro**:
```
curl -sI https://masterflowplumbing.us/ | grep -i last-modified
# last-modified: Sun, 05 Jul 2026 01:02:44 GMT ; cf-cache-status: DYNAMIC (rules out stale CDN cache)
diff <(curl -s https://masterflowplumbing.us/) Clients/ArciniegaVenturesLLC/MasterflowPlumbing/index.html
```

**Root cause**: The working tree's `index.html` has zero uncommitted changes (matches HEAD,
commit `c531c78`, 2026-07-04), so this is not a local-only edit — it's a real repo-vs-production
drift. Production is missing entire sections present in the repo's `index.html`: hero video,
proof-strip, service-proof, and 5-star-rating sections. Sections that do exist on both (about,
reviews) also carry different copy. Whatever deploy step publishes this file to R2 either wasn't
run after the last few `index.html` commits, or was run from a stale checkout.

**Suggested fix**: Re-run the production deploy (`seo:deploy-production` / whatever process
publishes the static root, not just `seo-production/`) for this client, then diff live vs. repo
again to confirm parity. Longer term: add a CI/manual step that diffs the deployed homepage
against the repo's `index.html` after every publish, so this class of drift is caught immediately
instead of during an ad hoc validation pass.

**No wrangler/Cloudflare credentials available in this environment** — this deploy needs to run
from wherever the `masterflowplumbing2024@gmail.com` Cloudflare account is authenticated. Files to
push to bucket `masterflowplumbing-cdn` (account `f3c8cc51d06b88d2dc0f3ff25f5aeacf`): `index.html`
(now also carries the bug #5 fix below — push the updated version) to object keys `""`, `"index"`,
and `"index.html"`, plus `landing.tsx` and `cdn-manifest.json` (updated for bug #6, below) if not
already current on the bucket. After pushing, re-verify with
`curl -sI https://masterflowplumbing.us/ | grep last-modified` (expect newer than
`2026-07-05T01:02:44Z`) and `diff <(curl -s https://masterflowplumbing.us/) index.html`.

---

---

## FIXED (2026-07-06, this pass)

### 5. `index.html` structured data said `addressLocality: "Murrieta"`; source of truth (`business.json`) says `"Corona"`

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/index.html` (JSON-LD block)
- **Severity**: Medium — NAP (name/address/phone) inconsistency in the site's own structured data hurts local SEO signal quality.
- **Status**: Fixed (local repo only — not yet deployed; bundled with bug #4's deploy).

**Detail**: `seo/data/business.json` sets `address.city: "Corona"`, and the build-engine-generated
pages (`seo-preview/`, `seo-production/`) correctly render `addressLocality: "Corona"` from it
(see `seo/engine/build.mjs:311`, `addressLocality: business.address.city`). Only the hand-authored
root `index.html` hardcoded `"Murrieta"` in its `LocalBusiness` JSON-LD — left over from before
the business's SEO-focus city was set to Corona. Every other signal on the page (title, meta
description, OG tags, `areaServed`) was already Corona-centric, so this read as an oversight
rather than an intentional dual-city stance; the `sameAs` Yelp link
(`masterflow-plumbing-murrieta-2`) and the `areaServed`/reviews mentions of Murrieta as a served
city are legitimate and were left untouched.

**Fix applied**: `addressLocality` in `index.html`'s JSON-LD changed from `"Murrieta"` to
`"Corona"`. Verified the script block still parses as valid JSON after the edit.

---

### 6. `cdn-manifest.json` was a stale audit record of what's actually deployed

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/cdn-manifest.json`
- **Severity**: Low — production was not actually broken (confirmed all files serve 200 OK), but the manifest could no longer be trusted as a deploy receipt.
- **Status**: Fixed.

**Detail**: `uploadedObjects[]` (dated 2026-06-16) listed 2 media files no longer referenced
anywhere (`media/img-0617.jpg`, `media/img-0634.jpg` — both leftovers from `business.json`'s
then-stale `media.hero`/`media.gallery` fields, see bug #7) and was missing 9 files `index.html`
currently references, including the current logo (`masterflow-logo-20260704.png`), the social
card, and 7 job-photo assets added in later publishes. All 9 were confirmed live via `curl`
(200 OK), so the actual R2 bucket was fine — only this manifest's record of it was out of date.

**Fix applied**: Regenerated `uploadedObjects[]` by diffing every `media/*` reference actually
present in `index.html` against the manifest's list — removed the 2 orphaned entries, added the
9 missing ones (29 objects total, root files unchanged). Bumped `uploadedAt` to `2026-07-06` to
mark the regen. Verified programmatically: zero missing, zero stale entries remain.

---

### 7. `business.json`'s `media.hero`/`media.gallery` fields no longer matched what `index.html` renders

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/seo/data/business.json`
- **Severity**: Low.
- **Status**: Fixed.

**Detail**: `business.json.media` is not dead data — `hero`, `gallery`, and `proof` all feed the
build engine directly (`build.mjs:306,428,503,535,567`, `server.mjs:270`, `templates/page.eta`),
so they render across all 374 generated SEO pages (og:image, hero backgrounds, proof images).
Checked each entry against what `index.html` currently uses: only 2 of the 8 references were
actually orphaned — `hero: img-0634.jpg` and one gallery entry, `img-0617.jpg`. The other 6
gallery/proof entries (`img-6137.jpg`, `img-0637.jpg`, `img-1669.jpg`,
`80220303036-...jpg`, `dc1a645d-...jpg`, `img-1059-poster.jpg`) are still live on the current
homepage and were left unchanged.

**Fix applied**: Replaced the 2 orphaned entries with photos already in current rotation on
`index.html`: `hero` → `/media/masterflow-company-van-1.jpg`, the stale gallery slot →
`/media/dan-cutter-sewer-liner-reinstatement-1.jpg`. Re-ran `npm run seo:build` (374 pages) and
`npm run seo:test` after the change — still 11/11 guards passing, no regressions.

---

## FIXED

### 1. `seo:preview` fails validation due to truncate-before-validate ordering

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/seo/engine/build.mjs`
- **Severity**: Medium (blocks the fast preview workflow; full build is unaffected)
- **Status**: Fixed.

**Repro**:
```
cd Clients/ArciniegaVenturesLLC/MasterflowPlumbing
npm install
npm run seo:preview
```
```
data validation failed: [{"scope":"market:corona","errors":[{"message":"nearby_slug eastvale is not defined"}]},
{"scope":"market:corona","errors":[{"message":"nearby_slug ontario is not defined"}]},
{"scope":"market:norco","errors":[{"message":"nearby_slug eastvale is not defined"}]}]
```

**Root cause**: `build.mjs` slices `markets` down to `--limit-markets` *before* running
`validateData` (truncate at line ~1023, validate at line ~1027). `eastvale` and `ontario`
are real, valid entries in `seo/data/markets.json` — they're just outside the first-3
slice used by `--limit-markets=3`, so their cross-references from `corona`/`norco`'s
`nearby_slugs` fail validation even though the data is correct.

Confirmed as an ordering bug, not bad data: `npm run seo:build` (no market limit) runs
clean — 374 pages, 11/11 guards pass.

**Fix applied**: `validateData()` in `build.mjs` now takes an `allMarketSlugs` set
(captured from the full `data.markets` list before any `--limit-markets` truncation)
and checks `nearby_slugs` against that instead of the truncated slice. Same treatment
applied to the `reviews[].city_slug` / `reviews[].service_slug` checks via a new
`allServiceSlugs` param — reviews aren't filtered to the preview subset anywhere else
in the pipeline, so they were hitting the identical false-positive pattern.

---

### 2. `landing.tsx` wrapper still points at the old `.net` domain

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/landing.tsx`
- **Severity**: Medium (wrapper boots from a domain that isn't the canonical one anymore)
- **Status**: Fixed.

**Detail**: `seo-handoff-2026-06-23.md` records the canonical-domain decision:
use `https://masterflowplumbing.us/` everywhere. `cdn-manifest.json`, `index.html`
(canonical/OG tags), `robots.txt`, and `sitemap.xml` all correctly reflect this.

`landing.tsx` was not updated in that pass — it still hardcodes:
```ts
const CDN_BASE = "https://masterflowplumbing.net/";
const CDN_RELEASE = "masterflow-plumbing-r2-20260616"; // predates the 2026-06-23 .us decision
```
vs. `cdn-manifest.json`:
```json
"cdnBase": "https://masterflowplumbing.us/",
"entry": "https://masterflowplumbing.us/index.html?release=masterflow-plumbing-r2-20260616"
```

**Fix applied**: `CDN_BASE` in `landing.tsx` updated to `https://masterflowplumbing.us/`,
matching `cdn-manifest.json`. `CDN_RELEASE` left untouched (`masterflow-plumbing-r2-20260616`)
since it already matches the manifest's uploaded release tag — only the domain was stale.
Re-verified the esbuild compile proof (`npx esbuild landing.tsx --bundle --format=esm
--jsx=automatic --external:react --external:react-dom/client --external:react/jsx-runtime`)
still bundles clean at 6.2kb.

---

### 3. (found while fixing #1) `seo:preview`'s limits were too small to satisfy the site's own word-count guards

- **Client**: ArciniegaVenturesLLC / MasterflowPlumbing
- **File**: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/package.json` (`seo:preview` script)
- **Severity**: Medium — this was latent and masked by bug #1; fixing #1 exposed it as the
  new failure mode of the same `npm run seo:preview` command.
- **Status**: Fixed.

**Detail**: After fixing #1, `seo:preview` (`--limit-markets=3 --limit-services=4`) got past
data validation but then failed the render-time `wordCount` guard on the homepage, city-hub,
and service-hub pages. Root cause: city-hub pages list nearby markets/services and service-hub
pages list up to 12 markets (`markets.slice(0, 12)` in `serviceHubBody`) to pad out real content
— with only 3 markets and 4 services available, there isn't enough related content to clear the
260/300/520-word minimums the guards enforce (these minimums are correct and intentional; the
preview's data slice was just too thin to meet them).

**Fix applied**: bumped the `seo:preview` script's limits to `--limit-markets=10
--limit-services=8` (of 33 markets / 10 services total) — enough related content to pass all
11 guards while still being a meaningfully smaller/faster preview (99 pages) than the full
374-page build.

---

## VERIFIED OK (no action needed)

- `npm install` — clean, 0 vulnerabilities.
- `npm run seo:build` / `npm run seo:test` — 374 pages, 11/11 guards pass.
- `landing.tsx` bundles cleanly with esbuild when `react`/`react-dom` are marked external
  (expected — Audos hosts React externally), confirming the `proof-manifest.md` compile claim.
- `index.html` already carries most of the `seo-handoff-2026-06-23.md` recommendations:
  - Title/H1 updated to Corona-specific positioning.
  - Canonical/OG URLs point to `.us`.
  - All 26 `<img>` tags have explicit width/height; 24/26 are `loading="lazy"`.
  - The large 9.7MB video (`img-1070.mp4`) is not autoplaying; only the 1.4MB hero
    clip (`img-1059.mp4`) autoplays.
- Local serving works via both `python3 -m http.server 5173` and the repo's own
  `index.html` / `seo-preview/index.html` (200 OK on both).
