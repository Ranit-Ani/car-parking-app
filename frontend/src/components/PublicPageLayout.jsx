import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';

// Shared footer link columns — used by every public info page and the Landing page.
export const FOOTER_COLS = [
  { title: 'Company', links: [{ to: '/about', text: 'About Us' }, { to: '/help', text: 'Help & Support' }] },
  { title: 'Legal', links: [{ to: '/privacy', text: 'Privacy Policy' }, { to: '/terms', text: 'Terms & Conditions' }] },
  { title: 'Get Started', links: [{ to: '/login', text: 'Sign In' }, { to: '/register', text: 'Create Account' }] },
];

export function PublicFooter() {
  return (
    <footer className="pp-footer">
      <div className="pp-footer-grid">
        <div className="pp-footer-brand">
          <Link className="pub-nav-brand" to="/">
            <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
            ParkPoint
          </Link>
          <p>One account, every parking location. Find, book and pay for parking across the whole network in seconds.</p>
        </div>
        {FOOTER_COLS.map((c) => (
          <div key={c.title} className="pp-footer-col">
            <h4>{c.title}</h4>
            {c.links.map((l) => <Link key={l.to} to={l.to}>{l.text}</Link>)}
          </div>
        ))}
      </div>
      <div className="pp-footer-bottom">
        <span>&copy; {new Date().getFullYear()} Car Parking Network. All rights reserved.</span>
        <span className="pub-footer-credit">Built by Ranit Pramanick</span>
      </div>
    </footer>
  );
}

/**
 * Full-page shell for About / Help / Privacy / Terms.
 * Props: icon, eyebrow, title, subtitle, children.
 * Works for both visitors and logged-in users (inside the app's sidebar layout).
 */
export default function PublicPageLayout({ icon, eyebrow, title, subtitle, children }) {
  const authed = !!(getToken() && getUser());
  const user = authed ? getUser() : null;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} — ParkPoint`;
  }, [title]);

  const links = [
    ['/about', 'About'], ['/help', 'Help & Support'], ['/privacy', 'Privacy'], ['/terms', 'Terms'],
  ];

  return (
    <div className={`pp-shell ${authed ? 'main-content' : ''}`}>
      <nav className="pp-nav">
        <Link className="pub-nav-brand" to={authed ? homeForRole(user.role) : '/'}>
          <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
          ParkPoint
        </Link>
        <div className="pp-nav-links">
          {links.map(([to, t]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{t}</NavLink>)}
        </div>
        <div className="pp-nav-cta">
          {authed ? (
            <Link to={homeForRole(user.role)} className="btn-ag primary sm"><i className="bi bi-speedometer2" /> Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ag ghost sm">Sign In</Link>
              <Link to="/register" className="btn-ag primary sm">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      <header className="pp-hero">
        <div className="pp-hero-inner">
          <div className="pp-hero-icon"><i className={`bi ${icon}`} /></div>
          <div className="hero-badge"><span className="dot" /> {eyebrow}</div>
          <h1 className="display-title">{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      <main className="pp-main">{children}</main>
      <PublicFooter />
    </div>
  );
}

/** Two-column legal layout: sticky table of contents + numbered sections. */
export function LegalDoc({ updated, sections }) {
  return (
    <div className="pp-legal">
      <aside className="pp-toc">
        <div className="pp-toc-title">On this page</div>
        {sections.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <span>{i + 1}.</span> {s.title}
          </a>
        ))}
      </aside>
      <article className="pp-doc">
        <div className="pp-updated"><i className="bi bi-clock-history" /> Last updated: {updated}</div>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id}>
            <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</h2>
            {s.paras?.map((p, k) => <p key={k}>{p}</p>)}
            {s.items && <ul>{s.items.map((it, k) => <li key={k}>{it}</li>)}</ul>}
            {s.after && <p>{s.after}</p>}
          </section>
        ))}
        <div className="pp-doc-contact">
          <i className="bi bi-envelope-paper" />
          <div>
            <strong>Questions about this document?</strong>
            <span>Reach our team any time from the <Link to="/help">Help &amp; Support</Link> page.</span>
          </div>
        </div>
      </article>
    </div>
  );
}
