# Masterflow Local SEO Engine

This folder owns the residential and commercial site generator for Masterflow
Plumbing. The same source layer produces the canonical residential homepage,
the `/commercial/` site, service and location routes, blog routes, support
pages, and sitemap families.

Generated review output stays under `.generated.nosync/`. The local review root
serves `.generated.nosync/seo-production`, while `/generator-preview/` exposes
the raw preview build. Publishing targets the Valen-controlled
`valen-clients-cdn/masterflow-plumbing` namespace; it does not hand-edit the
canonical domain or a retired Masterflow bucket.

## Commands

```bash
npm ci
npm run seo:enrich
npm run seo:keyword-universe
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

- `.generated.nosync/seo-preview/`: raw generated preview pages.
- `.generated.nosync/seo-production/`: canonical residential production output.
- `.generated.nosync/commercial-production/`: canonical commercial production output.
- `seo/templates/sitemap.xsl`: shared human presentation for every sitemap; it
  does not alter the standard sitemap XML payload.
- `seo/templates/admin.eta`: dedicated noindex Valen control-record template
  for residential and commercial `/admin/` routes.
- `seo/assets/sitemap/`: Valen logo, Squarish Sans, and the font notice copied
  only into the controlled sitemap deployment lane.
- `seo/reports/build-report.json`: page counts, guard results, source data, and
  the ValenFramework-style Build -> Match -> Verify -> Execute pipeline state.
- `seo/reports/search-intel-report.json`: review-only public SERP scrape status.
- `seo/reports/keyword-universe-report.json`: plumber/service/location
  keyword permutations, demand-source coverage, and target-page mapping.
- `seo/inputs/keyword-universe.json`: full generated query universe for rank,
  demand, and SERP prioritization.
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
