# Masterflow v1.0.10 proof bundle

Release `mflow-v.1.0.10` adds the Valen Systems sitemap presentation and
matching noindex admin surface without changing the sitemap URL families or
their crawler-facing XML semantics.

## Controlled CDN publication

| Surface | Controlled key prefix | Published objects |
| --- | --- | ---: |
| Residential site | `masterflow-plumbing/` | 1,304 |
| Commercial site | `masterflow-plumbing/commercial/` | 116 |
| Residential sitemap control | `masterflow-plumbing/_control/sitemaps/` | 14 |
| Commercial sitemap control | `masterflow-plumbing/_control/sitemaps/commercial/` | 15 |

The canonical domain is served through Cloudflare Worker version
`18cc57cf-8eeb-460a-926b-96499fab1683`. Sitemap XML, XSL, logo, font, and font
notice are fetched from the dedicated sitemap control prefixes rather than the
ordinary site prefixes.

## Live verification

- Residential: 489 artifacts passed, including 432 pages, 12 aliases, 18
  static files, 26 media objects, and the release manifest.
- Commercial: 92 artifacts passed, including 37 pages, 12 aliases, 16 static
  files, 26 media objects, and the release manifest.
- Both live verification reports have `pass: true` and zero failures.
- The sitemap XML remains `application/xml` with the standard sitemap
  namespace, canonical `<loc>` values, and `<lastmod>` metadata.
- The XSL changes only the human browser presentation. It does not add Valen
  URLs to the sitemap URL inventory.
- `/admin/` is a noindex operational surface with factual Valen Systems
  attribution.

## Included evidence

- Four CDN release manifests for the two site and two sitemap-control prefixes.
- Two full live byte-parity reports.
- `visual-proof-mflow-v.1.0.10.json` plus desktop/mobile captures under
  `screenshots/mflow-v.1.0.10/`.

The sitemap URLs did not change, so this release did not require a new IndexNow
submission or replacement Search Console sitemap entries.
