# Bl4den

Static client site for Bl4den, based on the client-provided iPhone-style
reference site and modified for the Bl4den work order.

## Local Preview

From this directory:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173/`.

## Notes

- Instagram points to `https://www.instagram.com/1bladen/`.
- YouTube Music, Spotify, SoundCloud, Apple Music, and TikTok currently use
  search URLs for `Bl4den` until final artist profile URLs are provided.
- Mail uses `booking@bl4den.com` as the prefilled fan email placeholder.
- Camera access requires a browser context that allows `getUserMedia`; localhost
  works for local testing in modern browsers.
- Copied third-party checkout credentials from the reference page were scrubbed.
