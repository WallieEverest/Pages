# iPhone Web Apps: Boating + Slideshow

Two home-screen apps for iPhone, hosted free on GitHub Pages at **https://wallieeverest.github.io/pages/**. No App Store, no build step, no API keys.

- **Boating**: local wind, weather and the National Weather Service marine forecast for wherever you are.
- **Slideshow**: a full-screen photo slideshow, with optional encryption for private photos.

```
index.html                      launcher page linking both apps
weather/                        Boating app (Open-Meteo + National Weather Service data)
slideshow/                      photo slideshow
  manage.html                   photo manager: encrypts photos for upload
  vault.js                      encryption code shared by the slideshow and manager
  photos/                       photos (encrypted .enc files, or plain images)
  vault.json, photos.enc        created when you switch to encrypted photos
  photos.json                   photo list for unencrypted mode
tools/encrypt_photos.py         command-line alternative to manage.html
.github/workflows/update-photos.yml
```

Each app has its own `manifest.json`, service worker and icon, so each becomes a separate icon on the home screen.

## 1. Publish to GitHub Pages

1. Create a new **public** repository on GitHub, e.g. `pages` (all lowercase: the name becomes part of the URL, which is case-sensitive).
2. Upload the contents of this folder (keep the folder structure, including `.github`).
   On github.com: **Add file → Upload files**, drag everything in, commit.
   The `.github` folder is hidden on Mac/Linux; press Cmd+Shift+. in Finder to see it, or create the workflow file through the GitHub web editor instead.
3. **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Save.
4. After about a minute the site is live at `https://wallieeverest.github.io/pages/`.

## 2. Install on iPhone

Type addresses exactly as shown: they are case-sensitive (`pages`, `weather` and `slideshow` are all lowercase).

**Boating**

1. In **Safari**, open `https://wallieeverest.github.io/pages/weather/`.
2. Allow location when asked. The app uses it to find your marine forecast zone.
3. Tap **Share → Add to Home Screen**. The recommended name is **Boating** (it is filled in for you).
4. Keep **Open as Web App** on and tap **Add**.

**Slideshow**

1. In **Safari**, open `https://wallieeverest.github.io/pages/slideshow/`.
2. Tap **Share → Add to Home Screen**, keep **Open as Web App** on, tap **Add**.

Open each app once while online so it can save itself for offline use.

If you had an older home-screen icon (for example one named *Weather*, or one added from an address with a capital *P*), delete it and add the app again from the address above.

## Boating

**What it shows**, top to bottom:

- **Now:** temperature and conditions at your location.
- **Hourly** (next 24 hours): conditions, chance of rain, temperature, and **wind**: the arrow points the way the wind is blowing, with the direction it comes from (N, NE, …), speed in knots, and gusts (*G18* = gusts to 18 kt).
- **Marine Forecast** from the National Weather Service:
  - **Alerts** for your marine zone and location, such as Small Craft Advisories, Gale Warnings, Special Marine Warnings, High Surf and Rip Currents. Tap one for the full details. The stripe color shows severity: red (severe), orange (moderate), yellow (minor).
  - **Zone forecast**: the official wind, seas and wave forecast for the next few days.
  - **Boating briefings**: the local NWS office's graphics about boating, wind and waves, when it has posted any. Swipe for more; tap one to see it full size.
- **7-Day Forecast**: daily lows and highs. The bar colors run from blue at the week's lowest temperature to red at its highest.
- **Wind** (speed, direction and gusts), feels-like temperature, humidity, UV index, sunrise and sunset.

**Controls**

- **Marine zone** (top left): your zone is picked automatically from your location. From shore, it is the nearest zone within about 50 km. Use the list to switch zones, for example from nearshore (0-20 nm) to offshore (20-60 nm) waters.
- **📍** updates your location (do this after you move to a different area).
- **°F/°C** changes temperature units. Wind is always in knots.
- Tap the **Marine Forecast** heading to open the full forecast on weather.gov.

**Good to know**

