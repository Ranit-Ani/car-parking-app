import { Link } from 'react-router-dom';
import PublicPageLayout from '../../components/PublicPageLayout';

const STATS = [
  ['Multi-location', 'One account for every site', 'bi-geo-alt-fill'],
  ['Real-time', 'Live slot availability', 'bi-lightning-charge-fill'],
  ['1 hour', 'Check-in window per booking', 'bi-clock-history'],
  ['24 / 7', 'Book any time, anywhere', 'bi-globe2'],
];
const STEPS = [
  ['bi-person-plus', 'Create your account', 'Sign up in under a minute and verify with a one-time code sent to your email.'],
  ['bi-geo-alt', 'Find nearby parking', 'Browse connected locations on a live map and see exactly how many slots are free.'],
  ['bi-calendar-check', 'Book instantly', 'Pick a slot and your vehicle. You get a QR code immediately.'],
  ['bi-qr-code-scan', 'Scan, park & go', 'Staff scan your QR at the gate; billing is automatic when you check out.'],
];
const FEATURES = [
  ['bi-map', 'Live location map', 'Discover parking near you with distance, availability and navigation in one place.'],
  ['bi-shield-check', 'Secure by design', 'Email OTP verification, hashed passwords and role-based access protect every account.'],
  ['bi-receipt', 'Fair, automatic billing', 'Transparent minimum 1-hour round-up pricing, with a receipt for every trip.'],
  ['bi-car-front', 'Multiple vehicles', 'Save all your vehicles with validated registration numbers and choose one per booking.'],
  ['bi-robot', 'AI assistant', 'Ask about bookings, policies or your saved vehicles and get instant answers.'],
  ['bi-phone', 'Works everywhere', 'Responsive on desktop, tablet and mobile — with a native Android app.'],
];
const ROLES = [
  ['bi-person', 'For Drivers', ['Find and book slots in seconds', 'Track active and past bookings', 'Download receipts and QR codes']],
  ['bi-person-badge', 'For Staff', ['Fast QR and manual check-in', 'One-tap check-out and billing', 'Live view of the location\'s slots']],
  ['bi-speedometer2', 'For Admins', ['Manage locations, slots and users', 'Revenue dashboards per location', 'Full oversight of every booking']],
];
const VALUES = [
  ['Simplicity', 'Parking should take seconds, not minutes of circling and guessing.'],
  ['Transparency', 'Clear availability, clear pricing, clear rules. No surprises at the exit.'],
  ['Privacy', 'We collect only what we need and we never sell your data.'],
  ['Reliability', 'Atomic bookings and automatic expiry mean no double-booked slots.'],
];

export default function About() {
  return (
    <PublicPageLayout icon="bi-info-circle" eyebrow="ABOUT PARKPOINT" title="Parking, made effortless"
      subtitle="ParkPoint is a multi-location parking network that lets you find, book and pay for a spot anywhere in the network with a single account.">
      <section className="pp-stats">
        {STATS.map(([big, small, ic]) => (
          <div key={big} className="pp-stat"><i className={`bi ${ic}`} /><strong>{big}</strong><span>{small}</span></div>
        ))}
      </section>

      <section className="pp-section pp-split">
        <div>
          <div className="pp-kicker">OUR STORY</div>
          <h2>Why we built ParkPoint</h2>
        </div>
        <div className="pp-prose">
          <p>Finding parking usually means a different app, a different account and a lot of guesswork for every site. ParkPoint replaces that with one connected network: sign in once, see live availability across every location, and reserve a slot before you arrive.</p>
          <p>For the people running the locations, ParkPoint brings check-ins, check-outs, billing and reporting into one real-time dashboard, so staff spend less time on paperwork and more time helping drivers.</p>
          <p>Our goal is simple: make finding a parking spot as effortless as parking itself.</p>
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-kicker center">HOW IT WORKS</div>
        <h2 className="center">From search to exit in four steps</h2>
        <div className="pp-grid-4">
          {STEPS.map(([ic, t, d], i) => (
            <div key={t} className="pp-card"><span className="pp-step">{i + 1}</span><i className={`bi ${ic} pp-card-icon`} /><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-kicker center">FEATURES</div>
        <h2 className="center">Everything you need, nothing you don't</h2>
        <div className="pp-grid-3">
          {FEATURES.map(([ic, t, d]) => (
            <div key={t} className="pp-card"><i className={`bi ${ic} pp-card-icon`} /><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-kicker center">BUILT FOR EVERYONE</div>
        <h2 className="center">One platform, three experiences</h2>
        <div className="pp-grid-3">
          {ROLES.map(([ic, t, list]) => (
            <div key={t} className="pp-card"><i className={`bi ${ic} pp-card-icon`} /><h3>{t}</h3>
              <ul className="pp-check">{list.map((x) => <li key={x}><i className="bi bi-check2-circle" />{x}</li>)}</ul></div>
          ))}
        </div>
      </section>

      <section className="pp-section">
        <div className="pp-kicker center">OUR VALUES</div>
        <h2 className="center">What we stand for</h2>
        <div className="pp-grid-4">
          {VALUES.map(([t, d]) => (<div key={t} className="pp-card"><h3>{t}</h3><p>{d}</p></div>))}
        </div>
      </section>

      <section className="pp-cta">
        <h2>Ready to park smarter?</h2>
        <p>Join the network and book your first spot in minutes.</p>
        <div className="pp-cta-actions">
          <Link to="/register" className="btn-ag primary lg"><i className="bi bi-rocket-takeoff" /> Create Account</Link>
          <Link to="/help" className="btn-ag ghost lg"><i className="bi bi-life-preserver" /> Talk to Support</Link>
        </div>
      </section>
    </PublicPageLayout>
  );
}
