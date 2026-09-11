import { useEffect, useLayoutEffect } from 'react';

/**
 * Lightweight modal used across the app for confirmations, forms,
 * bills, etc. Replaces bootstrap.Modal() imperative usage from the
 * original pages with a plain, controlled React component.
 */
export default function Modal({ show, onClose, title, icon, size, headerStyle, footer, children }) {
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  // Block background scrolling while the modal is open (mobile Android
  // in particular lets the page behind the modal scroll/rubber-band
  // otherwise), and hide anything (like the Leaflet map) that can bleed
  // through the backdrop on mobile. useLayoutEffect (not useEffect) is
  // required here: useEffect runs AFTER the browser paints the first
  // frame, which left a one-frame gap where the modal was visible but
  // the map's GPU-composited layer wasn't hidden yet — a shorter, partial
  // version of the same flicker. useLayoutEffect runs synchronously
  // before paint, so body gets 'ag-modal-open' before anything is drawn.
  useLayoutEffect(() => {
    if (!show) return undefined;
    const { overflow, position, top, width } = document.body.style;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    // Reference-counted rather than a plain add/remove so two modals open
    // at once (e.g. a confirm dialog on top of another) don't have the
    // second one's close wrongly un-hide GPU-layered content (see the
    // body.ag-modal-open rule in styles/extra.css) while the first is
    // still open.
    const openCount = (parseInt(document.body.dataset.agModalOpenCount, 10) || 0) + 1;
    document.body.dataset.agModalOpenCount = String(openCount);
    document.body.classList.add('ag-modal-open');

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      const remaining = (parseInt(document.body.dataset.agModalOpenCount, 10) || 1) - 1;
      if (remaining <= 0) {
        delete document.body.dataset.agModalOpenCount;
        document.body.classList.remove('ag-modal-open');
      } else {
        document.body.dataset.agModalOpenCount = String(remaining);
      }
      // Explicit 'instant' overrides the global `html{scroll-behavior:smooth}`
      // rule (CSS smooth-scroll only applies when behavior is left as
      // 'auto'). Without this, closing the modal made the page visibly
      // glide back up to the remembered scroll position instead of
      // snapping there immediately.
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="ag-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`ag-modal-dialog ${size === 'sm' ? 'sm' : ''}`}>
        <div className="ag-modal-content">
          <div className="ag-modal-header" style={headerStyle}>
            <h5 className="ag-modal-title">
              {icon && <i className={`bi ${icon}`} />} {title}
            </h5>
            <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="ag-modal-body">{children}</div>
          {footer && <div className="ag-modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}