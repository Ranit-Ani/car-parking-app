import { useEffect, useRef } from 'react';
import { subscribeNetwork, getIsOnline } from './network';
import { subscribeAppResume } from './appLifecycle';

/**
 * useRevalidate(callback, { enabled })
 *
 * Calls `callback` whenever the device reconnects to the network (an
 * offline -> online transition) or the app returns to the foreground —
 * the two moments the data on screen is most likely stale or missing
 * because an earlier fetch failed or was never attempted. This is what
 * lets a page's data (or the logged-in session) catch up automatically
 * once connectivity is back, instead of requiring the user to navigate
 * away and back or restart the app.
 *
 * - Does NOT call `callback` on mount — callers already load their own
 *   data on mount; this only handles the *recovery* path.
 * - Does NOT call `callback` while still offline (an app-resume while the
 *   device has no signal is a no-op).
 * - Network-reconnect and app-resume commonly fire back-to-back (e.g.
 *   unlocking the phone with data already reconnected) — both are
 *   coalesced onto one short debounce so `callback` never fires twice for
 *   what the user experiences as a single "I'm back" moment.
 * - Cleans up both underlying listeners on unmount.
 *
 * `callback` is read via a ref so callers don't need to memoize it with
 * useCallback for this hook's sake (though most of the load functions it's
 * used with already are, for their own effects).
 */
export function useRevalidate(callback, { enabled = true } = {}) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let debounceTimer = null;
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        callbackRef.current();
      }, 150);
    };

    const unsubscribeNetwork = subscribeNetwork((online) => {
      if (online) trigger();
    });
    const unsubscribeResume = subscribeAppResume(() => {
      if (getIsOnline()) trigger();
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeNetwork();
      unsubscribeResume();
    };
  }, [enabled]);
}
