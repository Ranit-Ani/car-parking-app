import { useCallback, useState } from 'react';
import { getCached, hasCached, setCached } from './pageCache';

/**
 * useCachedState(key, initialValue)
 *
 * Drop-in replacement for useState() whose value is seeded from — and
 * kept in sync with — the shared page cache (see lib/pageCache.js).
 *
 * The first time a page mounts for a given key there's nothing cached yet,
 * so it behaves exactly like useState(initialValue). If the page is later
 * unmounted (e.g. the user navigates to another page) and mounted again,
 * this returns the last value that was set instead of `initialValue`, so
 * the page can render with real data immediately instead of a blank/loading
 * state, while still being able to refresh that data quietly in the
 * background.
 */
export function useCachedState(key, initialValue) {
  const [state, setState] = useState(() => (hasCached(key) ? getCached(key) : initialValue));

  const setAndCache = useCallback((value) => {
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      setCached(key, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [state, setAndCache];
}

/** Was there already a cached value for `key` at the moment this render started? */
export { hasCached as wasCached } from './pageCache';