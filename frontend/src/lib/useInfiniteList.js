import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from './api';
import { getCached, hasCached, setCached } from './pageCache';

/**
 * useInfiniteList
 * Fetches a paginated backend endpoint and accumulates results page by
 * page, instead of pulling the entire collection in one shot. Pairs with
 * <InfiniteSentinel /> to trigger the next page as the user scrolls.
 *
 * The first page's result for a given URL (i.e. a given set of filters) is
 * cached in memory (see lib/pageCache.js), keyed by that URL. So if the
 * user leaves this page and comes back — or flips a filter back to a value
 * they'd already used — the list appears immediately from cache instead of
 * showing a loading state again, while a fresh copy of page 1 is fetched
 * quietly in the background to catch anything that changed while they
 * were away (page 2+ still load fresh once the user scrolls that far).
 * Live-triggered refreshes (via `refresh()`, e.g. a socket event) are
 * likewise silent — they never blank the list out first.
 *
 * @param {(page: number, limit: number) => string} buildUrl
 *   Returns the endpoint (including query string) for a given page.
 * @param {any[]} deps
 *   When any value here changes, the list resets and re-fetches from page 1
 *   (use this for filters/search that should hit the server again).
 * @param {number} [limit=30]
 */
export function useInfiniteList(buildUrl, deps = [], limit = 30) {
  const initialUrl = buildUrl(1, limit);
  const initialCacheKey = 'infinite:' + initialUrl;
  const initialCached = hasCached(initialCacheKey) ? getCached(initialCacheKey) : null;

  const [items, setItems] = useState(() => (initialCached ? initialCached.items : []));
  const [loading, setLoading] = useState(() => !initialCached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (initialCached ? initialCached.hasMore : true));
  const [total, setTotal] = useState(() => (initialCached ? initialCached.total : 0));

  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const buildUrlRef = useRef(buildUrl);
  buildUrlRef.current = buildUrl;
  // Bumped on every "replace" fetch (filter/search change) so that a
  // response from an older, now-irrelevant request can be detected and
  // discarded even if it resolves after a newer request.
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (pageNum, replace, opts = {}) => {
    const { silent = false } = opts;

    // Only "load more" (pagination) calls are blocked while something is
    // in flight. A "replace" call (new filter/search) must always be
    // allowed to start — otherwise switching tabs while the previous
    // tab's request is still loading silently no-ops, and the old
    // response later overwrites the UI with the wrong tab's data.
    if (loadingRef.current && !replace) return;

    const myRequestId = replace ? ++requestIdRef.current : requestIdRef.current;
    loadingRef.current = true;
    if (replace) {
      // A "silent" replace means we've already shown cached data for this
      // exact filter (see the reset effect below) and this call is just a
      // background revalidation — don't flash a loading state or blank
      // rows that are already correct.
      if (!silent) {
        setLoading(true);
        setItems([]); // clear stale rows from the previous filter immediately
      }
    } else {
      setLoadingMore(true);
    }

    const url = buildUrlRef.current(pageNum, limit);
    const d = await apiRequest(url);

    // If a newer "replace" request has started since this one went out,
    // this response is stale — ignore it so it can't clobber the current
    // filter's data.
    if (myRequestId !== requestIdRef.current) return;

    if (d && d.success) {
      setItems((prev) => (replace ? d.data : [...prev, ...d.data]));
      setHasMore(!!d.hasMore);
      setTotal(d.total ?? d.data.length);
      if (replace && pageNum === 1) {
        setCached('infinite:' + url, { items: d.data, hasMore: !!d.hasMore, total: d.total ?? d.data.length });
      }
    } else if (replace && !silent) {
      setItems([]);
      setHasMore(false);
    }

    setLoading(false);
    setLoadingMore(false);
    loadingRef.current = false;
  }, [limit]);

  // Reset & reload whenever filters/search deps change (e.g. the status tab
  // the user clicked). If we already have a cached page 1 for the resulting
  // URL, show THAT data immediately — not the previous tab's rows — and
  // revalidate quietly in the background. Only show a loading state when
  // this exact filter has genuinely never been loaded before.
  useEffect(() => {
    pageRef.current = 1;
    const url1 = buildUrlRef.current(1, limit);
    const key = 'infinite:' + url1;
    const cached = hasCached(key) ? getCached(key) : null;

    if (cached) {
      setItems(cached.items);
      setHasMore(cached.hasMore);
      setTotal(cached.total);
      setLoading(false);
      fetchPage(1, true, { silent: true });
    } else {
      setHasMore(true);
      fetchPage(1, true, { silent: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchPage(next, false);
  }, [fetchPage, hasMore]);

  // Used for live/manual refreshes (e.g. a socket event saying something
  // changed) — always silent, since the list is already visible and a
  // background sync shouldn't blank it out or show a spinner.
  const refresh = useCallback(() => {
    pageRef.current = 1;
    fetchPage(1, true, { silent: true });
  }, [fetchPage]);

  return { items, setItems, loading, loadingMore, hasMore, total, loadMore, refresh };
}