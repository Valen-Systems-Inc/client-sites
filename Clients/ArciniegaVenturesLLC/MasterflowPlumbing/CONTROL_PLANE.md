# Masterflow Content Control Plane

This runbook keeps Masterflow website content and search-control artifacts in
Valen-owned infrastructure while preserving `masterflowplumbing.us` as the
canonical customer-facing hostname.

## Ownership

| Surface | Storage or runtime owner | Public behavior |
| --- | --- | --- |
| Residential site | `valen-clients-cdn/masterflow-plumbing/` | `.us` Worker proxy |
| Commercial site | `valen-clients-cdn/masterflow-plumbing/commercial/` | `.us/commercial/` Worker proxy |
| Sitemap XML and presentation | `valen-clients-cdn/masterflow-plumbing/_control/sitemaps/` | `.us` Worker control route |
| IndexNow key | `valen-clients-cdn/masterflow-plumbing/_control/indexnow/` | `.us/<key>.txt` Worker control route |
| Forms and moderated reviews | Masterflow D1/email Worker | `/api/*`; intentionally retained |
| Legacy site bucket | `masterflowplumbing-cdn` | Empty; never a publish target |
| `.net` | None | No web DNS or content route |

The canonical hostname is not the storage authority. The
`masterflow-site-proxy` Worker resolves public routes to the Valen CDN at
request time.

## Public Accreditation Boundary

Residential `/admin/` and commercial `/commercial/admin/` are public,
indexable accreditation pages. Each page contains only the Masterflow name and
a linked statement that the website was created and is maintained by Valen
Systems. They are not operational dashboards or places to expose storage,
routing, deployment, or client-control details.

Each admin sitemap contains only its matching accreditation URL. Noindex
generator routes remain in the JSON page inventory and never use the public
admin sitemap as a catch-all.

## Source Split

`Valen-Systems-Inc/client-site-tools` owns the canonical generator, control
code, deployment scripts, and live verification reports.
`Valen-Systems-Inc/client-sites` owns the sanitized wrapper, static artifact
mirror, and public release proof. `Valen-Systems-Inc/valen-systems-tools` owns
the reusable `Templates/Sitemaps/` starter and client integration profiles.

Private deployment configuration and operational key material remain in
ignored local files or the deployment environment. Do not commit the IndexNow
key, Cloudflare credentials, customer submissions, or other private values.

## Build And Test

```bash
npm ci
npm run seo:build-production
npm run seo:build-commercial-production
npm run seo:test
npm run seo:test-commercial
npm run site-api:test
npm run control-plane:test
npm run seo:indexnow:plan
```

`seo:indexnow:plan` is dry-run only. It reads both generated sitemap indexes,
deduplicates canonical `.us` URLs, rejects cross-host or non-HTTPS URLs, and
refuses more than 10,000 URLs.

## Publish Order

```bash
npm run seo:deploy-production:media
MASTERFLOW_CDN_VERSION=mflow-v.1.1.0 npm run seo:deploy-production
MASTERFLOW_CDN_VERSION=mflow-v.1.1.0 npm run seo:deploy-commercial-production
MASTERFLOW_CDN_VERSION=mflow-v.1.1.0 npm run seo:deploy-production:sitemaps
MASTERFLOW_CDN_VERSION=mflow-v.1.1.0 npm run seo:deploy-commercial-production:sitemaps
npm run seo:indexnow:key:deploy
```

The shared-media command publishes `media/` once at the common residential and
commercial asset root. It does not write a release manifest, so adding a font or
image cannot silently disappear behind the normal `--skip-media` release flags.

The two normal production commands carry `--exclude-sitemaps`. Only the two
dedicated sitemap commands can write sitemap XML, XSL, the Valen logo,
Squarish Sans, and the font notice. Their targets are Valen control prefixes.
Deploy the canonical Worker only when its code or route configuration changed.

If only release provenance needs correction, append `-- --manifest-only` to
the matching deploy command. This replaces only the release manifest and its
report object, preserves the full release object counts, and normalizes local
clone remotes to the canonical GitHub source URL.

## Legacy Bucket Guard

The rollback archive must verify before deletion is allowed:

```bash
npm run seo:archive-source-cdn:verify
npm run seo:legacy-cdn:plan-purge
npm run seo:legacy-cdn:purge
```

The destructive command requires the literal confirmation
`EMPTY-masterflowplumbing-cdn`. It compares the live source inventory against
the Valen rollback archive before deleting anything. If the source is already
empty, it verifies the retained archive against the recorded byte-for-byte
migration proof.

## IndexNow

The private config is `seo/config/indexnow.json`. The public key body is never
stored in `client-sites`; `seo:indexnow:key:deploy` materializes it into the
Valen R2 control prefix.

Create a plan from both residential and commercial sitemap families:

```bash
npm run seo:indexnow:plan
```

Plan selected changed or deleted URLs:

```bash
node seo/engine/indexnow.mjs \
  --url=https://masterflowplumbing.us/example/ \
  --url=https://masterflowplumbing.us/removed-page/
```

Plan from a newline-delimited file:

```bash
node seo/engine/indexnow.mjs --urls-file=/absolute/path/changed-urls.txt
```

Submit only after the key route and target URL set have been reviewed:

```bash
npm run seo:indexnow:submit
```

Submission is never part of a build or deploy script. The tool verifies the
root key file before POSTing, accepts only HTTP 200 or 202, and writes an audit
report without exposing the key in the payload field.

Protocol references:

- https://www.indexnow.org/documentation
- https://www.indexnow.org/faq
- https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/delete
