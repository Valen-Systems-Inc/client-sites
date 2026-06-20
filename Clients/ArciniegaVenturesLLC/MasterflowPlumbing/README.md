# Masterflow Plumbing

### This Directory is the home for Masterflow Plumbing and any related sites, assets, tools, specialized hooks, etc.

This folder is the sanitized home for Masterflow Plumbing artifacts under
Arciniega Ventures LLC.

Current files:

- `index.html`: static R2-ready landing page payload.
- `landing.tsx`: thin TypeScript/React host wrapper that boots the R2/CDN
  payload from `https://masterflowplumbing.net/`.
- `cdn-manifest.json`: target bucket/release metadata for the R2 publish lane.
- `r2-cors.json`: read-only browser CORS policy for the public R2 payload.
- `proof-manifest.md`: what proof is attached and what still needs evidence.

This folder may later hold client-specific assets, tool notes, or hook briefs.
Do not add private workspace IDs, private routes, customer data, or publish
credentials here.
