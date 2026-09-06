# Why login/API calls failed inside the Android APK (and the fix)

## Root cause

Your frontend and backend are hosted together as **one** Render Web
Service, so on the website the page is loaded from your Render domain
(e.g. `https://campus-parking.onrender.com`) and every API call was
written as a **relative** URL:

```js
export const API_BASE = '/api';
fetch(API_BASE + '/auth/login', ...)   // -> https://campus-parking.onrender.com/api/auth/login
io();                                   // -> connects to the same origin
```

That works perfectly in the browser because "relative" resolves against
whatever page the browser is currently on.

Capacitor doesn't load your app from your Render domain, though. It
packages the built frontend into the APK and serves it from a **local**
origin inside the WebView — by default `https://localhost` on Android.
So inside the app, that same relative call resolved to:

```
https://localhost/api/auth/login   ❌ nothing is listening on the phone itself
```

The request fails (or just hangs), so login, bookings, and every other
backend-dependent feature silently break — while the UI itself renders
fine, because the static HTML/CSS/JS *is* bundled into the app.

## The fix

1. **`frontend/src/lib/config.js` (new file)** — detects whether the app
   is running inside the native Capacitor shell (`window.Capacitor.isNativePlatform()`)
   and, only in that case, switches `API_BASE`/`BACKEND_URL` from a
   relative path to your backend's **full** Render URL. The web build's
   behavior is completely unchanged.

2. **`frontend/src/lib/api.js`** — now imports `API_BASE` from
   `config.js` instead of hardcoding `/api`.

3. **`frontend/src/lib/socket.js`** — the Socket.io client now connects
   to `BACKEND_URL` (full URL on native, same-origin on web) instead of
   always assuming same-origin.

4. **`backend/server.js` and `backend/socket.js`** — CORS now always
   allows the Capacitor app's local origins (`capacitor://localhost`,
   `https://localhost`, `http://localhost`) in addition to whatever
   `CORS_ORIGIN` you've configured, so locking `CORS_ORIGIN` down to your
   exact site domain won't accidentally block the native app.

## One thing you must do

Open `frontend/src/lib/config.js` and replace the placeholder with your
**real** Render URL:

```js
const PRODUCTION_BACKEND_URL = 'https://campus-parking.onrender.com';
```

Find your exact URL in the Render dashboard → your service → the URL
shown at the top of the page (it may have a suffix, e.g.
`campus-parking-abcd.onrender.com` — copy it exactly).

## Rebuilding the APK

```bash
cd frontend
npm install
npm run build          # rebuilds dist/ with the fix baked in
npx cap sync android    # copies the new dist/ into your Android project
```

Then rebuild/run from Android Studio as before. Login and every other
API/socket call should now reach your live Render backend instead of the
phone's own local origin.

### Alternative: point a build at a different backend without editing code

```bash
VITE_BACKEND_URL=https://your-staging-backend.onrender.com npm run build
```

This is optional — only needed if you want a build that talks to a
non-default backend (e.g. a staging environment) without changing
`config.js`.
