# Masterflow Local SEO Engine

This folder owns the localized SEO engine for Masterflow Plumbing.

The engine is intentionally separate from the reviewed root `index.html`.
Generated preview pages write to `seo-preview/` so they can be served locally
and hot-pushed to the R2 bucket without replacing the homepage.

## Commands

```bash
npm ci
npm run seo:enrich
npm run seo:intel
npm run seo:build
npm run seo:test
npm run seo:serve
```

Upload the preview tree only after local tests pass:

```bash
npm run seo:deploy-preview
```

The deploy helper refuses to run unless Wrangler reports the isolated
`masterflowplumbing2024@gmail.com` Cloudflare login. It uploads to the remote
R2 bucket only, retries transient object-put failures, and writes slash-route
aliases for directory-style previews.

Publish the private Audos control surface only after the local report passes:

```bash
npm run seo:publish-audos
```

This updates the `masterflow-seo-engine` hook, ingests the latest
`seo/reports/build-report.json`, and mints a token-gated noindex permalink page
at `www.valencoreprototype.com/p/<workspace-uuid>/masterflow-seo-engine`. The
generated access URL is written to `tmp/private/masterflow-seo-engine-audos.json`
and is intentionally not committed.

## Output

- `seo-preview/`: generated static preview pages for the CDN prefix.
- `seo/reports/build-report.json`: page counts, guard results, source data, and
  the ValenFramework-style Build -> Match -> Verify -> Execute pipeline state.
- `seo/reports/search-intel-report.json`: review-only public SERP scrape status.
- `seo/data/region-enrichment.json`: public enrichment fetched from Census ACS
  and OpenStreetMap Nominatim.
- `seo/data/search-intel.json`: review-only competitor/keyword candidates from
  public search results. Do not publish these as claims without review.
- `seo/audos/`: Audos hook and token-gated permalink page source for the
  always-on private `valencoreprototype.com` control surface.
- `http://127.0.0.1:8765/masterflow-seo`: private local control surface.

## Framework Shape

The generator follows the ValenFramework pattern from the Kestowv branch:

1. Build pages in memory from structured business, market, service, FAQ, review,
   source, and enrichment data.
2. Match the first-90-day contract shape against the market/service graph.
3. Verify content, metadata, noindex, NAP, JSON-LD, duplicate risk, sitemap
   parity, and private-data guards.
4. Execute file writes only after verification passes.

The private console and `/api/audos-plan` expose the same pipeline report so
Core's 3D runtime and the normal dashboard can ingest one canonical state.

## Safety

- No secrets or workspace ids belong in this folder.
- Root homepage promotion is a separate approval step.
- Preview pages default to `noindex,nofollow`; production indexing requires an
  explicit `--indexable` build and separate approval.
