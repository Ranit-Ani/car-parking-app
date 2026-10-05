import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import HeroCar from '../components/HeroCar';
import HelpSupportModal from '../components/HelpSupportModal';
import LegalModal from '../components/LegalModal';
import { apiRequest, getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';
import { useRevalidate } from '../lib/useRevalidate';

/**
 * Landing-page effects (ported from the portfolio):
 *  1. Scroll reveal  - any element with class `.reveal` fades/slides in once
 *     when it scrolls into view (IntersectionObserver, no library needed).
 *  2. Spotlight      - any element with class `.spot` gets a soft glow that
 *     follows the mouse while hovering it (drives --mx / --my CSS vars).
 */
function useLandingFx(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    /* ── scroll reveal ── */
    const items = Array.from(document.querySelectorAll('.reveal'));
    let io = null;
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-visible'));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add('is-visible');
              io.unobserve(en.target); // animate only once
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
      );
      items.forEach((el) => io.observe(el));
    }

    /* ── spotlight that follows the cursor ── */
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const card = e.target && e.target.closest ? e.target.closest('.spot') : null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      if (io) io.disconnect();
      document.removeEventListener('pointermove', onMove);
    };
  }, [enabled]);
}

// Scroll-reveal + cursor-spotlight styles (kept in this file so Landing.jsx is self-contained).
const LANDING_FX_CSS = `
/* ───────── Scroll reveal ───────── */
.reveal.reveal{
  opacity:0;
  translate:0 34px;
  transition:
    opacity .7s cubic-bezier(.22,.8,.3,1) var(--rd,0s),
    translate .7s cubic-bezier(.22,.8,.3,1) var(--rd,0s),
    transform .3s, border-color .3s, box-shadow .3s;
  animation:none;
  will-change:opacity,translate;
}
.reveal.reveal-left{translate:-44px 0}
.reveal.reveal-right{translate:44px 0}
.reveal.reveal-zoom{translate:0 24px;scale:.96}
.reveal.reveal.is-visible{opacity:1;translate:0 0;scale:1;will-change:auto}

/* stagger children one after another */
.reveal-stagger>.reveal:nth-child(1){--rd:0s}
.reveal-stagger>.reveal:nth-child(2){--rd:.09s}
.reveal-stagger>.reveal:nth-child(3){--rd:.18s}
.reveal-stagger>.reveal:nth-child(4){--rd:.27s}
.reveal-stagger>.reveal:nth-child(5){--rd:.36s}
.reveal-stagger>.reveal:nth-child(6){--rd:.45s}

/* ───────── Cursor spotlight on cards ───────── */
.spot{position:relative;isolation:isolate}
.spot::before{
  content:"";position:absolute;inset:0;z-index:-1;
  border-radius:inherit;pointer-events:none;
  opacity:0;transition:opacity .3s;
  background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),var(--spot,rgba(0,240,255,.16)),transparent 70%);
}
@media (hover:hover){
  .spot:hover::before{opacity:1}
}

/* Mobile/tablet: no sideways slide (it caused horizontal scrolling) - rise from below instead */
@media (max-width:900px){
  .reveal.reveal.reveal-left,.reveal.reveal.reveal-right{translate:0 28px}
}
/* Mobile: breathing room between the "Ready to Park Smarter?" CTA and the FAQ */
@media (max-width:860px){
  .lp-split.lp-split{gap:3.5rem}
  .lp-cta.lp-cta{padding-bottom:.5rem}
  .lp-cta .hero-actions{margin-bottom:0}
}
/* Never let reveal offsets create a horizontal scrollbar */
.pub-body{overflow-x:clip}
html,body{max-width:100%;overflow-x:hidden}

@media (prefers-reduced-motion:reduce){
  .reveal.reveal{opacity:1;translate:none;scale:1;transition:none}
  .spot::before{display:none}
}
`;

