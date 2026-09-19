import { useEffect, useRef } from 'react';

/**
 * InfiniteSentinel
 * Invisible-ish tripwire dropped at the bottom of a list. When it scrolls
 * into view, `onVisible` fires (typically `loadMore` from useInfiniteList).
 * Renders nothing once there's nothing left to load.
 */
export default function InfiniteSentinel({ onVisible, hasMore, loading }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!hasMore) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible();
      },
      // Fire well before the sentinel is actually on-screen, so the next
      // page's network request has time to finish while the admin is still
      // scrolling through the current rows — by the time they physically
      // reach the bottom, the new rows are usually already there instead of
      // a visible pause. (Client-side-only lists like Manage Locations never
      // hit this delay at all since there's no request to wait on; this is
      // to close that gap for server-paginated lists like Manage Slots.)
      { rootMargin: '1000px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible, hasMore]);

  if (!hasMore) return null;

  return (
    <div
      ref={ref}
      style={{
        textAlign: 'center',
        padding: '1.25rem',
        color: 'var(--text-muted)',
        fontSize: '0.78rem',
        letterSpacing: '0.05em',
      }}
    >
      {loading ? (
        <>
          <i className="bi bi-arrow-repeat" style={{ marginRight: '0.4rem' }} />
          Loading more...
        </>
      ) : (
        '\u00A0'
      )}
    </div>
  );
}
