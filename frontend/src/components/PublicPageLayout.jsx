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
export default function PublicPageLayout({ title, subtitle, children }) {
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

      <main className="pp-main pp-doc">
        <h1 className="pp-title">{title}</h1>
        {subtitle && <p className="pp-lead">{subtitle}</p>}
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

/** Plain formal legal document: numbered headings with paragraphs and lists. */
export function LegalDoc({ updated, sections }) {
  return (
    <>
      <p className="pp-updated">Last updated: {updated}</p>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id}>
          <h2>{i + 1}. {s.title}</h2>
          {s.paras?.map((p, k) => <p key={k}>{p}</p>)}
          {s.items && <ul>{s.items.map((it, k) => <li key={k}>{it}</li>)}</ul>}
          {s.after && <p>{s.after}</p>}
        </section>
      ))}
      <h2>Contact</h2>
      <p>If you have any questions about this document, please contact us through the <Link to="/help">Help &amp; Support</Link> page.</p>
    </>
  );
}
