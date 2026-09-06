import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { statusClass } from '../lib/utils';

/** Status pill, mirrors statusBadge(s) from app.js */
export function StatusBadge({ status }) {
  return <span className={`ag-badge ${statusClass(status)}`}>{status}</span>;
}

/** Dashboard stat tile: colored icon + label + value */
export function StatCard({ color, label, value, icon }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        <div className={`stat-icon ${color}`}><i className={`bi ${icon}`} /></div>
      </div>
    </div>
  );
}

/** Button that shows a spinner + "Processing..." while busy */
export function ActionButton({ busy, busyLabel = 'Processing...', className = '', children, ...rest }) {
  return (
    <button className={className} disabled={busy} {...rest}>
      {busy ? (<><span className="spinner-border-sm" /> {busyLabel}</>) : children}
    </button>
  );
}

/**
 * Kebab ("⋮") button that opens a small dropdown of row actions — used in
 * table "Actions" columns instead of a row of separate buttons.
 * items: [{ label, icon, onClick, tone: 'default' | 'danger', disabled }]
 */
export function RowActionsMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const computeCoords = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 176; // matches minWidth below
    // Align the menu's right edge to the button's right edge, but keep it
    // fully on-screen (useful on narrow / mobile viewports).
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setCoords({ top: rect.bottom + 6, left });
  };

  useEffect(() => {
    if (!open) return undefined;
    computeCoords();
    function onDocClick(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onReposition() { computeCoords(); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn-ag ghost sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
      >
        <i className="bi bi-three-dots-vertical" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed', top: coords.top, left: coords.left, minWidth: '11rem', zIndex: 1000,
            background: 'var(--card)', border: '1px solid var(--t4)', borderRadius: '10px',
            boxShadow: 'var(--shadow-float)', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0.3rem',
          }}
        >
          {items.filter(Boolean).map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', borderRadius: '7px', padding: '0.5rem 0.6rem',
                fontSize: '0.8rem', cursor: it.disabled ? 'not-allowed' : 'pointer',
                color: it.tone === 'danger' ? 'var(--nova, #ff3c78)' : 'var(--t1)',
                opacity: it.disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {it.icon && <i className={`bi ${it.icon}`} />}
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/** Empty-state placeholder shown inside tables/grids */
export function EmptyState({ icon = 'bi-inbox', children }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} />
      <p>{children}</p>
    </div>
  );
}