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
  // TEMPORARY DIAGNOSTIC — remove once reconnect detection is confirmed
  // working. Open chrome://inspect on the device while reproducing the
  // bug and watch for these lines; they show exactly what the native
  // plugin is reporting and when.
  console.log('[network] notify called with', next, '(current isOnline:', isOnline, ')');
  if (next === isOnline) return;
  isOnline = next;
  console.log('[network] isOnline CHANGED to', isOnline, '— notifying', subscribers.size, 'subscriber(s)');
  subscribers.forEach((cb) => cb(isOnline));
}

async function attachUnderlyingListener() {
  const Network = await getCapacitorNetwork();
  console.log('[network] attachUnderlyingListener: Capacitor Network plugin =', Network ? 'AVAILABLE' : 'NULL (falling back to browser events)');
  // Another subscriber may have unsubscribed while the dynamic import
  // above was in flight — don't attach a listener nobody wants anymore.
  if (refCount <= 0) return;

  if (Network) {
    try {
      const status = await Network.getStatus();
      console.log('[network] initial Network.getStatus() succeeded:', status);
      notify(status.connected);
    } catch (err) {
      console.log('[network] initial Network.getStatus() THREW:', err);
    }
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
    //
    // This is set up FIRST, before addListener — not after it — because
    // addListener's own native call has been observed to hang/fail to
    // settle on some devices. Chaining the poll after it meant a stuck
    // addListener call silently prevented the poll from ever being armed
    // too, which is exactly what made "turn WiFi back on while the app
    // stays open" invisible until a full app restart. Now the poll runs
    // independently of whatever addListener below does.
    const pollId = setInterval(async () => {
      try {
        const s = await Network.getStatus();
        console.log('[network] poll: Network.getStatus() =', s);
        notify(s.connected);
      } catch (err) {
        console.log('[network] poll: Network.getStatus() THREW:', err);
      }
    }, 2000);

    let handle = null;
    try {
      handle = await Network.addListener('networkStatusChange', (status) => {
        console.log('[network] networkStatusChange event fired:', status);
        notify(status.connected);
      });
      console.log('[network] addListener resolved OK');
    } catch (err) {
      console.log('[network] addListener THREW:', err);
      // Native listener unavailable/hung for some reason — the poll
      // above still catches every transition within ~2s regardless.
    }

    detachUnderlying = () => {
      if (handle) handle.remove();
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