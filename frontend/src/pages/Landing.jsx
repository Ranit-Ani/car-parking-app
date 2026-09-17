import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import HelpSupportModal from '../components/HelpSupportModal';
import LegalModal from '../components/LegalModal';
import { apiRequest, getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';
import { useRevalidate } from '../lib/useRevalidate';

export default function Landing() {
  const [stats, setStats] = useState({ total: '--', avail: '--', occ: '--' });
  const [legalOpen, setLegalOpen] = useState(null); // 'about' | 'privacy' | 'terms' | null
  const [helpOpen, setHelpOpen] = useState(false);

  // Checked during render (not in an effect) so a logged-in user is sent
  // straight to <Navigate> before the landing markup ever paints — an
  // effect-based redirect only fires *after* the first paint, which is
  // what caused the landing page to flash for a moment on every load. This
  // reads straight from localStorage (via AuthContext's own synchronous
  // seed, mirrored here), so it holds even on an offline cold start: a
  // saved session redirects a logged-in person to their dashboard with no
  // network required.
  const token = getToken();
  const user = getUser();
  const authenticated = !!(token && user);

  const loadStats = useCallback(async () => {
    const d = await apiRequest('/slots/stats');
    if (d && d.success) {
      setStats({
        total: d.data.total,
        avail: d.data.Available || 0,
        occ: (d.data.Booked || 0) + (d.data.Occupied || 0),
      });
    }
    // If this fails (e.g. offline), stats simply stay whatever they were —
    // useRevalidate() below retries automatically once connectivity is back.
  }, []);

  useEffect(() => {
    if (authenticated) return; // redirecting below; skip the stats fetch
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The device may well have been offline when the effect above ran, so
  // the stats fetch silently failed and the numbers stayed at '--'.
  // Without this, the only way they'd ever appear was navigating away and
  // back (remounting the page) once a connection existed — refetch the
  // instant the network (or the app itself) comes back while this page is
  // still open instead.
  useRevalidate(loadStats, { enabled: !authenticated });

  if (authenticated) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return (
    <>
      <ThreeBackground />

      <nav className="pub-nav">
        <Link className="pub-nav-brand" to="/">
          <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
          CAR PARKING NETWORK
        </Link>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <Link to="/login" className="btn-ag ghost sm">Sign In</Link>
          <Link to="/register" className="btn-ag primary sm"><i className="bi bi-person-plus" /> Sign Up</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680 }}>
          <div className="hero-badge"><span className="dot" /> MULTI-LOCATION PARKING NETWORK v2.0</div>
          <h1 className="hero-title display-title">CAR PARKING<br />AT EVERY LOCATION</h1>
          <p className="hero-sub">
            One account, every parking location. Discover nearby available slots, book your preferred space
            instantly, and manage your parking with ease. Enjoy real-time availability and automated billing
            across every location in the network.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-ag primary lg"><i className="bi bi-rocket-takeoff" /> Join the Network</Link>
            <Link to="/login" className="btn-ag plasma lg"><i className="bi bi-shield-check" /> Authenticate</Link>
          </div>

          <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '3.5rem', flexWrap: 'wrap', animation: 'fadeUp .7s .4s both' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--plasma)' }}>{stats.total}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>Total Slots</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--aurora)' }}>{stats.avail}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>Available</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--nova)' }}>{stats.occ}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>In Use</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, paddingBottom: '1rem' }}>
        <div className="feature-grid">
          <div className="feature-card s1">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-geo-alt-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Multiple Locations</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Every location is on the map with live availability, address, and turn-by-turn navigation.</p>
          </div>
          <div className="feature-card s2">
            <div className="feature-icon" style={{ background: 'rgba(0,255,179,.08)', color: 'var(--aurora)' }}><i className="bi bi-compass-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Find Nearby Parking</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Geo-aware search surfaces the closest location with an open slot, wherever you are.</p>
          </div>
          <div className="feature-card s3">
            <div className="feature-icon" style={{ background: 'rgba(139,92,246,.1)', color: '#a78bfa' }}><i className="bi bi-shield-lock-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>One Account, Every Location</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Sign in once with email OTP verification and book at any location in the network.</p>
          </div>
          <div className="feature-card s4">
            <div className="feature-icon" style={{ background: 'rgba(255,184,0,.08)', color: 'var(--solar)' }}><i className="bi bi-calculator-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Zero-Error Billing</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Min 1-hour, auto round-up billing engine, consistent across every location. No disputes.</p>
          </div>
          <div className="feature-card s5">
            <div className="feature-icon" style={{ background: 'rgba(255,71,87,.08)', color: '#ff4757' }}><i className="bi bi-clock-history" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Full Booking History</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Track every booking, check-in/out time, and receipt across all locations, in one place.</p>
          </div>
          <div className="feature-card s6">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-diagram-3-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Role-Based Portals</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Dedicated dashboards for drivers, per-location staff check-in/out, and admins overseeing every site.</p>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, padding: '4rem 1.5rem 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', animation: 'fadeUp .65s ease both' }}>
          <h2 className="hero-title display-title" style={{ fontSize: 'clamp(1.5rem,3.5vw,2.4rem)', marginBottom: '.9rem' }}>
            Ready to Park Smarter?
          </h2>
          <p className="hero-sub" style={{ marginBottom: '2.2rem' }}>
            Join users who choose ParkPoint for a faster, simpler, and smarter parking experience.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn-ag primary lg">
              <i className="bi bi-p-square-fill" /> Book Your First Slot
            </Link>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, padding: '3rem 1.5rem 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', animation: 'fadeUp .65s ease both' }}>
          <p style={{ fontSize: '.95rem', color: 'var(--t2)', lineHeight: 1.8 }}>
            Smartly find, book, and manage parking spaces with ParkPoint. Our platform provides a secure,
            convenient, and efficient parking experience for users, parking staff, and administrators. Users can
            discover nearby locations, check available slots, and make bookings with ease. Staff can manage slots
            and handle check-ins and check-outs, while administrators oversee locations, users, staff, and revenue
            from a centralized dashboard — all through a real-time, responsive interface across mobile, desktop,
            and tablet devices.
          </p>
        </div>
      </section>

      <section className="pub-support">
        <div className="pub-support-links">
          <button type="button" className="pub-support-link" onClick={() => setLegalOpen('about')}>About</button>
          <span className="pub-support-sep">&bull;</span>
          <button type="button" className="pub-support-link" onClick={() => setHelpOpen(true)}>Help &amp; Support</button>
          <span className="pub-support-sep">&bull;</span>
          <button type="button" className="pub-support-link" onClick={() => setLegalOpen('privacy')}>Privacy Policy</button>
          <span className="pub-support-sep">&bull;</span>
          <button type="button" className="pub-support-link" onClick={() => setLegalOpen('terms')}>Terms &amp; Conditions</button>
        </div>
      </section>

      <footer className="pub-footer">
        <div className="pub-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Car Parking Network. All rights reserved.</span>
          <span className="pub-footer-credit">Built by Ranit Pramanick</span>
        </div>
      </footer>

      {/* Public Landing page: no AI Assistant here (it's already gated to
          logged-in users only in AIChatWidget), just the plain support
          entry points below. */}
      <HelpSupportModal show={helpOpen} onClose={() => setHelpOpen(false)} />
      <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />
    </>
  );
}