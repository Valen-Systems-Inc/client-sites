# Masterflow Plumbing Proof Manifest

This manifest keeps the client artifact honest.

## Artifact

| Field | Value |
| --- | --- |
| Client owner folder | `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/` |
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
| Rollback archive | Verified 2026-07-16: 2,120 objects and 188,943,220 bytes in the Valen rollback namespace, with zero missing or mismatched objects. |
| Canonical routing | `masterflowplumbing.us` is served through `masterflow-site-proxy` from `clients.valen-systems.com`; apex and `www` use originless proxied DNS. |
| Legacy source bucket | `masterflowplumbing-cdn` is empty and has zero custom-domain bindings after the verified archive/cutover. |
| `.net` web surface | Decommissioned: no apex/`www` web DNS, Worker/API routes, redirect, public resolution, or R2 binding. Domain registration and verification records remain client-owned. |
| CORS and object metadata | Representative HTML, XML, JSON, and image objects returned correct MIME types without forced-download or incorrect gzip headers on 2026-07-16. |
| Wrapper compile proof | `landing.tsx` bundles with esbuild. |
| SEO handoff | Present: `seo-handoff-2026-06-23.md` captures the canonical `.us` decision, redirect priority, missing production sitemap, homepage title/H1 recommendation, media-performance findings, and first page-promotion queue. |
| SEO engine source | Present: `seo/` contains the local SEO engine, source data, generation scripts, and latest reports. Preview output remains intentionally separate from the reviewed root homepage. |
| Residential build proof | 432 generated pages passed all 15 guards on 2026-07-16. |
| Commercial build proof | 37 generated pages, 37 public URLs, six industry pages, eight guides, and no residential city matrix passed on 2026-07-18. |
| Brand proof | Current source, generated output, and live HTML use `Masterflow Plumbing`; the retired `& Rooter` suffix is retained only in negative regression fixtures and historical third-party evidence. |
| Forms proof | Request-service unit tests cover residential and commercial fields. Live health checks report database storage for reviews and database plus email delivery for service requests; reviews remain private until explicit moderation. |
| Admin accreditation proof | Production `/admin/` and `/commercial/admin/` are indexable and contain only a linked Valen Systems accreditation; each admin sitemap contains exactly one matching public URL. Preview builds remain noindex. |
| Sitemap template proof | `Templates/Sitemaps/` provides the repo-wide Valen-themed XSL, examples, assets, and crawler-safety contract for future client sitemaps. |
| Screenshot proof | Release-specific browser captures and hashes are attached under `proof/mflow-v.1.1.0/`; historical page captures remain under the earlier proof bundles. |
| Live URL proof | `mflow-v.1.1.0` passes 494 residential artifacts and 97 commercial artifacts from the Valen-controlled CDN namespace with zero failures. |
| Sitemap control proof | Residential and commercial sitemap XML, XSL, Valen logo, Squarish Sans, and the font notice live under `masterflow-plumbing/_control/sitemaps/`; the canonical Worker reports the `sitemap` content silo for those public routes. |
| IndexNow proof | The repo-local tool plans 137 canonical URLs, enforces the 10,000-URL protocol ceiling, validates host/key rules, and remains dry-run unless `--submit` is explicit. No submission was made in this release. |
| Approval state | William explicitly requested the CDN move, residential/commercial split, publish, commit, and push. |
| Source/import note | `Valen-Systems-Inc/client-site-tools` owns the canonical generator, deployment, and verification source. `Valen-Systems-Inc/client-sites` owns the sanitized wrapper, static artifact mirror, and public release evidence. |

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

The attached `proof/mflow-v.1.1.0/` bundle contains the current CDN release
manifests, live route matrices, sitemap-presentation proof, and browser-capture
hashes. The unchanged page artifacts retain the desktop/mobile visual proof
under `proof/mflow-v.1.0.8/`. The original exact rollback
verification and domain decommission report remain under
`proof/mflow-v.1.0.7/` because those are cutover records, not per-release files.
