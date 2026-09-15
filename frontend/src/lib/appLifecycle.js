// ─── App foreground/resume monitoring ───────────────────────────────────
// Fires every subscriber's callback whenever the app returns to the
// foreground — a native Android resume (via @capacitor/app's
// `appStateChange` event) or, on the web build, the browser tab becoming
// visible again. Paired with lib/network.js in useRevalidate.js so a
// session/data refresh also happens when someone backgrounds the app for a
// while and comes back, not just on a network reconnect.
//
// Ref-counted the same way as lib/network.js: every subscriber shares one
// underlying listener, which is removed once the last subscriber unmounts.

let capacitorAppPromise = null;
function getCapacitorApp() {
  if (!capacitorAppPromise) {
    capacitorAppPromise = (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return null;
        const { App } = await import('@capacitor/app');
        return App;
      } catch {
        return null;
      }
    })();
  }
  return capacitorAppPromise;
}

const subscribers = new Set();
let detachUnderlying = null;
let refCount = 0;

function notifyResume() {
  subscribers.forEach((cb) => cb());
}

async function attachUnderlyingListener() {
  const App = await getCapacitorApp();
  if (refCount <= 0) return; // last subscriber left while importing

  if (App) {
    const handle = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) notifyResume();
    });
    detachUnderlying = () => handle.remove();
  } else if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') notifyResume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    detachUnderlying = () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}

function detachUnderlyingListener() {
  if (detachUnderlying) {
    detachUnderlying();
    detachUnderlying = null;
  }
}

/**
 * Subscribe to "app came back to the foreground" events. Returns an
 * unsubscribe function; call it on cleanup so the listener never outlives
 * the component that registered it.
 */
export function subscribeAppResume(callback) {
  subscribers.add(callback);
  refCount += 1;
  if (refCount === 1) attachUnderlyingListener();
  return () => {
    subscribers.delete(callback);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) detachUnderlyingListener();
  };
}
