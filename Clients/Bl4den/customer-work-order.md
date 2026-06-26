# Bladen Customer Work Order

## Goal

Build and maintain a 2013 iPhone / iOS 7-style artist link site for Bladen
using the client-provided reference-site structure as the base.

Site identity:

- Public artist name in copy: `Bladen`
- Site/domain brand: `bl4den.com`
- Instagram: `@1bladen`

## Why This Exists

The site acts like a fake old iPhone home screen where each app icon is an
artist action: stream music, open socials, read release notes, use the camera,
or email the artist. The page should feel close to the supplied reference
without being a one-for-one copy.

## First Proof Case

Reference page supplied by the client:

```text
https://myspacemark.net/?utm_source=ig&utm_medium=social&utm_content=link_in_bio
```

Local client-site artifact:

```text
Clients/Bl4den/index.html
```

## Required Workflow

1. Preserve the copied iPhone-style static page structure instead of rebuilding
   the interface from scratch.
2. Apply requested client changes directly to the static artifact and nearby
   assets.
3. Keep app icon clicks mapped to their artist destinations.
4. Track each client request, implementation state, evidence, and remaining
   external dependency in this file.
5. Keep domain/DNS work separate from page-content changes unless William
   explicitly asks for live domain changes.

## Request Ledger

| Request | Status | Implementation / note |
| --- | --- | --- |
| YouTube app connects to artist's YouTube Music page. | Pending exact link | Home-screen YouTube currently uses a YouTube Music search URL for `Bladen` until the artist URL is supplied. |
| Spotify app connects to artist's Spotify page. | Implemented | Home-screen Spotify points to `https://open.spotify.com/artist/5yy8AHJKcE24IEgd4wvj3H?si=N8ZSKqDCQlaYhUoksweOfA`. |
| SoundCloud app connects to artist's SoundCloud page. | Pending exact link | Home-screen SoundCloud currently uses a SoundCloud search URL for `bl4den` until the artist URL is supplied. |
| Apple Music app connects to artist's Apple Music page. | Implemented | Home-screen Apple Music points to `https://music.apple.com/us/artist/bladen/6779022898`. |
| Camera app opens and can use phone camera to take photos. | Implemented | Camera app uses `navigator.mediaDevices.getUserMedia` and supports capture/share/download behavior in browser contexts that allow camera access. |
| Instagram app connects to Instagram artist page. | Implemented | Home-screen Instagram points to `https://www.instagram.com/1bladen/`. |
| Notes opens and talks about `PROM NIGHT`, August 25th release, and July 24th shows in old iPhone font. | Implemented | Notes app includes `PROM NIGHT`, `album releases August 25th`, `upcoming shows July 24th`, and `bl4den.com` using the bundled `tally` font. |
| Battery says `77%`. | Implemented | Status bar keeps `77%`. |
| Battery icon should look like a battery with green fill. | Implemented | Replaced image-only battery with CSS battery outline and partial green fill. |
| Service says `Prorizon` or `Pro-Mobile`. | Implemented | Status bar uses `Pro-Mobile`. |
| Bluetooth and Wi-Fi appear in corner with battery. | Implemented | Status bar uses SVG Bluetooth and Wi-Fi symbols, not text labels. |
| musical.ly app directs to TikTok. | Implemented | Home-screen musical.ly icon points to `https://www.tiktok.com/@1bladen?_r=1&_t=ZP-97AcM02pYVC`. |
| musical.ly app uses original musical.ly icon. | Implemented | Added `icons/musically.jpg` from client-supplied image. |
| Replace Weather app with Instagram and musical.ly. | Implemented | Home-screen app set includes Instagram and musical.ly instead of Weather. |
| Randomize home-screen app order so it is not too close to the copied reference. | Implemented | Home app order is shuffled on load. |
| Add old-school Mail app for fans to email artist. | Implemented | Mail app opens `mailto:booking@bl4den.com`. |
| Remove email subject/body autofill and let fans write whatever. | Implemented | Mail link no longer includes `subject` or `body` query params. |
| Change visible `Bl4den` writing to normal name `Bladen`. | Implemented | User-facing copy/meta uses `Bladen`; `bl4den.com` remains where it is a domain. |
| Use attached PROM NIGHT image as main page background. | Implemented | Added `prom-night-bg.jpg` and uses it on lock screen and home screen. |
| Change background and home screen to new photos. | Implemented | Current provided PROM NIGHT image is installed as the lock/home background. |
| Crop/fit phone aspect ratio so apps do not require scrolling. | Reverted per William | A layout-tightening pass was reverted after William said not to change icon layout. The original icon layout is preserved. |
| Normal time on lock screen and home screen, Pacific/Cali time, non-military like `12:06`. | Implemented | Time uses `America/Los_Angeles` and 12-hour `h:mm` display without AM/PM. |
| App Store should be temporarily unavailable / not open applications because there is no merch yet. | Implemented | App Store cards use unavailable-style actions instead of active merch checkout flow. |
| Remove `valencore` from main domain/prototype domain. | Ignored by direction | William explicitly said to ignore this domain request in this pass. |
| Client will send more platform links later. | Pending | YouTube Music and SoundCloud exact artist URLs still need final links if search URLs are not acceptable. |

## Integration Expectations

- Keep `index.html` as the static page source of truth for this client.
- Keep the TypeScript wrapper thin; it should boot the R2/CDN-hosted static
  site rather than duplicate the page logic.
- Keep source assets in `Clients/Bl4den/` with relative paths so the directory
  remains locally previewable.
- Do not hide domain, DNS, or CDN state inside page-content changes.

## Guardrails

- Do not change DNS/domain routing as part of client copy/UI revisions.
- Do not replace the copied iPhone-style page with a new UI unless William
  explicitly redirects the project.
- Do not change icon layout unless the client or William explicitly asks for a
  layout pass.
- Do not commit unrelated generated client artifacts from other client folders.
- Do not reintroduce copied checkout credentials or live merch purchase flows.

## Success Criteria

- Home-screen app clicks go to the intended artist destinations.
- Status bar displays `Pro-Mobile`, Wi-Fi symbol, Bluetooth symbol, `77%`, and
  a green battery icon.
- Lock screen and home screen use the PROM NIGHT background image.
- Lock/home time displays California time in non-military format.
- Notes, Mail, Camera, App Store, and music/social app behaviors match the
  request ledger above.
- Request/status documentation stays current with every client revision.

## Proof / Checks

Current verification for the June 26, 2026 revision:

```text
python3 -m http.server 5173
curl -fsSL http://127.0.0.1:5173/
git diff --check -- Clients/Bl4den/index.html
Headless Chrome DevTools smoke at 390x844 mobile viewport
```

Smoke evidence confirmed:

- No runtime log or exception events during page load/unlock smoke.
- Spotify, Apple Music, TikTok, Instagram, and Mail anchors were present.
- Mail link did not include subject/body query params.
- New PROM NIGHT background and musical.ly icon assets loaded.
- Wi-Fi/Bluetooth/battery status bar rendered with symbols.

## Operating Model

William owns client direction, final link decisions, and domain/DNS actions.
This client directory owns the static artifact, asset ledger, request ledger,
and implementation evidence for the Bladen site.
