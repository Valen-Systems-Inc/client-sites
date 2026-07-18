# client-sites

Standalone OSS home for client-facing site artifacts that were previously kept
under `Sites/Clients/` in `ValenCore-Develop`.

## Layout

```text
Clients/
├── Bl4den/
│   ├── README.md
│   └── index.html
└── ArciniegaVenturesLLC/
    └── MasterflowPlumbing/
        ├── README.md
        ├── cdn-manifest.json
        ├── index.html
        ├── landing.tsx
        └── proof-manifest.md
Templates/
└── Sitemaps/
    ├── README.md
    ├── valen-sitemap.xsl
    ├── sitemap-index.example.xml
    ├── urlset.example.xml
    └── sitemap-assets/
```

## Notes

- Masterflow's current artifact baseline is `mflow-v.1.1.0`. Canonical
  generation, deployment, and verification source lives in
  `Valen-Systems-Inc/client-site-tools`; this repository carries the sanitized
  wrapper, static output, and release proof.
- The source files here are preserved from the sanitized client-artifact section
  of the internal developer repo.
- Workspace IDs, app IDs, unpublished routes, private media, and platform
  configuration should remain sanitized before any future publication.
- `Templates/Sitemaps/` is the basic crawler-safe Valen sitemap presentation
  for future client sites. Copy it into a client generator, set the client name,
  and preserve the documented XML namespace, canonical URL, `lastmod`, MIME,
  asset-license, and controlled-CDN checks.
