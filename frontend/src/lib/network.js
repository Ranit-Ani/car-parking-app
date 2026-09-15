// ─── Connectivity monitoring ────────────────────────────────────────────
// Cross-platform "is the device online" tracking used to drive session and
// data revalidation when the device comes back online (see useRevalidate.js).
//
// On a native Capacitor build this wraps @capacitor/network's
// `networkStatusChange` event — the WebView's own `navigator.onLine` /
// 'online' / 'offline' events are unreliable on native Android (they often
// don't fire at all, since they were designed for a browser tab, not a
// packaged app), which is a big part of why the app never used to notice
// reconnecting. On the web build (or if the native plugin can't be loaded)
// this falls back to navigator.onLine + window 'online'/'offline' events.
//
// Every subscriber shares a single underlying listener (ref-counted), so
// mounting useRevalidate() in several components at once never registers
// more than one native/browser listener, and that listener is torn down
// again once the last subscriber unmounts — see subscribeNetwork() below.

let capacitorNetworkPromise = null;
function getCapacitorNetwork() {
  if (!capacitorNetworkPromise) {
    capacitorNetworkPromise = (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return null;
        const { Network } = await import('@capacitor/network');
        return Network;
      } catch {
        // Plugin not installed/available (e.g. plain web build) — fall
        // back to browser events instead of failing the whole app.
        return null;
      }
    })();
  }
  return capacitorNetworkPromise;
}

let isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
const subscribers = new Set();
let detachUnderlying = null;
let refCount = 0;

function notify(next) {
  if (next === isOnline) return;
  isOnline = next;
  subscribers.forEach((cb) => cb(isOnline));
}

async function attachUnderlyingListener() {
  const Network = await getCapacitorNetwork();
  // Another subscriber may have unsubscribed while the dynamic import
  // above was in flight — don't attach a listener nobody wants anymore.
  if (refCount <= 0) return;

  if (Network) {
    try {
      const status = await Network.getStatus();
      notify(status.connected);
    } catch {
      // Ignore — we'll still get updates from the listener below.
    }
    const handle = await Network.addListener('networkStatusChange', (status) => {
      notify(status.connected);
    });
    detachUnderlying = () => handle.remove();
  } else if (typeof window !== 'undefined') {
    const onOnline = () => notify(true);
    const onOffline = () => notify(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    notify(navigator.onLine);
    detachUnderlying = () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }
}

function detachUnderlyingListener() {
  if (detachUnderlying) {
    detachUnderlying();
    detachUnderlying = null;
  }
}

/** Best-effort synchronous snapshot of current connectivity. */
export function getIsOnline() {
  return isOnline;
}

/**
 * Subscribe to connectivity changes. `callback(isOnline)` fires on every
 * transition (not immediately on subscribe — check getIsOnline() for the
 * current value). Returns an unsubscribe function; call it on cleanup
 * (e.g. a React effect's return) so listeners never outlive the component
 * that registered them.
 */
export function subscribeNetwork(callback) {
  subscribers.add(callback);
  refCount += 1;
  if (refCount === 1) attachUnderlyingListener();
  return () => {
    subscribers.delete(callback);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) detachUnderlyingListener();
  };
}
