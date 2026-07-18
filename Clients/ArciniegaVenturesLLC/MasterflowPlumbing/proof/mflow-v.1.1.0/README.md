# Masterflow v1.1.0 proof bundle

Release `mflow-v.1.1.0` makes the corrected sitemap and accreditation system
the current major/minor Masterflow baseline. The canonical generator and
deployment source now lives in `Valen-Systems-Inc/client-site-tools`; this
repository remains the sanitized static artifact mirror and public proof lane.

## Controlled CDN publication

| Surface | Controlled key prefix | Published objects |
| --- | --- | ---: |
| Residential site | `masterflow-plumbing/` | 1,304 |
| Commercial site | `masterflow-plumbing/commercial/` | 116 |
| Residential sitemap control | `masterflow-plumbing/_control/sitemaps/` | 14 |
| Commercial sitemap control | `masterflow-plumbing/_control/sitemaps/commercial/` | 15 |

No Worker code changed in this release. The canonical proxy continues to serve
`.us` pages from the Valen-controlled site namespaces and sitemap XML, XSL,
logo, font, and font notice from the dedicated sitemap-control prefixes.

## Live verification

- Residential: 494 artifacts passed, including 432 pages, 12 aliases, 18
  static files, 31 media objects, and the release manifest.
- Commercial: 97 artifacts passed, including 37 pages, 12 aliases, 16 static
  files, 31 media objects, and the release manifest.
- Both full route matrices report `pass: true` with zero failures.
- Production `/admin/` and `/commercial/admin/` return `index,follow`, one
  visible accreditation statement, and a link to
  `https://www.valen-systems.com/`.
- Each live admin sitemap contains exactly one canonical accreditation URL and
  is listed by its parent sitemap index.
- Sitemap XML returns `application/xml` from the `sitemap` content silo, with
  canonical `<loc>` values, `<lastmod>` metadata, and the Valen XSL.
- Both public release JSON routes identify `mflow-v.1.1.0`.

## Included evidence

- Four CDN release manifests for the two site and two sitemap-control prefixes.
- Two full live verification reports with zero failures.
- `visual-proof-mflow-v.1.1.0.json`, the final eight-route
  `live-browser-proof-mflow-v.1.1.0.json`, and the corresponding live browser
  screenshots. The sitemap and admin presentation captures remain in the same
  release folder.
- The generic Valen sitemap starter is tracked in `Templates/Sitemaps/` here
  and in `Valen-Systems-Inc/valen-systems-tools`.

Search Console submission and indexing remain external operator steps. No
IndexNow submission was made automatically by this release.
