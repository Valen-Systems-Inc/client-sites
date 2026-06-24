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
