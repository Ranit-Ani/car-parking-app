import Modal from './Modal';
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from './HelpSupportModal';
import { useNav } from '../context/NavContext';

/**
 * Role-based Guidelines/Usage, Help & Support, Privacy Policy and Terms &
 * Conditions for the (logged-in) Profile page.
 *
 * Help & Support here intentionally reuses the exact modal shell, the
 * `.help-issue-list` / `.help-actions` layout, and the plain-text
 * (non-clickable) list styling from the Landing page's HelpSupportModal —
 * only the copy changes per role. Guidelines/Privacy/Terms mirror the same
 * card-body-in-a-Modal look already used by LegalModal on the Landing page,
 * again only the copy changes per role. Nothing in HelpSupportModal.jsx or
 * LegalModal.jsx (the public Landing page flows) is modified.
 */

const ROLE_LABEL = { user: 'User', staff: 'Staff', admin: 'Admin' };

function labelFor(role) {
  return ROLE_LABEL[role] || 'User';
}

// ─── Guidelines / Usage ─────────────────────────────────────────────────
const GUIDELINES = {
  user: [
    'Use Nearby Parking to find locations around you and see real-time slot availability before you head out.',
    'Booking a slot reserves it for you — arrive within the check-in window so it isn\'t released back to other users.',
    'Show your booking QR code to staff at check-in; the same booking is used again at check-out.',
    'Billing is a minimum of 1 hour, auto rounded up, calculated from your actual check-in/check-out time.',
    'Save your vehicles once (with an optional nickname) so you can pick them instantly the next time you book.',
    'Track every past and current booking, along with receipts, from the Bookings page at any time.',
  ],
  staff: [
    'You only see and manage bookings and slots for your own assigned parking location.',
    'Use Check-In to confirm a driver has arrived, or QR Check-In to scan their booking QR instead of searching manually.',
    'Use Check-Out once a vehicle is leaving — this calculates the final bill from the actual parked duration automatically.',
    'Keep an eye on the check-in and check-out queues regularly during busy hours to avoid a backlog.',
    'If a vehicle overstays or a booking looks incorrect, do not edit it manually — flag it to an admin.',
    'Your account and location assignment are managed by an admin; contact one if you believe either is wrong.',
  ],
  admin: [
    'Manage every parking location from Locations — add, edit, deactivate, and set each one\'s map position.',
    'Manage slots per location from Slots, including slot type and hourly rate.',
    'Use Users to manage driver accounts, and to assign or reassign staff to a specific location.',
    'Review platform-wide and per-location revenue from the Revenue and Location Revenue dashboards.',
    'Bookings gives you full visibility across every location, not just one, for oversight and troubleshooting.',
    'Role changes, account activation/deactivation, and staff-location reassignment are admin-only actions — use them carefully, they take effect immediately.',
  ],
};

function GuidelinesModal({ role, show, onClose }) {
  const items = GUIDELINES[role] || GUIDELINES.user;
  return (
    <Modal show={show} onClose={onClose} title={`${labelFor(role)} Guidelines & Usage`} icon="bi-signpost-2">
      <p style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.65, marginBottom: '1.1rem' }}>
        A quick guide to using ParkPoint as {role === 'user' ? 'a driver' : `an${role === 'admin' ? ' admin' : ' operator'}`} on the platform.
      </p>
      <ul className="help-issue-list">
        {items.map((line) => (
          <li key={line}><i className="bi bi-dot" /> <span>{line}</span></li>
        ))}
      </ul>
    </Modal>
  );
}

// ─── Privacy Policy ─────────────────────────────────────────────────────
const PRIVACY_INTRO = {
  user: 'As a driver on ParkPoint, here is what we collect and how it\'s used.',
  staff: 'As staff on ParkPoint, here is what we collect from you and what you can see about others while working.',
  admin: 'As an admin on ParkPoint, here is what we collect from you and the responsibility that comes with the platform-wide access your role has.',
};
const PRIVACY_COLLECT = {
  user: 'your name, email address, phone number, saved vehicle details, and booking/payment history.',
  staff: 'your name, email address, phone number, your assigned parking location, and the check-in/check-out actions you perform.',
  admin: 'your name, email address, phone number, and an activity trail of the administrative actions you take (e.g. role changes, location or slot edits).',
};
const PRIVACY_ACCESS = {
  user: 'Only you and authorized staff/admins handling your bookings can see your booking details — never other users.',
  staff: 'You can see driver name, vehicle, and booking details only for bookings at your own assigned location, only as needed to check vehicles in and out.',
  admin: 'You can see user, staff, booking, and revenue data across every location — please only access what a given task needs, and never share driver personal data outside the platform.',
};

function PrivacyModal({ role, show, onClose }) {
  return (
    <Modal show={show} onClose={onClose} title={`${labelFor(role)} Privacy Policy`} icon="bi-shield-lock">
      <div style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
        <p>{PRIVACY_INTRO[role] || PRIVACY_INTRO.user}</p>
        <p><strong style={{ color: 'var(--t1)' }}>What we collect</strong> — {PRIVACY_COLLECT[role] || PRIVACY_COLLECT.user}</p>
        <p><strong style={{ color: 'var(--t1)' }}>What you can access</strong> — {PRIVACY_ACCESS[role] || PRIVACY_ACCESS.user}</p>
        <p><strong style={{ color: 'var(--t1)' }}>What we don&apos;t do</strong> — we don&apos;t sell personal data to third
          parties. Data is shared only with the service providers needed to operate the platform
          (e.g. email delivery for OTPs and receipts).</p>
        <p><strong style={{ color: 'var(--t1)' }}>Your controls</strong> — you can review and update your details from
          this Profile page at any time, and can request account deletion by contacting support.</p>
        <p style={{ marginBottom: 0 }}>This is a summary policy; contact support if you need more detail on any point.</p>
      </div>
    </Modal>
  );
}