- Marine forecasts cover US coastal waters and the Great Lakes. Elsewhere, the app shows the weather and wind only.
- Everything is saved on the phone and shown instantly when you open the app, even with no signal on the water. It refreshes when you open the app if the saved copy is older than 10 minutes. Check the **Updated** and **issued** times before relying on it.
- This app is a convenience, not a navigation or safety device. Always check official forecasts and NOAA Weather Radio before going out.
- Weather data: [Open-Meteo](https://open-meteo.com) (free, non-commercial use). Marine forecasts, alerts and briefings: [National Weather Service](https://www.weather.gov/marine/). Place names: BigDataCloud.

## Slideshow

**Controls:** swipe left/right to change photos, tap to show or hide controls. Controls hide themselves after 3 seconds while playing.
Buttons: previous, play/pause, next, seconds per photo, shuffle (⇄), fill screen (⤢), and slow zoom.
Settings are remembered. The screen stays on while playing (iOS 16.4 and later).

### Private photos (encrypted), recommended

GitHub Pages sites are public, so the slideshow can encrypt your photos. Each photo and the photo list (including captions) are encrypted with AES-256-GCM before they are uploaded. The repo and the website only ever contain scrambled `.enc` files with random names. The slideshow asks for the passphrase once per device, then decrypts photos in memory on the phone.

**First-time setup**

1. Open `https://wallieeverest.github.io/pages/slideshow/manage.html` in Safari (iPhone) or any browser on a computer.
2. Choose a passphrase. Use **four or more random words**: anyone can download the encrypted files and try to guess it. **If you forget it, the photos can't be recovered.** Keep your originals.
3. Tap **Choose photos…** and pick your photos. Leave *Resize* on: it keeps loading fast and strips GPS location and other hidden data. Edit captions if you like (photos named like `IMG_1234` start with no caption).
4. Tap **Download update (.zip)**.
5. Unzip it. On GitHub, open the `slideshow` folder → **Add file → Upload files**, drag in everything from the zip (`vault.json`, `photos.enc` and the `photos` folder), and commit.
6. Delete the sample photos: the five `.jpg` files in `slideshow/photos/` and `slideshow/photos.json`. Once `vault.json` exists, they're ignored anyway.
7. Open the slideshow and enter the passphrase. With **Remember on this device** ticked, it isn't asked again. 🔒 (top right, when controls are showing) locks it and forgets the passphrase on that device.

**Adding, removing or re-captioning later**: open `manage.html` again, make the changes, and upload the new zip the same way. It replaces `photos.enc`. Removed photos are listed with their file names so you can delete them from `slideshow/photos/`.

From an iPhone, GitHub's upload page doesn't keep folders. Upload the `.enc` files from the zip's `photos` folder into `slideshow/photos/`, then upload `photos.enc` and `vault.json` into `slideshow/`.

**Command line alternative** (if you keep a local clone of the repo):

```sh
pip install cryptography pillow            # + pillow-heif for .HEIC files
python3 tools/encrypt_photos.py add ~/Pictures/trip/*.jpg
python3 tools/encrypt_photos.py list
python3 tools/encrypt_photos.py caption 3 "Mom's 70th birthday"
python3 tools/encrypt_photos.py remove 5 6        # also deletes the .enc files
python3 tools/encrypt_photos.py export ~/backup   # decrypt everything
git add -A slideshow && git commit -m "Update photos" && git push
```

The script and `manage.html` use the same format and passphrase, so you can mix them.

**What is and isn't protected**

- Protected: photo contents, captions and original file names. Even GitHub can't see them.
- Visible to anyone: that the site exists, how many photos there are and roughly how big each one is, and when you uploaded them.
- **Git history:** if real photos were ever committed unencrypted, they stay in the repo's history even after you delete them. If that happened, the simplest fix is to delete the repository, create a new one, and upload only the encrypted files.
- The key is stored on each device as a non-exportable browser key. The passphrase itself is never saved.
- Changing the passphrase means starting a new vault: export with the script, delete `vault.json`, `photos.enc` and `photos/*.enc`, then add the photos again.

**Technical details:** the key is derived with PBKDF2-HMAC-SHA256 (600,000 iterations, random 16-byte salt in `vault.json`). Each file is a 12-byte random IV followed by AES-256-GCM ciphertext and tag. Everything uses the browser's built-in Web Crypto; there are no third-party libraries.

### Unencrypted photos (simpler, public)

1. Upload images into `slideshow/photos/` on GitHub (Add file → Upload files). JPEG is the safest format; resizing to about 2000 px on the long edge keeps loading fast.
2. The **Update photo list** action runs automatically and rewrites `photos.json` within a minute. Check the **Actions** tab if it doesn't.
3. Delete the five sample images whenever you like; the list updates the same way.

**Captions** default to the filename (`grand-canyon_2024.jpg` → "Grand Canyon 2024"). To set your own, edit `photos.json`:

```json
{ "src": "photos/IMG_4021.jpg", "caption": "Mom's 70th birthday" }
```

Use `"caption": ""` to show none. The action keeps captions you've written.

Not using the action? Edit `photos.json` by hand; plain strings work too: `["photos/a.jpg", "photos/b.jpg"]`.

**Note:** in this mode, anyone with the URL can see the photos.

## Updating the apps

iPhone caches the apps. After changing an app's code (`index.html`, `vault.js`, `sw.js`), bump `VERSION` at the top of that app's `sw.js` (the Boating app is at `weather-v4` and the slideshow at `slideshow-v2`; increase the number), then close and reopen the app on your phone, twice if needed.

## Limitations (iOS web apps)

- No home-screen widgets and no background refresh; data updates when you open the app.
- Location permission may be asked again occasionally.
- Storage for a site can be cleared by iOS if the app goes unused for a long time; it simply re-downloads.
