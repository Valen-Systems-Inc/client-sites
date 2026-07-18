# Masterflow Content Control Plane

`masterflowplumbing.us` is the canonical customer hostname. It does not own or
store the static site payload. The `masterflow-site-proxy` Worker resolves
residential and commercial routes from the Valen-controlled
`valen-clients-cdn/masterflow-plumbing/` namespace.

## Active Storage

| Surface | Valen namespace |
| --- | --- |
| Residential pages | `masterflow-plumbing/` |
| Commercial pages | `masterflow-plumbing/commercial/` |
| Sitemap XML and presentation assets | `masterflow-plumbing/_control/sitemaps/` |
| IndexNow key | `masterflow-plumbing/_control/indexnow/` |
| Rollback archive | `masterflow-plumbing/_rollback/masterflowplumbing-cdn-2026-07-16/` |

The former `masterflowplumbing-cdn` bucket is empty. `masterflowplumbing.net`
has no web DNS or content route. Forms, service requests, moderated reviews,
database storage, and email delivery remain on the route-specific Masterflow
API Worker.

## Source Split

This repository owns the canonical wrapper, static artifacts, generator,
control code, deployment scripts, and release proof. Private deployment
configuration and operational key material remain in ignored local files or
the deployment environment. Do not add the IndexNow key, Cloudflare
credentials, customer submissions, or other private values to this repository.
The private config path is explicitly ignored at the repository root.

Ordinary production deploys exclude sitemap XML, the shared XSL presentation,
the Valen logo, Squarish Sans, and its license notice. Dedicated sitemap
commands publish those files only to the `_control/sitemaps/` prefix. The
canonical Worker exposes them on `.us` without copying them into the ordinary
site namespace. IndexNow planning is dry-run by default and must never become
an implicit build or deploy step.
