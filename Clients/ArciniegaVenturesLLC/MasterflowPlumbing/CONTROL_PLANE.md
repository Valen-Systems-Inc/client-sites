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
| Sitemap XML | `masterflow-plumbing/_control/sitemaps/` |
| IndexNow key | `masterflow-plumbing/_control/indexnow/` |
| Rollback archive | `masterflow-plumbing/_rollback/masterflowplumbing-cdn-2026-07-16/` |

The former `masterflowplumbing-cdn` bucket is empty. `masterflowplumbing.net`
has no web DNS or content route. Forms, service requests, moderated reviews,
database storage, and email delivery remain on the route-specific Masterflow
API Worker.

## Source Split

This repository owns the canonical wrapper, static artifacts, mirrored control
code, and release proof. `Valen-Systems-Inc/client-site-tools` owns the private
deployment configuration and operational key material. Do not add the IndexNow
key, Cloudflare credentials, customer submissions, or other private values to
this repository. The private config path is explicitly ignored at the repository
root.

Ordinary production deploys exclude sitemap XML. Dedicated sitemap commands
publish only to the `_control/sitemaps/` prefix. IndexNow planning is dry-run by
default and must never become an implicit build or deploy step.
