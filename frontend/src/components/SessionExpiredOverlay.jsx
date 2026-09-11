import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * App-wide blocking overlay shown the moment the backend rejects a request
 * because this session is no longer valid — most notably because an admin
 * changed this user's role/permissions while they were actively using the
 * app (see auth.middleware.js's tokenVersion check and AuthContext's
 * sessionExpired state).
 *
 * Deliberately offers no way to dismiss it except the Re-login button:
 * - No backdrop-click-to-close, no Escape-to-close, no [x] button.
 * - Rendered at the top of the component tree (see App.jsx), above the
 *   sidebar/topbar/toasts/modals (z-index below), so it stays visible over
 *   whatever route the browser's back/forward buttons land on — the
 *   person can navigate the browser all they want, but the overlay is
 *   controlled by React state, not the route, so it keeps blocking.
 * - Underlying app content is `inert` + non-scrolling while this is up, so
 *   nothing behind it can be clicked, tabbed to, or scrolled.
 */
export default function SessionExpiredOverlay() {
  const { sessionExpired, confirmReLogin } = useAuth();

  // Lock page scroll while blocking, same approach as the shared Modal
  // component, so the page behind can't be scrolled around the overlay.
  useEffect(() => {
    if (!sessionExpired) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [sessionExpired]);

  if (!sessionExpired) return null;

  return (
    <div
      className="ag-modal-backdrop"
      style={{ zIndex: 20000 }}
      // No onMouseDown-to-close handler here on purpose — clicking the
      // backdrop must NOT dismiss this.
    >
      <div className="ag-modal-dialog sm">
        <div className="ag-modal-content" role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title">
          <div className="ag-modal-header">
            <h5 className="ag-modal-title" id="session-expired-title" style={{ color: '#ff5470' }}>
              <i className="bi bi-shield-lock" /> Session Terminated
            </h5>
            {/* Deliberately no close (&times;) button here. */}
          </div>
          <div className="ag-modal-body">
            <p style={{ margin: 0 }}>{sessionExpired.message}</p>
            <p style={{ margin: '.75rem 0 0', color: 'var(--t2, #8aa)', fontSize: '.85rem' }}>
              For your security, you'll need to log back in to continue.
            </p>
          </div>
          <div className="ag-modal-footer">
            <button type="button" className="btn-ag primary full lg" onClick={confirmReLogin} autoFocus>
              Re-login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
