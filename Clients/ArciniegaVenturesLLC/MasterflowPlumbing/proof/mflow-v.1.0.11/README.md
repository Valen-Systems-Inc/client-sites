# Masterflow v1.0.11 proof bundle

Release `mflow-v.1.0.11` reduces each public admin route to a single linked
Valen Systems accreditation and makes the route indexable. The residential and
commercial admin sitemap families now each contain exactly one accreditation
URL. Private generator routes remain in the JSON page inventory.

## Controlled CDN publication

| Surface | Controlled key prefix | Published objects |
| --- | --- | ---: |
| Residential site | `masterflow-plumbing/` | 1,304 |
| Commercial site | `masterflow-plumbing/commercial/` | 116 |
| Residential sitemap control | `masterflow-plumbing/_control/sitemaps/` | 14 |
| Commercial sitemap control | `masterflow-plumbing/_control/sitemaps/commercial/` | 15 |

No Worker code changed in this release. The existing canonical proxy still
serves `.us` pages from the Valen-controlled site namespaces and sitemap XML,
XSL, logo, font, and font notice from the dedicated sitemap-control prefixes.

## Live verification

- Residential: 489 artifacts passed, including 432 pages, 12 aliases, 18
  static files, 26 media objects, and the release manifest.
- Commercial: 92 artifacts passed, including 37 pages, 12 aliases, 16 static
  files, 26 media objects, and the release manifest.
- Production `/admin/` and `/commercial/admin/` return `index,follow`, one
  visible accreditation statement, and a link to `https://www.valen-systems.com/`.
- Neither live admin page contains the removed control-plane, content-origin,
  or developer-route copy.
- Each live admin sitemap contains exactly one canonical accreditation URL and
  is listed in its parent sitemap index.
- Sitemap XML remains `application/xml` with the standard sitemap namespace,
  canonical `<loc>` values, and `<lastmod>` metadata.
- The unchanged XSL presentation preserves the Valen logo and Squarish Sans
  without adding Valen URLs to the sitemap URL inventory.

## Included evidence

- Four CDN release manifests for the two site and two sitemap-control prefixes.
- Two full live byte-parity reports with `pass: true` and zero failures.
- `visual-proof-mflow-v.1.0.11.json` plus live desktop/mobile admin captures
  under `seo/reports/screenshots/mflow-v.1.0.11/`.
- Repo-wide reusable sitemap starter under `Templates/Sitemaps/`, validated by
  `xmllint` and `xsltproc`.

The release adds the accreditation URL to each admin sitemap family. Search
Console submission remains an external operator step; no IndexNow submission
was made automatically.
