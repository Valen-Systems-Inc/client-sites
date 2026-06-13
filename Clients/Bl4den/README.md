# Bl4den

Static client site for Bl4den, based on the client-provided iPhone-style
reference site and modified for the Bl4den work order.

## Files

- `index.html`: copied static phone-site base modified for Bl4den.
- `landing.tsx`: thin TypeScript/React host wrapper, modeled after the
  ValenCore runtime wrapper lane. It fetches the R2/CDN-hosted HTML, rewrites
  relative assets to the CDN base, installs the static DOM, and runs the page
  scripts from the host surface.
- `cdn-manifest.json`: current R2 bucket, CDN base, and release marker.

## Local Preview

From this directory:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173/`.

## CDN

Current R2 bucket: `bl4den-cdn`

Cloudflare-side R2 hosting is prepared for `bl4den.com`, but public DNS cutover
is still pending. This directory does not contain a Cloudflare TypeScript
Worker.

Target CDN entry after DNS cutover:
`https://bl4den.com/index.html?release=bl4den-prom-night-r2-20260613`

## Notes

- Instagram points to `https://www.instagram.com/1bladen/`.
- YouTube Music, Spotify, SoundCloud, Apple Music, and TikTok currently use
  search URLs for `Bl4den` until final artist profile URLs are provided.
- Mail uses `booking@bl4den.com` as the prefilled fan email placeholder.
- Camera access requires a browser context that allows `getUserMedia`; localhost
  works for local testing in modern browsers.
- Copied third-party checkout credentials from the reference page were scrubbed.