export default function Landing() {
  const [stats, setStats] = useState({ total: '--', avail: '--', occ: '--' });
  const [legalOpen, setLegalOpen] = useState(null); // 'about' | 'privacy' | 'terms' | null
  const [helpOpen, setHelpOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

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

  // Scroll-reveal + cursor spotlight for the sections below the hero.
  useLandingFx(!authenticated);

  if (authenticated) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return (
    <>
      <style>{LANDING_FX_CSS}</style>
      <nav className="pub-nav">
        <Link className="pub-nav-brand" to="/">
          <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
          ParkPoint
        </Link>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <Link to="/login" className="btn-ag ghost sm">Sign In</Link>
          <Link to="/register" className="btn-ag primary sm"><i className="bi bi-person-plus" /> Sign Up</Link>
        </div>
      </nav>

      <main className="pub-body">
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-badge"><span className="dot" /> MULTI-LOCATION PARKING NETWORK v2.0</div>
            <h1 className="hero-title display-title">CAR PARKING<br />AT EVERY LOCATION</h1>
            <p className="hero-sub">
              One account, every parking location. Discover nearby available slots, book your preferred space
              instantly, and take control of your parking with ease. Enjoy real-time availability and automated billing
              across every location in the network.
            </p>
            <div className="hero-actions">
              <Link to="/login" className="btn-ag plasma lg"><i className="bi bi-shield-check" /> Authenticate</Link>
              <Link to="/register" className="btn-ag primary lg"><i className="bi bi-rocket-takeoff" /> Join the Network</Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-car">
              <HeroCar />
            </div>
            <div className="hero-stats">
              <div>
                <div className="font-orbit hero-stat-num" style={{ color: 'var(--plasma)' }}>{stats.total}</div>
                <div className="hero-stat-label">Total Slots</div>
              </div>
              <div>
                <div className="font-orbit hero-stat-num" style={{ color: 'var(--aurora)' }}>{stats.avail}</div>
                <div className="hero-stat-label">Available</div>
              </div>
              <div>
                <div className="font-orbit hero-stat-num" style={{ color: 'var(--nova)' }}>{stats.occ}</div>
                <div className="hero-stat-label">In Use</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, paddingBottom: '1rem' }}>
        <div className="feature-grid reveal-stagger">
          <div className="feature-card spot reveal s1">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-geo-alt-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Multiple Locations</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Every location is on the map with live availability, address, and turn-by-turn navigation.</p>
          </div>
          <div className="feature-card spot reveal s2">
            <div className="feature-icon" style={{ background: 'rgba(0,255,179,.08)', color: 'var(--aurora)' }}><i className="bi bi-compass-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Find Nearby Parking</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Geo-aware search surfaces the closest location with an open slot, wherever you are.</p>
          </div>
          <div className="feature-card spot reveal s3">
            <div className="feature-icon" style={{ background: 'rgba(139,92,246,.1)', color: '#a78bfa' }}><i className="bi bi-shield-lock-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>One Account, Every Location</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Sign in once with email OTP verification and book at any location in the network.</p>
          </div>
          <div className="feature-card spot reveal s4">
            <div className="feature-icon" style={{ background: 'rgba(255,184,0,.08)', color: 'var(--solar)' }}><i className="bi bi-calculator-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Zero-Error Billing</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Min 1-hour, auto round-up billing engine, consistent across every location. No disputes.</p>
          </div>
          <div className="feature-card spot reveal s5">
            <div className="feature-icon" style={{ background: 'rgba(255,71,87,.08)', color: '#ff4757' }}><i className="bi bi-clock-history" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Full Booking History</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Track every booking, check-in/out time, and receipt across all locations, in one place.</p>
          </div>
          <div className="feature-card spot reveal s6">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-diagram-3-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Role-Based Portals</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Dedicated dashboards for drivers, per-location staff check-in/out, and admins overseeing every site.</p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-section">
        <div className="lp-head reveal">
          <h2 className="lp-title display-title">From Search to Parked in 4 Steps</h2>
          <p className="lp-lead">No queues, no guesswork. Here is what a typical visit looks like.</p>
        </div>
        <div className="lp-steps reveal-stagger">
          {[
            ['01', 'bi-person-check-fill', 'Create Your Account', 'Sign up once and verify with an email OTP. Your single account works at every location.'],
            ['02', 'bi-geo-alt-fill', 'Find a Location', 'Browse the map or use Nearby Parking to see live availability and get turn-by-turn navigation.'],
            ['03', 'bi-calendar-check-fill', 'Book Your Slot', 'Pick a free slot, enter your vehicle details and confirm. The slot is reserved for you instantly.'],
            ['04', 'bi-qr-code-scan', 'Park & Check Out', 'Check in with your QR code, park, and pay through automated billing when you leave.'],
          ].map(([n, icon, t, d]) => (
            <div className="lp-step spot reveal" key={n}>
              <div className="lp-step-num font-orbit">{n}</div>
              <div className="lp-step-icon"><i className={`bi ${icon}`} /></div>
              <h5>{t}</h5>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HIGHLIGHT BAND ── */}
      <section className="lp-section">
        <div className="lp-band spot reveal reveal-zoom">
          <div className="lp-band-item">
            <i className="bi bi-lightning-charge-fill" style={{ color: 'var(--plasma)' }} />
            <div className="font-orbit lp-band-big">Real-time</div>
            <div className="lp-band-small">Slot availability updates live</div>
          </div>
          <div className="lp-band-item">
            <i className="bi bi-qr-code" style={{ color: 'var(--aurora)' }} />
            <div className="font-orbit lp-band-big">QR Check-in</div>
            <div className="lp-band-small">Fast entry and exit for drivers</div>
          </div>
          <div className="lp-band-item">
            <i className="bi bi-robot" style={{ color: '#a78bfa' }} />
            <div className="font-orbit lp-band-big">AI Assistant</div>
            <div className="lp-band-small">Instant help once you sign in</div>
          </div>
          <div className="lp-band-item">
            <i className="bi bi-phone-fill" style={{ color: 'var(--solar)' }} />
            <div className="font-orbit lp-band-big">Any Device</div>
            <div className="lp-band-small">Mobile, tablet and desktop ready</div>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR EVERYONE ── */}
      <section className="lp-section">
        <div className="lp-head reveal">
          <h2 className="lp-title display-title">One Platform, Three Portals</h2>
          <p className="lp-lead">Every role gets a dashboard designed around what they actually need to do.</p>
        </div>
        <div className="lp-roles reveal-stagger">
          {[
            ['Drivers', 'bi-car-front-fill', 'var(--plasma)', ['Discover nearby locations on the map', 'Book a slot in a few taps', 'Track every booking and receipt', 'Navigate straight to the location']],
            ['Staff', 'bi-person-badge-fill', 'var(--aurora)', ['Check vehicles in and out', 'Scan driver QR codes', 'Manage slots at their location', 'See live bookings as they happen']],
            ['Admins', 'bi-speedometer2', '#a78bfa', ['Oversee every location in one place', 'Manage users, staff and slots', 'Monitor bookings and revenue', 'Per-location revenue breakdown']],
          ].map(([name, icon, color, items]) => (
            <div className="lp-role spot reveal" key={name}>
              <div className="lp-role-icon" style={{ color }}><i className={`bi ${icon}`} /></div>
              <h4 style={{ color }}>{name}</h4>
              <ul>
                {items.map((it) => (
                  <li key={it}><i className="bi bi-check2-circle" style={{ color }} /> {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── BILLING ── */}
      <section className="lp-section">
        <div className="lp-billing">
          <div className="lp-billing-copy reveal reveal-left">
            <h2 className="lp-title display-title" style={{ textAlign: 'left' }}>Pay for What You Use, Nothing More</h2>
            <p className="lp-lead" style={{ textAlign: 'left', margin: '0 0 1.2rem' }}>
              Billing is calculated automatically from your check-in and check-out time, using the same rules at every
              location, so the amount you see is the amount you pay.
            </p>
            <ul className="lp-billing-list">
              <li><i className="bi bi-check2-circle" /> Minimum charge of 1 hour</li>
              <li><i className="bi bi-check2-circle" /> Time is rounded up to the next full hour</li>
              <li><i className="bi bi-check2-circle" /> Same billing engine across the whole network</li>
              <li><i className="bi bi-check2-circle" /> Receipts saved in your booking history</li>
            </ul>
          </div>
          <div className="lp-billing-card spot reveal reveal-right">
            <div className="lp-billing-row"><span>Parked for</span><b>25 minutes</b><em>billed as 1 hour</em></div>
            <div className="lp-billing-row"><span>Parked for</span><b>1 h 10 min</b><em>billed as 2 hours</em></div>
            <div className="lp-billing-row"><span>Parked for</span><b>3 h 00 min</b><em>billed as 3 hours</em></div>
            <div className="lp-billing-note">Examples of the round-up rule. Your location's hourly rate applies.</div>
          </div>
        </div>
      </section>

      {/* ── CTA (left) + FAQ (right) ── */}
      <section className="lp-section">
        <div className="lp-split">
          <div className="lp-cta reveal reveal-left">
            <h2 className="lp-title display-title" style={{ textAlign: 'left' }}>Ready to Park Smarter?</h2>
            <p className="lp-lead" style={{ textAlign: 'left', margin: '0 0 2rem' }}>
              Join users who choose ParkPoint for a faster, simpler, and smarter parking experience.
            </p>
            <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
              <Link to="/login" className="btn-ag primary lg">
                <i className="bi bi-p-square-fill" /> Book Your First Slot
              </Link>
            </div>
          </div>

          <div className="lp-faq-col">
            <h3 className="lp-faq-title reveal">Frequently Asked Questions</h3>
            <div className="lp-faq reveal-stagger">
              {[
                ['Do I need a separate account for each location?', 'No. One account works at every location in the network. Sign in once and book anywhere.'],
                ['How do I sign in?', 'Register with your email and verify it with a one-time password (OTP). After that you can sign in and manage everything from your dashboard.'],
                ['How is my parking fee calculated?', 'From your check-in to your check-out time, with a minimum of 1 hour and the time rounded up to the next full hour. The rule is the same at every location.'],
                ['Can I see my past bookings?', 'Yes. Your booking history shows each booking, its check-in and check-out time and your receipt, across all locations.'],
                ['Is there help if I get stuck?', 'Use Help & Support at the bottom of this page. Once you are signed in, the AI Assistant can also answer questions about parking and bookings.'],
              ].map(([q, a], i) => (
                // The scroll-reveal class lives on a wrapper with a STATIC className.
                // Putting it on the item itself broke the FAQ: its className changes on
                // every click, and React rewrote it, wiping the 'is-visible' class and
                // hiding the card again.
                <div className="reveal" key={q}>
                  <div className={`lp-faq-item spot${faqOpen === i ? ' open' : ''}`}>
                    <button type="button" className="lp-faq-q" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} aria-expanded={faqOpen === i}>
                      <span>{q}</span>
                      <i className="bi bi-chevron-down" />
                    </button>
                    {faqOpen === i && <div className="lp-faq-a">{a}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-about">
        <p className="reveal">
          Smartly find, book, and manage parking spaces with ParkPoint. Our platform provides a secure,
          convenient, and efficient parking experience for users, staff, and administrators. Users can
          discover nearby locations, check available slots, and make bookings with ease. Staff can manage slots
          and handle check-ins and check-outs, while administrators oversee locations, users, staff, and revenue
          from a centralized dashboard — all through a real-time, responsive interface across mobile, desktop,
          and tablet devices.
        </p>
      </section>

      </main>

      <div className="pub-footer-zone">
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
      </div>

      {/* Public Landing page: no AI Assistant here (it's already gated to
          logged-in users only in AIChatWidget), just the plain support
          entry points below. */}
      <HelpSupportModal show={helpOpen} onClose={() => setHelpOpen(false)} />
      <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />
    </>
  );
}