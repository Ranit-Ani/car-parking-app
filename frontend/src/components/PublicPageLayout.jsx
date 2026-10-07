import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';

// Shared footer link columns — used by every public info page and the Landing page.
export const FOOTER_COLS = [
  { title: 'Company', links: [{ to: '/about', text: 'About Us' }, { to: '/help', text: 'Help & Support' }] },
  { title: 'Legal', links: [{ to: '/privacy', text: 'Privacy Policy' }, { to: '/terms', text: 'Terms & Conditions' }] },
  { title: 'Get Started', links: [{ to: '/login', text: 'Sign In' }, { to: '/register', text: 'Create Account' }] },
];


/**
 * Decides whether the nav links fit between the brand and the CTA buttons.
 * If they fit -> stay in that gap (centered). If not -> `stacked` = true and the
 * links drop to their own centered row below. Works for any screen width.
 */
function useNavStacked() {
  const navRef = useRef(null);
  const brandRef = useRef(null);
  const linksRef = useRef(null);
  const ctaRef = useRef(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current, brand = brandRef.current, links = linksRef.current, cta = ctaRef.current;
    if (!nav || !brand || !links || !cta) return undefined;
    const check = () => {
      const cs = getComputedStyle(nav);
      const avail = nav.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.columnGap) || 0;
      const lcs = getComputedStyle(links);
      const lgap = parseFloat(lcs.columnGap) || 0;
      const items = Array.from(links.children);
      const linksW = items.reduce((w, el) => w + el.offsetWidth, 0) + lgap * Math.max(0, items.length - 1);
      const need = brand.offsetWidth + linksW + cta.offsetWidth + gap * 2 + 8;
      setStacked(need > avail);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(nav);
    window.addEventListener('resize', check);
    if (document.fonts?.ready) document.fonts.ready.then(check);
    return () => { ro.disconnect(); window.removeEventListener('resize', check); };
  }, []);

  return { navRef, brandRef, linksRef, ctaRef, stacked };
}

/**
 * "ParkPoint" brand link used in headers/footers. Normal navigation to a
 * different page; but if you are already on the target page, a plain <Link>
 * does nothing - so scroll smoothly to the top instead.
 */
export function BrandLink({ to = '/', children, innerRef }) {
  const { pathname } = useLocation();
  const onClick = (e) => {
    if (pathname === to) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return <Link ref={innerRef} className="pub-nav-brand" to={to} onClick={onClick}>{children}</Link>;
}

export function PublicFooter() {
  return (
    <footer className="pp-footer">
      <div className="pp-footer-grid">
        <div className="pp-footer-brand">
          <BrandLink to="/">
            <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
            ParkPoint
          </BrandLink>
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
  const { navRef, brandRef, linksRef, ctaRef, stacked } = useNavStacked();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} — ParkPoint`;
  }, [title]);

  const links = [
    ['/about', 'About'], ['/help', 'Help & Support'], ['/privacy', 'Privacy'], ['/terms', 'Terms'],
  ];

  return (
    <div className={`pp-shell ${authed ? 'main-content' : ''}`}>
      <nav ref={navRef} className={`pp-nav ${stacked ? 'stacked' : ''}`}>
        <BrandLink innerRef={brandRef} to={authed ? homeForRole(user.role) : '/'}>
          <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
          ParkPoint
        </BrandLink>
        <div ref={linksRef} className="pp-nav-links">
          {links.map(([to, t]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{t}</NavLink>)}
        </div>
        <div ref={ctaRef} className="pp-nav-cta">
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