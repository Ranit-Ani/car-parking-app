// ─── In-memory page/data cache ──────────────────────────────────────────
// React Router unmounts a page's component every time you navigate away
// from it, which normally wipes all of that page's state — including data
// it already fetched from the backend. That's why, without this cache,
// going Dashboard -> Profile -> Dashboard re-runs the Dashboard's fetch
// and shows a loading state again even though nothing changed.
//
// This module is a plain JS object living outside of React (module-level,
// so it survives unmount/remount) that pages can stash their last-loaded
// data in. It is intentionally NOT persisted to localStorage/sessionStorage
// — it only needs to last for the lifetime of the browser tab, and clearing
// on logout (see AuthContext) keeps one account's data from leaking into
// another session in the same tab.

const store = new Map();

export function hasCached(key) {
  return store.has(key);
}

export function getCached(key) {
  return store.get(key);
}

export function setCached(key, value) {
  store.set(key, value);
  return value;
}

export function deleteCached(key) {
  store.delete(key);
}

// Wipe everything — call on logout/login so a new session starts clean.
export function clearPageCache() {
  store.clear();
}