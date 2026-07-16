# Masterflow Plumbing

### This Directory is the home for Masterflow Plumbing and any related sites, assets, tools, specialized hooks, etc.

This folder is the sanitized home for Masterflow Plumbing artifacts under
Arciniega Ventures LLC.

Current files:

- `index.html`: static R2-ready landing page payload.
- `landing.tsx`: thin TypeScript/React host wrapper that boots the R2/CDN
  payload from `https://clients.valen-systems.com/masterflow-plumbing/`.
- `cdn-manifest.json`: target bucket/release metadata for the R2 publish lane.
- `commercial/`: the separate commercial site profile, including services,
  industries, service-area coverage, and commercial guides.
- `r2-cors.json`: read-only browser CORS policy for the public R2 payload.
- `proof-manifest.md`: what proof is attached and what still needs evidence.
- `seo/`: local SEO engine, source data, reports, and generation scripts for
  service/location page promotion.
- `seo-handoff-2026-06-23.md`: live domain, Cloudflare, sitemap, homepage copy,
  media performance, and page-promotion handoff before the next SEO execution
  pass.

The canonical customer domain is `https://masterflowplumbing.us/`. A
Cloudflare Worker keeps that URL canonical while serving the static payload
from the Valen-controlled `valen-clients-cdn/masterflow-plumbing` namespace.
The prior `masterflowplumbing-cdn` bucket remains available as a rollback
snapshot and is not the active publish target.

This folder may later hold client-specific assets, tool notes, or hook briefs.
Do not add private workspace IDs, private routes, customer data, or publish
credentials here.
