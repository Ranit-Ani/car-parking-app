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

// TEMP DIAGNOSTIC — remove once the reconnect issue is confirmed fixed.
// Fires unconditionally the moment this module is loaded, regardless of
// platform or plugin availability, so we can confirm from the device
// console whether this file version is actually the one running.
console.log('[network] module build marker: NETWORK-JS-V2');

let capacitorNetworkPromise = null;
function getCapacitorNetwork() {
  if (!capacitorNetworkPromise) {
    capacitorNetworkPromise = (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        console.log('[network] Capacitor.getPlatform() =', Capacitor.getPlatform(), '| isNativePlatform() =', Capacitor.isNativePlatform());
        if (!Capacitor.isNativePlatform()) {
          console.log('[network] not a native platform — using browser online/offline events + navigator.onLine polling.');
          return null;
        }
        // isNativePlatform() only says "this is Android/iOS" — it does NOT
        // mean the Network plugin's native side is actually registered.
        // If `npx cap sync` was skipped (or ran before @capacitor/network
        // was added), Capacitor silently falls back to the *web*
        // implementation of this plugin even inside the native app. That
        // web fallback just reads `navigator.onLine`, which is exactly the
        // value that's known to get stuck after page load inside an
        // Android WebView — i.e. this exact bug, just moved one layer
        // down where it's invisible from the JS side. Checking
        // isPluginAvailable() lets us detect that mismatch instead of
        // quietly running the broken path.
        console.log('[network] Capacitor.isPluginAvailable("Network") =', Capacitor.isPluginAvailable('Network'));
        if (!Capacitor.isPluginAvailable('Network')) {
          console.warn(
            '[network] Running on native Android/iOS but the Network ' +
            'plugin is not registered natively — falling back to ' +
            'navigator.onLine, which will NOT reliably detect ' +
            'reconnects on Android. Run `npx cap sync android`, confirm ' +
            'android/app/src/main/assets/capacitor.plugins.json lists ' +
            '@capacitor/network, then do a full uninstall + reinstall.'
          );
          return null;
        }
        const { Network } = await import('@capacitor/network');
        console.log('[network] using NATIVE Network plugin.');
        return Network;
      } catch (err) {
        // Plugin not installed/available (e.g. plain web build) — fall
        // back to browser events instead of failing the whole app.
        console.warn('[network] getCapacitorNetwork() threw, falling back to browser events:', err);
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
  console.log('[network] notify() called with', next, '| current isOnline =', isOnline, next === isOnline ? '(no-op, same value)' : '(TRANSITION, will fire subscribers)');
  if (next === isOnline) return;
  isOnline = next;
  subscribers.forEach((cb) => cb(isOnline));
}

async function attachUnderlyingListener() {
  console.log('[network] attachUnderlyingListener() starting, refCount =', refCount);
  const Network = await getCapacitorNetwork();
  // Another subscriber may have unsubscribed while the dynamic import
  // above was in flight — don't attach a listener nobody wants anymore.
  if (refCount <= 0) return;

  if (Network) {
    try {
      const status = await Network.getStatus();
      console.log('[network] initial Network.getStatus() =', status);
      notify(status.connected);
    } catch (err) {
      console.warn('[network] initial Network.getStatus() threw:', err);
      // Ignore — we'll still get updates from the listener below.
    }
    const handle = await Network.addListener('networkStatusChange', (status) => {
      console.log('[network] networkStatusChange event fired:', status);
      notify(status.connected);
    });
    console.log('[network] native listener registered + 2s poll starting.');
    // Belt-and-suspenders: on some Android OEM WebViews/OS versions the
    // plugin's own `networkStatusChange` event has been observed to just
    // stop being delivered after the app's been running a while (this is
    // exactly the kind of native flakiness this plugin exists to work
    // around in the first place — see the top-of-file comment — but it
    // isn't itself perfectly immune to it). Re-checking the plugin's
    // status directly on a short interval means a reconnect is still
    // caught within a couple of seconds even if that push event never
    // fires, instead of the app being stuck "offline" until it's fully
    // closed and reopened.
    const pollId = setInterval(async () => {
      try {
        const s = await Network.getStatus();
        console.log('[network] poll tick, Network.getStatus() =', s);
        notify(s.connected);
      } catch (err) {
        console.warn('[network] poll tick threw:', err);
        // Transient — the next poll will try again.
      }
    }, 2000);
    detachUnderlying = () => {
      handle.remove();
      clearInterval(pollId);
    };
  } else if (typeof window !== 'undefined') {
    const onOnline = () => notify(true);
    const onOffline = () => notify(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    notify(navigator.onLine);
    // Same reasoning as the native branch above: the browser's 'online'
    // event is well known to be unreliable in some setups (virtual NICs,
    // some VPN clients, some mobile browsers, certain sandboxed/embedded
    // webviews) — it simply never fires even once the connection is back.
    // Polling navigator.onLine directly is cheap and guarantees the
    // reconnect is caught within a couple of seconds regardless of
    // whether that event ever arrives.
    const pollId = setInterval(() => notify(navigator.onLine), 2000);
    detachUnderlying = () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(pollId);
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