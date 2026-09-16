import Modal from './Modal';

// Shared static copy for the Landing page's "About", "Privacy Policy" and
// "Terms & Conditions" links. Kept as one small modal (not separate pages)
// since there was nothing equivalent already in the app to reuse, and the
// task only calls for these to be clickable, not full standalone routes.
// Edit the text below any time — no other file needs to change.
const CONTENT = {
  about: {
    title: 'About Us',
    icon: 'bi-info-circle',
    body: (
      <>
        <p>
          Car Parking Network (ParkPoint) is a multi-location parking platform that lets you
          find, book, and pay for parking at any connected location with a single account.
        </p>
        <p>
          Instead of juggling a different app or account for every parking site, sign in once
          with email OTP verification and get real-time slot availability, instant booking,
          automated billing, and a complete booking history — wherever you park in the network.
        </p>
        <p style={{ marginBottom: 0 }}>
          Our goal is simple: make finding a parking spot as effortless as parking itself.
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    icon: 'bi-shield-lock',
    body: (
      <>
        <p>
          We collect only the information needed to run your account and bookings: your name,
          email address, phone number, vehicle details, and booking/payment history.
        </p>
        <p><strong style={{ color: 'var(--t1)' }}>How we use it</strong> — to create and secure
          your account (including OTP email verification), process bookings and billing, send
          service-related notifications, and improve the reliability of the platform.</p>
        <p><strong style={{ color: 'var(--t1)' }}>What we don't do</strong> — we don't sell your
          personal data to third parties. Data is shared only with the service providers needed
          to operate the platform (e.g. email delivery for OTPs and receipts).</p>
        <p><strong style={{ color: 'var(--t1)' }}>Your controls</strong> — you can review and
          update your details from your Profile at any time, and can request account deletion by
          contacting support.</p>
        <p style={{ marginBottom: 0 }}>
          This is a summary policy; contact support if you need more detail on any point.
        </p>
      </>
    ),
  },
  terms: {
    title: 'Terms & Conditions',
    icon: 'bi-file-earmark-text',
    body: (
      <>
        <p>By creating an account or using Car Parking Network, you agree to the following:</p>
        <p><strong style={{ color: 'var(--t1)' }}>Bookings</strong> — a slot is reserved once a
          booking is confirmed. Please arrive within the location's check-in window; unused
          reservations may be released back to other users.</p>
        <p><strong style={{ color: 'var(--t1)' }}>Billing</strong> — billing follows a minimum
          1-hour, auto round-up model applied consistently across all locations, calculated from
          actual check-in/check-out time.</p>
        <p><strong style={{ color: 'var(--t1)' }}>Account responsibility</strong> — you're
          responsible for keeping your login credentials and OTP codes confidential, and for the
          accuracy of the vehicle details you provide.</p>
        <p><strong style={{ color: 'var(--t1)' }}>Conduct</strong> — misuse of the platform,
          fraudulent bookings, or repeated no-shows may result in account suspension.</p>
        <p style={{ marginBottom: 0 }}>
          We may update these terms from time to time; continued use of the platform after a
          change means you accept the updated terms.
        </p>
      </>
    ),
  },
};

/**
 * type: 'about' | 'privacy' | 'terms' | null. Renders nothing (and closes)
 * when type is null, so a single instance can sit in Landing.jsx and just
 * be driven by whichever link was clicked.
 */
export default function LegalModal({ type, onClose }) {
  const entry = type ? CONTENT[type] : null;
  return (
    <Modal show={!!entry} onClose={onClose} title={entry?.title} icon={entry?.icon}>
      <div style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
        {entry?.body}
      </div>
    </Modal>
  );
}
