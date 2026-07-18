# Masterflow SEO Handoff - 2026-06-23

This note captures the current SEO/domain/performance state before execution
moves into the prioritized fix list.

## Canonical Site Decision

Use `https://masterflowplumbing.us/` as the canonical public site.

Current live behavior observed on 2026-06-23:

- `https://masterflowplumbing.us/` returns the site directly.
- `https://masterflowplumbing.net/` returns the same site directly.
- `.net` HTML points its canonical URL and Open Graph URL to `.us`.
- `http://masterflowplumbing.us/` returns the site directly instead of
  redirecting to HTTPS.
- `http://masterflowplumbing.net/` returns the site directly instead of
  redirecting to `.us` HTTPS.
- `www.masterflowplumbing.net` returns the site directly.
- `www.masterflowplumbing.us` had no DNS record in the Cloudflare read.

Recommended redirect target for all aliases:

```text
https://masterflowplumbing.us/$1
```

Redirect sources to collapse:

- `http://masterflowplumbing.us/*`
- `http://masterflowplumbing.net/*`
- `https://masterflowplumbing.net/*`
- `http://www.masterflowplumbing.net/*`
- `https://www.masterflowplumbing.net/*`
- optionally `www.masterflowplumbing.us/*` after DNS/custom-domain coverage exists

## Cloudflare Proof

Cloudflare account visible through the plugin:

- Account: `Masterflowplumbing2024@gmail.com's Account`
- Account ID: `f3c8cc51d06b88d2dc0f3ff25f5aeacf`

Zones visible:

- `masterflowplumbing.net`, zone `df58a12182116f0ea7b23412c34a3ada`
- `masterflowplumbing.us`, zone `4d2cffb83f7c8944fb8f23cb44d390fe`

R2 bucket visible:

- `masterflowplumbing-cdn`

DNS records read on 2026-06-23:

- `masterflowplumbing.net` CNAME -> `public.r2.dev`, proxied
- `www.masterflowplumbing.net` CNAME -> `public.r2.dev`, proxied
- `masterflowplumbing.us` CNAME -> `public.r2.dev`, proxied
- no `www.masterflowplumbing.us` record observed

Cloudflare API blocker:

- zone and DNS reads worked through the plugin
- Rulesets read failed with `request is not authorized`
- Page Rules read failed with `9109: Unauthorized to access requested resource`

Redirect implementation needs either dashboard access or a Cloudflare token/app
permission that can edit zone Rulesets/Page Rules.

## Sitemap And Robots

Live state:

- `/robots.txt` exists and allows normal search crawling.
- `/sitemap.xml` returns a Cloudflare/R2 404 page.
- `/sitemap.html` exists and links the human sitemap.

Do not submit the preview sitemap as production. The local
`seo-preview/robots.txt` intentionally blocks crawling with `Disallow: /`, and
its sitemap points at `/seo-preview/` URLs.

Production sitemap should initially include only canonical, live, indexable URLs,
for example:

- `https://masterflowplumbing.us/`
- `https://masterflowplumbing.us/sitemap.html`
- `https://masterflowplumbing.us/privacy.html`
- `https://masterflowplumbing.us/terms.html`

Add service/location URLs only after they serve real root-path pages and are
approved to be indexable.

## Homepage SEO Copy

Current homepage title:

```text
Masterflow Plumbing | 24/7 Emergency Plumbing
```

Recommended homepage title:

```text
Emergency Plumber in Corona, CA | Masterflow Plumbing
```

Current H1:

```text
24/7 Emergency Plumbing & Drain Service
```

Recommended H1:

```text
24/7 Emergency Plumber in Corona & Riverside County
```

Rationale: make the primary page clearly local and service-specific instead of
generic Southern California plumbing copy.

## Performance Findings

Lighthouse run on 2026-06-23:

- SEO: 100 basic Lighthouse score
- Performance: 69
- Accessibility: 95
- Best Practices: 100
- total network payload: about 13 MB
- Largest Contentful Paint: about 12.3 seconds

Main payload issues from the current static site:

- `media/img-1070.mp4` is about 9.6 MB.
- `media/80220303036-84fc15af-5fea-4bf1-ac12-f732cbea3924.jpg` is about 1.6 MB.
- `media/img-1619.jpg` is about 1.5 MB.
- `media/img-1059.mp4` is about 1.4 MB.
- several JPGs are about 1.0-1.2 MB.
- current homepage has 18 images without explicit `width` or `height`.
- current homepage has 11 eager-loaded images and no lazy-loaded images.

Recommended media work:

- keep hero media optimized and prioritized
- convert below-the-fold JPGs to smaller responsive assets or WebP/AVIF where
  deploy support is clear
- set `loading="lazy"` for below-the-fold images
- set explicit width/height on images to reduce layout and LCP risk
- avoid autoplaying large non-critical videos above the fold unless compressed
  heavily

## Generated SEO Engine State

A local client-sites checkout contains a generated Masterflow SEO engine that is
not present in GitHub at the time of this handoff.

Observed local engine state:

- source folder: `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/seo/`
- generated preview folder:
  `Clients/ArciniegaVenturesLLC/MasterflowPlumbing/seo-preview/`
- build report: `seo/reports/build-report.json`
- microsite queue: `seo/reports/microsite-deployment-queue.csv` and `.json`

Local build-report summary:

- all guards passed
- `indexable: false`
- 275 generated pages
- 24 city hub pages
- 10 service hub pages
- 240 city-service pages
- preview pages remain `noindex,nofollow`

Important: this means the page strategy is partially staged already. The next
step is not to invent the pages from scratch; it is to promote selected
generated pages to real root URLs, verify them, then make them indexable.

## First Pages To Promote

Recommended first service pages:

- `southern-california-emergency-plumber`
- `southern-california-drain-cleaning`
- `southern-california-water-heater-repair`
- `southern-california-sewer-line-repair`
- `southern-california-leak-detection`

Recommended first location pages:

- `corona-plumber`
- `norco-plumber`
- `riverside-plumber`
- `murrieta-plumber`
- `rancho-cucamonga-plumber`

Recommended high-intent city-service pages after the first hub pages prove clean:

- `corona-emergency-plumber`
- `corona-drain-cleaning`
- `norco-emergency-plumber`
- `riverside-emergency-plumber`
- `rancho-cucamonga-drain-cleaning`

## Google Business Profile And Review Flow

This is account/listing work, not repository work.

Recommended local SEO operations:

- use `https://masterflowplumbing.us/` as the website everywhere
- keep business name, phone, and service area consistent across Google, Yelp,
  Apple Maps, Bing Places, Nextdoor, Angi, BBB, and local directories
- upload real job photos regularly
- ask every happy customer for a Google review
- keep CSLB license and direct phone number visible on site and profiles

## Execution Order

1. Make GitHub contain this handoff plus the missing SEO source/report state.
2. Fix Cloudflare redirect permissions or apply redirects through dashboard.
3. Add production `sitemap.xml` and reference it from `robots.txt`.
4. Optimize homepage media and image loading.
5. Update homepage title/H1 to the Corona emergency-plumber positioning.
6. Promote the first 5 service pages and first 5 location pages from generated
   preview to real root URLs.
7. Submit the production sitemap in Google Search Console after redirects and
   production sitemap are live.
