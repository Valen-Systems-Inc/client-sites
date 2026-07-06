## Goal

Make the `client-sites` output layer reviewable as part of the Valen local acquisition engine.

This PR asks @CufeHaco to inspect whether the static client-site output is actually deployable, crawlable, source-aligned, and useful as proof that the SEO system works.

This is the sibling lane to the `client-site-tools` engine validation PR. `client-site-tools` should own the engine and generators. `client-sites` should own the public/static client output that can be previewed, deployed, indexed, and reviewed.

## Why this exists

The SEO engine is only real if its output becomes clean client-site code.

For Masterflow, the key failure mode is easy to see:

```text
old prototype page
-> generated SEO pages
-> client-sites static snapshot
-> live CDN/R2 site
```

Those layers can drift. When they drift, people preview the wrong thing, patch stale code, or claim the system works without proving the actual public site output.

This PR makes CufeHaco's task explicit: check the output layer, name the source/output contract, and identify what remains before this becomes a repeatable client delivery system.

## First proof case

Masterflow Plumbing.

Use:

```text
Clients/ArciniegaVenturesLLC/MasterflowPlumbing
```

This folder should be evaluated as the deployable static client output for the Masterflow local acquisition engine.

## Owner lane

```text
client-site-tools generated candidate
-> client-sites static client folder
-> root homepage
-> generated local/service routes
-> sitemap/robots/llms/admin files
-> media/assets
-> local preview
-> CDN publish boundary
-> live verification gap
```

## Required workflow

1. Inspect the Masterflow static folder and identify which files are source, generated output, proofs, or stale leftovers.
2. Compare the current root homepage with the generated subpages so the site does not mix incompatible design/copy generations.
3. Verify that `index.html`, local service routes, `sitemap.xml`, `robots.txt`, `llms.txt`, `LLM.txt`, and `/admin` agree on canonical domain and crawlable routes.
4. Verify that the public footer/maintenance credit is subtle, crawlable, and not visually dominant.
5. Verify that media/assets referenced by the pages exist locally and will survive deploy.
6. Verify that no stale prototype like `landing.tsx` is treated as the current public homepage without explicit source-of-truth documentation.
7. Identify what command or manifest should prove `client-site-tools` output was synced into `client-sites`.
8. Identify what local preview and crawl checks prove the static output before Cloudflare/R2 publish.
9. Identify what live checks prove deployment after publish.
10. Produce a remaining-work list for making this repeatable for the next client.

## Integration expectations

- Repo owner: `Valen-Systems-Inc/client-sites`.
- Engine repo: `Valen-Systems-Inc/client-site-tools`.
- First client output: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing`.
- Live domain: `masterflowplumbing.us`.
- Live-write boundary: Cloudflare/R2 publish must remain explicit and gated.
- Source boundary: generated static output should be traceable back to `client-site-tools`, not manually drift forever.

## Guardrails

- Do not publish this PR by itself.
- Do not mutate Cloudflare, R2, DNS, GSC, or live indexing from this PR.
- Do not hide stale source files by pretending they are current.
- Do not treat local static files as live proof.
- Do not remove client assets or generated pages unless the engine/output contract proves they are superseded.
- Do not add secrets or private client data.

## Success criteria for the first PR

- The Masterflow output folder has a clear source-of-truth map.
- Current homepage, generated routes, sitemap, robots, LLM files, and admin route are validated or gaps are listed.
- The stale/prototype vs current/static output boundary is explicit.
- Local preview proof is defined.
- CDN/live proof is defined but not performed without authorization.
- Remaining work is concrete enough to become follow-up issues or implementation PRs.

## Proof / checks to run or inspect

Example local checks:

```bash
python3 -m http.server 4188 --bind 0.0.0.0
curl -I http://127.0.0.1:4188/
curl -I http://127.0.0.1:4188/admin/
curl -s http://127.0.0.1:4188/ | rg "Emergency Plumber in Corona, CA|Created and maintained|masterflow-logo-20260704"
curl -s http://127.0.0.1:4188/admin/ | rg "Site Maintenance|valen-systems.com"
```

Use a browser screenshot when reviewing visual fit. Use a crawl after changes if routes/sitemap/assets are touched.

## Known remaining work to scrutinize

- Establish the exact sync contract from `client-site-tools` generated output into `client-sites`.
- Mark or retire stale prototype files that are no longer the public source of truth.
- Verify `/admin` exists if it is referenced by `sitemap.xml`, `llms.txt`, or footer navigation.
- Verify root homepage and subpages share enough brand, canonical, tracking, and maintenance structure.
- Verify generated pages are not silently missing assets.
- Verify live-publish proof is separate from local-preview proof.
- Define how future clients get the same folder structure, proof manifest, and preview/deploy checklist.

## Operating model

William owns client priority, live publishing, and whether the public page feels right.

@CufeHaco owns the output-layer review: is this folder deployable, traceable, crawlable, and reusable as a client delivery pattern.

Codex can implement follow-up file structure, manifests, preview checks, crawler checks, and sync automation once the output contract is clear.

## Reviewer focus

Be strict about source/output drift.

- Which file is the current homepage?
- Which file is stale prototype material?
- Which pages came from the engine?
- Which files are required for crawling and AIEO?
- Can the folder be served locally and match the intended public site?
- Can the folder be published without surprise?
- What needs to exist so future clients do not repeat this confusion?
