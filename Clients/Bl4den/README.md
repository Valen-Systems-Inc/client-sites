# Bladen

Static client site for Bladen / `bl4den.com`, based on the client-provided
iPhone-style reference site and modified for the Bladen work order.

## Files

- `index.html`: copied static phone-site base modified for Bladen.
- `landing.tsx`: thin TypeScript/React host wrapper, modeled after the
  ValenCore runtime wrapper lane. It fetches the R2/CDN-hosted HTML, rewrites
  relative assets to the CDN base, installs the static DOM, and runs the page
  scripts from the host surface.
- `cdn-manifest.json`: current R2 bucket, CDN base, and release marker.
- `customer-work-order.md`: PR4-style request ledger, implementation status,
  proof notes, guardrails, and remaining external gaps.
- `prom-night-bg.jpg`: current lock/home background art supplied by the client.
- `icons/musically.jpg`: current musical.ly icon supplied by the client.

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
- Spotify points to `https://open.spotify.com/artist/5yy8AHJKcE24IEgd4wvj3H?si=N8ZSKqDCQlaYhUoksweOfA`.
- Apple Music points to `https://music.apple.com/us/artist/bladen/6779022898`.
- musical.ly points to `https://www.tiktok.com/@1bladen?_r=1&_t=ZP-97AcM02pYVC`.
- YouTube Music and SoundCloud still use search URLs until final artist profile
  URLs are provided.
- Mail opens `booking@bl4den.com` without subject/body autofill.
- Camera access requires a browser context that allows `getUserMedia`; localhost
  works for local testing in modern browsers.
- Copied third-party checkout credentials from the reference page were scrubbed.
