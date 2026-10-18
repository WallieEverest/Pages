# iPhone Web Apps: Weather + Slideshow

Two home-screen apps for iPhone, hosted free on GitHub Pages. No App Store, no build step, no API keys.

```
index.html                      launcher page linking both apps
weather/                        weather app (Open-Meteo data)
slideshow/                      photo slideshow
  photos/                       put your photos here
  photos.json                   photo list (rebuilt automatically, see below)
.github/workflows/update-photos.yml
```

Each app has its own `manifest.json`, service worker and icon, so each becomes a separate icon on the home screen.

## 1. Publish to GitHub Pages

1. Create a new **public** repository on GitHub, e.g. `iphone-apps`.
2. Upload the contents of this folder (keep the folder structure, including `.github`).
   On github.com: **Add file → Upload files**, drag everything in, commit.
   The `.github` folder is hidden on Mac/Linux; press Cmd+Shift+. in Finder to see it, or create the workflow file through the GitHub web editor instead.
3. **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Save.
4. After about a minute the site is live at `https://<your-username>.github.io/iphone-apps/`.

## 2. Install on iPhone

1. In **Safari**, open `https://<your-username>.github.io/iphone-apps/weather/`.
2. Tap **Share → Add to Home Screen**, keep **Open as Web App** on, tap **Add**.
3. Repeat for `.../slideshow/`.

Open each app once while online so it can cache itself for offline use.

## Weather

- First launch asks for location permission. If you decline, use the search box.
- Tap 📍 to switch back to your current location, and °F/°C to change units.
- The last forecast is saved on the phone and shown instantly (and offline). It refreshes on open if older than 10 minutes.
- Data comes from [Open-Meteo](https://open-meteo.com) (free, no key, non-commercial use). City names for your GPS location come from BigDataCloud's free keyless endpoint.

## Slideshow

**Controls:** swipe left/right to change photos, tap to show or hide controls. Controls hide themselves after 3 seconds while playing.
Buttons: previous, play/pause, next, seconds per photo, shuffle (⇄), fill screen (⤢), and slow zoom.
Settings are remembered. The screen stays on while playing (iOS 16.4 and later).

### Adding your photos

1. Upload images into `slideshow/photos/` on GitHub (Add file → Upload files). JPEG is the safest format; resizing to about 2000 px on the long edge keeps loading fast.
2. The **Update photo list** action runs automatically and rewrites `photos.json` within a minute. Check the **Actions** tab if it doesn't.
3. Delete the five sample images whenever you like; the list updates the same way.

**Captions** default to the filename (`grand-canyon_2024.jpg` → "Grand Canyon 2024"). To set your own, edit `photos.json`:

```json
{ "src": "photos/IMG_4021.jpg", "caption": "Mom's 70th birthday" }
```

Use `"caption": ""` to show none. The action keeps captions you've written.

Not using the action? Edit `photos.json` by hand; plain strings work too: `["photos/a.jpg", "photos/b.jpg"]`.

**Note:** GitHub Pages sites are public. Anyone with the URL can see the photos.

## Updating the apps

iPhone caches the apps. After changing `index.html` or `sw.js`, bump `VERSION` at the top of that app's `sw.js` (e.g. `weather-v1` → `weather-v2`), then close and reopen the app on your phone, twice if needed.

## Limitations (iOS web apps)

- No home-screen widgets and no background refresh; data updates when you open the app.
- Location permission may be asked again occasionally.
- Storage for a site can be cleared by iOS if the app goes unused for a long time; it simply re-downloads.
