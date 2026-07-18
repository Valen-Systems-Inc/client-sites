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
The `.us` apex and `www` records are originless Cloudflare placeholders, so the
Worker has no legacy website origin behind it. The prior
`masterflowplumbing-cdn` bucket is empty and has no custom domains. Its exact
2,120-object cutover archive is preserved under
`valen-clients-cdn/masterflow-plumbing/_rollback/masterflowplumbing-cdn-2026-07-16`.
`masterflowplumbing.net` remains client-owned but is decommissioned as a web
surface: no web DNS, Worker/API routes, redirect, or R2 custom-domain binding.

Release `mflow-v.1.0.10` adds one Valen Systems XSL presentation to every
residential and commercial sitemap family and gives both noindex `/admin/`
routes the matching Valen control-record theme. Squarish Sans, the Valen logo,
and the font notice live with the sitemap XML only under the controlled
`_control/sitemaps/` namespace. The XML namespaces, canonical `<loc>` values,
`lastmod` values, family counts, and crawler MIME types remain unchanged.

The original CDN migration, domain-cutover, and rollback evidence remains under
`proof/mflow-v.1.0.7/`; release-specific `mflow-v.1.0.10` proof is stored beside
it. Final byte-parity verification covers 489 residential artifacts and 92
commercial artifacts. Active sitemap XML and presentation assets, plus the
IndexNow verification key, live only under Valen `_control/` namespaces; public
`.us` routes resolve there through the canonical Worker.

Production HTML is tracked at this directory root and under `commercial/`.
Do not add a second `seo-production/` mirror: it creates an extra route surface
and previously accumulated numbered File Provider conflict copies.

This folder may later hold client-specific assets, tool notes, or hook briefs.
Do not add private workspace IDs, private routes, customer data, or publish
credentials here.
