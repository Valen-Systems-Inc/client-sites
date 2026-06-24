# Masterflow Plumbing

### This Directory is the home for Masterflow Plumbing and any related sites, assets, tools, specialized hooks, etc.

This folder is the sanitized home for Masterflow Plumbing artifacts under
Arciniega Ventures LLC.

Current files:

- `index.html`: static R2-ready landing page payload.
- `landing.tsx`: thin TypeScript/React host wrapper that boots the R2/CDN
  payload from `https://masterflowplumbing.net/`.
- `cdn-manifest.json`: target bucket/release metadata for the R2 publish lane.
- `r2-cors.json`: read-only browser CORS policy for the public R2 payload.
- `proof-manifest.md`: what proof is attached and what still needs evidence.
- `seo/`: local SEO engine, source data, reports, and generation scripts for
  service/location page promotion.
- `seo-handoff-2026-06-23.md`: live domain, Cloudflare, sitemap, homepage copy,
  media performance, and page-promotion handoff before the next SEO execution
  pass.

This folder may later hold client-specific assets, tool notes, or hook briefs.
Do not add private workspace IDs, private routes, customer data, or publish
credentials here.
