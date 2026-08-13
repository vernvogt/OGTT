# OGTT Leaderboard — PWA

This is the installable (PWA) version of the OGTT Leaderboard app. It's built
so that **the app content lives entirely in `data.json`**, separate from the
app itself — update that one file on Netlify and everyone who already has the
app on their phone will see the new results next time they open it (no
reinstall, no App Store).

## What's in this zip

```
index.html              the app shell (structure only, no data in it)
styles.css              all styling
app.js                  app logic — fetches data.json at runtime
data.json               <-- ALL the leaderboard/report/results data lives here
manifest.webmanifest    PWA config (name, icons, colours)
sw.js                   service worker (makes it installable + works offline)
netlify.toml            tells Netlify not to cache data.json / sw.js
assets/logo.png         header logo
icons/                  app icons for the home-screen shortcut
```

## 1. Deploy to Netlify (first time)

1. Go to [app.netlify.com](https://app.netlify.com) and log in.
2. Click **Add new site → Deploy manually**.
3. Drag the **whole unzipped folder** (not the zip itself) onto the upload
   area. Netlify will publish it and give you a URL like
   `https://something-random.netlify.app`.
4. Open that URL on your phone in Safari (iPhone) or Chrome (Android).
5. Add it to your home screen:
   - **iPhone/Safari:** tap the Share icon → **Add to Home Screen**.
   - **Android/Chrome:** tap the ⋮ menu → **Add to Home screen** (or you'll
     see an "Install app" banner).
6. Open it from the home screen icon — it now runs full-screen like a normal app.

You can rename the site (Site settings → Change site name) to get a nicer
URL before you share it with the club.

## 2. Updating the results (every week)

You do **not** need to re-zip or re-upload the whole app. Only `data.json`
changes each week:

1. Regenerate `data.json` (ask Claude to rebuild it from the latest
   spreadsheet, same as before).
2. Go to your site on Netlify → **Deploys** tab.
3. Drag just the new `data.json` file onto the deploy area
   (or drag the full updated folder again — either works, Netlify only
   updates what changed).
4. That's it. Next time anyone opens the app (with an internet connection),
   it fetches the new `data.json` automatically and shows the latest
   leaderboard, reports and results. No update prompts, no reinstalling.

If someone opens the app while offline, it will show the last data it
successfully loaded, with a small note at the top ("Showing last saved
results (offline)").

## Notes on how the auto-update works

- `app.js` always fetches `data.json` fresh from the network first (it never
  trusts a cached copy unless there's no internet at all).
- The service worker (`sw.js`) caches the *app shell* (HTML/CSS/JS/icons) so
  it works offline and installs like a native app, but it deliberately does
  **not** cache `data.json` the normal way — it always tries the network
  first for that file.
- `netlify.toml` tells Netlify's CDN not to cache `data.json` or `sw.js`
  either, so there's no stale-cache layer sitting between your update and
  the phone.

If you ever want to change the app's look (colours, logo, tabs), that lives
in `index.html` / `styles.css` / `app.js` — just ask Claude to rebuild those
and re-deploy the whole folder.
