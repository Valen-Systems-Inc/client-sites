# Bl4den Customer Work Order

Client: Bl4den

Site target: `bl4den.com`

Reference site: `https://myspacemark.net/?utm_source=ig&utm_medium=social&utm_content=link_in_bio`

## Requested Direction

Build a 2013 iPhone / iOS 7-style artist link site based on the provided
reference site, then customize the app links, status bar, notes, and camera
behavior for Bl4den.

## Customer Requests

1. Have YouTube application connect to artist's YouTube Music page.
2. Have Spotify application connect to Spotify artist page.
3. Have SoundCloud application connect to SoundCloud artist page.
4. Have Apple Music application connect to Apple Music artist page.
5. Have Camera app open up and be able to use the phone camera to take photos
   on the website.
6. Have Instagram application connect to Instagram artist page.
7. Have Notes open up and talk about album release: album releases August 25th
   called `PROM NIGHT`, in old iPhone font, and include upcoming shows July
   24th.
8. Have iPhone battery say 77%.
9. Have service say `Prorizon` or `Pro-Mobile`.
10. Have Bluetooth and Wi-Fi in the corner with battery.
11. Make musical.ly application but direct to TikTok.
12. Replace the original Weather application with Instagram and musical.ly.
13. Randomize the origination / order of applications so it is not too close to
    the copied reference website.
14. If possible, include an old-school mail/email application that autofills the
    artist email so fans can email the artist.

## Current Implementation Notes

- Instagram points to `https://www.instagram.com/1bladen/`.
- Music platform links currently use `Bl4den` search URLs until final exact
  artist profile URLs are provided.
- Mail currently prefills `booking@bl4den.com` as a placeholder artist inbox.
- Status bar uses `Pro-Mobile`, `Wi-Fi BT`, and `77%`.
- Notes copy includes `PROM NIGHT`, August 25th, July 24th, and `bl4den.com`.
- Camera uses the browser camera API and works in localhost-capable browsers
  that allow camera access.
- The site was built by pulling the public reference site's static HTML/assets
  and modifying that copy for Bl4den.