// ─── Terms & Conditions ─────────────────────────────────────────────────
const TERMS_BODY = {
  user: (
    <>
      <p>By using ParkPoint as a driver, you agree to the following:</p>
      <p><strong style={{ color: 'var(--t1)' }}>Bookings</strong> — a slot is reserved once a booking is confirmed.
        Please arrive within the location&apos;s check-in window; unused reservations may be released back to other
        users.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Billing</strong> — billing follows a minimum 1-hour, auto round-up
        model applied consistently across all locations, calculated from actual check-in/check-out time.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Account responsibility</strong> — you&apos;re responsible for keeping
        your login credentials and OTP codes confidential, and for the accuracy of the vehicle details you
        provide.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Conduct</strong> — misuse of the platform, fraudulent bookings, or
        repeated no-shows may result in account suspension.</p>
    </>
  ),
  staff: (
    <>
      <p>By operating ParkPoint as staff, you agree to the following:</p>
      <p><strong style={{ color: 'var(--t1)' }}>Scope</strong> — you may only check bookings in and out at the
        parking location you&apos;re assigned to; do not act on bookings for other locations.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Accuracy</strong> — check-in and check-out actions should reflect the
        vehicle&apos;s actual arrival and departure time; the bill is calculated directly from what you record.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Confidentiality</strong> — driver names, vehicle numbers, and contact
        details you see while checking bookings in/out must not be shared or used outside your duties.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Conduct</strong> — misuse of your access, incorrect billing, or
        repeated errors may be reviewed by an admin and can result in account suspension.</p>
    </>
  ),
  admin: (
    <>
      <p>By administering ParkPoint, you agree to the following:</p>
      <p><strong style={{ color: 'var(--t1)' }}>Scope</strong> — your access spans every location, user, staff
        account, and revenue figure on the platform; use it only for legitimate administrative tasks.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Account & role management</strong> — role changes, staff-location
        reassignment, and account activation/deactivation take effect immediately; confirm details before applying
        them.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Data handling</strong> — user, staff, and revenue data accessed
        through the admin dashboards must not be exported or shared outside of legitimate platform operations.</p>
      <p><strong style={{ color: 'var(--t1)' }}>Conduct</strong> — misuse of administrative privileges may result in
        access being revoked.</p>
    </>
  ),
};

function TermsModal({ role, show, onClose }) {
  return (
    <Modal show={show} onClose={onClose} title={`${labelFor(role)} Terms & Conditions`} icon="bi-file-earmark-text">
      <div style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
        {TERMS_BODY[role] || TERMS_BODY.user}
        <p style={{ marginBottom: 0 }}>
          We may update these terms from time to time; continued use of the platform after a change means you accept
          the updated terms.
        </p>
      </div>
    </Modal>
  );
}

// ─── Help & Support (role-based) ────────────────────────────────────────
// Same questions a role would see as AI Assistant suggestion chips — kept
// here so the two stay in sync; see SUGGESTIONS_BY_ROLE in AIChatWidget.jsx.
const HELP_QUESTIONS = {
  user: [
    'How do I book a parking slot?',
    'Why was my booking cancelled or expired?',
    'How is my parking bill calculated?',
    'How do I add or remove a saved vehicle?',
    "I can't find my booking QR code",
    'How do I cancel a booking?',
  ],
  staff: [
    'How do I check in a booking?',
    'How do I check out a vehicle and generate the bill?',
    "The QR scanner isn't detecting a code",
    "A user's booking doesn't show in my queue",
    'What do I do if a vehicle overstays?',
    'Who do I contact for account or access issues?',
  ],
  admin: [
    'How do I add or edit a parking location?',
    'How do I add slots to a location?',
    'How do I assign or reassign staff to a location?',
    'How do I view revenue by location?',
    "How do I change a user's or staff member's role?",
    'How do I deactivate a user or staff account?',
  ],
};

const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;

function RoleHelpSupportModal({ role, show, onClose }) {
  const { openAIAssistant } = useNav();
  const questions = HELP_QUESTIONS[role] || HELP_QUESTIONS.user;

  return (
    <Modal show={show} onClose={onClose} title="Need Help?" icon="bi-life-preserver">
      <p style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.65, marginBottom: '1.3rem' }}>
        Having trouble with ParkPoint as {role === 'user' ? 'a driver' : role}? Here are common questions for your
        account — ask the AI Assistant or contact our support team and we&apos;ll help you resolve it.
      </p>

      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.68rem', fontWeight: 600, color: 'var(--t2)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.7rem' }}>
        Common Questions
      </div>
      <ul className="help-issue-list">
        {questions.map((q) => (
          <li key={q}><i className="bi bi-dot" /> <span>{q}</span></li>
        ))}
      </ul>

      <div className="help-actions">
        <button
          type="button"
          className="btn-ag primary full"
          onClick={() => { onClose?.(); openAIAssistant(); }}
        >
          <i className="bi bi-stars" /> AI Assistant
        </button>
        <a href={mailtoHref} className="btn-ag ghost full">
          <i className="bi bi-envelope-at" /> Email Support
        </a>
      </div>
    </Modal>
  );
}

export { GuidelinesModal, PrivacyModal, TermsModal, RoleHelpSupportModal };
