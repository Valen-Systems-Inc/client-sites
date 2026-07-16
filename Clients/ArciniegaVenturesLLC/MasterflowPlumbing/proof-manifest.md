# Masterflow Plumbing Proof Manifest

This manifest keeps the client artifact honest.

## Artifact

| Field | Value |
| --- | --- |
| Client owner folder | `Sites/Clients/ArciniegaVenturesLLC/MasterflowPlumbing/` |
| Wrapper file | `landing.tsx` |
| Static entry | `index.html` |
| Target R2 namespace | `valen-clients-cdn/masterflow-plumbing` |
| Public CDN base | `https://clients.valen-systems.com/masterflow-plumbing/` |
| Canonical domain | `https://masterflowplumbing.us/` |
| Business | Masterflow Plumbing |
| Artifact type | Canonical wrapper plus residential and commercial static site profiles |

## Current Proof

| Proof item | Status |
| --- | --- |
| Wrapper file exists in repo | Present. |
| Static entry exists in repo | Present. |
| Remote R2 namespace | Created: `valen-clients-cdn/masterflow-plumbing`. |
| Full mirror | Verified 2026-07-16: 2,120 objects and 188,943,220 bytes, with zero missing or mismatched objects. |
| Canonical routing | `masterflowplumbing.us` is served through `masterflow-site-proxy`; `.net` and `www` aliases redirect to canonical. |
| Rollback | The original `masterflowplumbing-cdn` bucket is preserved and was not deleted or detached during migration. |
| CORS and object metadata | Representative HTML, XML, JSON, and image objects returned correct MIME types without forced-download or incorrect gzip headers on 2026-07-16. |
| Wrapper compile proof | `landing.tsx` bundles with esbuild. |
| SEO handoff | Present: `seo-handoff-2026-06-23.md` captures the canonical `.us` decision, redirect priority, missing production sitemap, homepage title/H1 recommendation, media-performance findings, and first page-promotion queue. |
| SEO engine source | Present: `seo/` contains the local SEO engine, source data, generation scripts, and latest reports. Preview output remains intentionally separate from the reviewed root homepage. |
| Residential build proof | 432 generated pages passed all 15 guards on 2026-07-16. |
| Commercial build proof | 37 generated pages, 36 public URLs, six industry pages, eight guides, and no residential city matrix passed on 2026-07-16. |
| Forms proof | Request-service unit tests cover residential and commercial fields; reviews remain pending until explicit moderation. |
| Screenshot proof | Not attached in this repo. |
| Live URL proof | Final `mflow-v.1.0.6` route and form verification is recorded in the generator repository release reports. |
| Approval state | William explicitly requested the CDN move, residential/commercial split, publish, commit, and push. |
| Source/import note | This is the sanitized canonical wrapper/static mirror; generator and deployment evidence live in `client-site-tools`. |

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

Next proof to attach: the final `mflow-v.1.0.6` live route matrix and commercial
screenshots after the edge proxy is deployed.
