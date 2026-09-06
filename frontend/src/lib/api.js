// ─── API client ──────────────────────────────────────────────────
// Mirrors the original vanilla apiRequest() from js/app.js exactly:
// same base URL, same auth header, same 401 handling.
//
// On Render, frontend + backend are served from the same origin, so a
// relative '/api' path works. But when this same frontend is bundled into
// the Capacitor Android app, the app is loaded from `capacitor://localhost`
// (or `https://localhost`) — there is no backend at that origin, so a
// relative path resolves to nowhere and every request fails.
//
// VITE_API_BASE_URL lets a build target an absolute backend URL instead.
// Leave it unset for the normal web build (keeps the relative '/api'
// behavior); set it to your Render URL when building the frontend for the
// Capacitor app. See frontend/.env.production.example.
const API_ROOT = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

export const API_BASE = API_ROOT + '/api';

// localStorage is used here (not sessionStorage) so the session survives
// closing the tab/browser and reopening it, and is shared across tabs.
// The JWT itself still expires normally on the backend, so this only
// keeps the user logged in for as long as the token is valid.
export function getToken() {
  return localStorage.getItem('agp_token');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('agp_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem('agp_token', token);
  localStorage.setItem('agp_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('agp_token');
  localStorage.removeItem('agp_user');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Only asks once per app session — if the person says no, we don't nag
// them again on every single download, just like most apps.
let storagePermissionDenied = false;

async function ensureStoragePermission() {
  const { Filesystem } = await import('@capacitor/filesystem');
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') return true;
    if (storagePermissionDenied) return false;
    const req = await Filesystem.requestPermissions();
    if (req.publicStorage === 'denied') storagePermissionDenied = true;
    return req.publicStorage === 'granted';
  } catch {
    // Plugin doesn't define this permission on this Android version (13+
    // no longer requires it for app-created files) — treat as granted.
    return true;
  }
}

/**
 * Saves a downloaded blob on a native Android build via the Filesystem
 * plugin (the browser's `<a download>` trick doesn't work inside a
 * Capacitor WebView). Prompts for storage access the first time on
 * Android versions that still require it (13+ no longer does, and the
 * permission check silently passes there), then writes into the public
 * Documents/Downloads area so the file shows up in the phone's own file
 * manager — no share sheet, just a quiet save.
 */
/**
 * Filesystem.writeFile() silently overwrites whatever is already at `path` —
 * it does not create a new file the way a browser download does. So every
 * download of the same receipt used to land on top of the previous one,
 * which is why repeat downloads reported "success" but the file list never
 * grew and the "old" receipt just sat there unchanged.
 *
 * This walks `receipt-XXXX.pdf`, `receipt-XXXX (1).pdf`, `receipt-XXXX (2).pdf`, ...
 * and returns the first path that doesn't already exist, so each download
 * gets its own file.
 */
async function getNonCollidingPath(Filesystem, Directory, filename) {
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
  const ext = dotIndex === -1 ? '' : filename.slice(dotIndex); // includes the "."

  let candidate = filename;
  let n = 0;
  while (true) {
    try {
      await Filesystem.stat({ path: candidate, directory: Directory.Documents });
      // No throw => file exists, try the next suffix.
      n += 1;
      candidate = `${base} (${n})${ext}`;
    } catch {
      // stat() throws when the path doesn't exist — that's our free slot.
      return candidate;
    }
  }
}

async function saveFileNative(blob, filename) {
  const granted = await ensureStoragePermission();
  if (!granted) {
    return {
      success: false,
      message: 'Storage permission is needed to save the receipt. Allow it in your phone Settings and try again.',
    };
  }
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const targetPath = await getNonCollidingPath(Filesystem, Directory, filename);
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: targetPath,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return { success: true, message: 'Receipt saved to Documents.' };
  } catch (err) {
    console.error('Native save:', err);
    return { success: false, message: 'Could not save the receipt to your device.' };
  }
}

/**
 * downloadFile(endpoint, filename)
 * For binary responses (like PDF receipts) that apiRequest can't handle
 * since it always expects JSON. Fetches with the auth header, then:
 *  - on the web, triggers a normal browser file-save via a temporary link
 *  - inside the Capacitor Android app, saves the file to the device's
 *    Documents/Downloads area via the Filesystem plugin, since the
 *    browser download trick silently does nothing in a native WebView.
 */
export async function downloadFile(endpoint, filename) {
  const token = getToken();
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { success: false, message: body?.message || 'Download failed.' };
    }
    const blob = await res.blob();

    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      return await saveFileNative(blob, filename);
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error('Download:', endpoint, err);
    return { success: false, message: 'Download failed.' };
  }
}
/**
 * apiRequest(endpoint, options)
 * - Automatically attaches JSON content-type + bearer token
 * - Serializes object bodies to JSON
 * - On 401, clears the session (caller is responsible for redirecting)
 * - Never throws: returns null on network/parse failure
 */
export async function apiRequest(endpoint, options = {}, onUnauthorized) {
  const token = getToken();
  const cfg = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  };
  if (cfg.body && typeof cfg.body === 'object') {
    cfg.body = JSON.stringify(cfg.body);
  }
  try {
    const res = await fetch(API_BASE + endpoint, cfg);
    if (res.status === 401) {
      clearSession();
      if (onUnauthorized) onUnauthorized();
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('API:', endpoint, err);
    return null;
  }
}