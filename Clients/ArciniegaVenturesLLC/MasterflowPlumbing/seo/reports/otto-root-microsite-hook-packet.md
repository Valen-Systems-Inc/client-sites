# Otto Packet: Masterflow Root-Path Microsite Bind

Server hook task 1: `masterflow-bind-root-microsite`

Goal:
Make one verified Masterflow queue item serve as a real root-path microsite at `https://masterflowplumbing.us/{root_slug}` so Codex can batch the remaining hyper-localized assets.

Context:
- Workspace UUID: `81f9a0d7-df5b-43e7-bff9-b1a7d6c73ed1`
- Workspace numeric id: `182567`
- Current private control surface hook: `masterflow-seo-engine`
- Current deploy queue source: `seo/reports/microsite-deployment-queue.json`
- First proof item to bind: `corona-plumber`
- Target URL: `https://masterflowplumbing.us/corona-plumber`
- Source preview URL: `https://masterflowplumbing.us/seo-preview/locations/corona/`
- The current generated page already passes local SEO gates: noindex preview, phone present, license present, structured data, and word count.
- ValenCore-Develop docs say the root-path microsite lane is platform `apps` + `microsites`: insert/compile app bundle, bind `microsites.slug -> app_id`, then verify the slug shell exposes `__APP_ID__` and `/api/apps/{app_id}/bundle.js` returns `200`.

Build:
- Create or modify exactly one server hook: `masterflow-bind-root-microsite`.
- Inputs:
  ```json
  {
    "client_slug": "masterflow-plumbing",
    "root_slug": "corona-plumber",
    "target_domain": "https://masterflowplumbing.us",
    "source_preview_path": "/seo-preview/locations/corona/",
    "title": "Plumber in Corona, CA | Masterflow",
    "html_source": "<optional compiled/static page source or source URL if hook can fetch it>",
    "indexable": false,
    "approval_token": "william-approved-preview-only"
  }
  ```
- Output:
  ```json
  {
    "success": true,
    "root_slug": "corona-plumber",
    "target_url": "https://masterflowplumbing.us/corona-plumber",
    "app_id": "app_...",
    "microsite_id": "...",
    "bundle_url": "https://masterflowplumbing.us/api/apps/app_.../bundle.js",
    "indexable": false,
    "proof": {
      "shell_status": 200,
      "bundle_status": 200,
      "app_id_visible": true,
      "noindex_present": true
    }
  }
  ```
- Persistence/read source:
  - Platform `apps` row for compiled/published source and bundle.
  - Platform `microsites` row where `slug = corona-plumber`, `workspace_id = 182567` or workspace UUID as platform expects, `app_id` points to the compiled app, and `is_active = true`.

Acceptance:
1. Show the hook request and response for `corona-plumber`.
2. Prove `https://masterflowplumbing.us/corona-plumber` returns HTTP `200`.
3. Prove the returned shell contains the expected `__APP_ID__`.
4. Prove `https://masterflowplumbing.us/api/apps/{app_id}/bundle.js` returns HTTP `200`.
5. Prove the page remains noindex until William separately approves indexable publish.
6. Return compact evidence only: hook name, request sample, response sample, target URL, app id, microsite id, shell status, bundle status.

Exclusions:
- Do not create ads.
- Do not send outreach.
- Do not change DNS.
- Do not change contacts, payments, or customer data beyond the platform app/microsite rows required for this proof slug.
- Do not batch all 72 until the one-slug proof is accepted.
- No runtime edits.
- No public indexable publish yet.
