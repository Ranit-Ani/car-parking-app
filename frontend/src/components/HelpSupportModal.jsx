import { useState } from 'react';
import { ActionButton } from './Bits';
import Modal from './Modal';
import { showToast } from '../lib/toast';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@carparkingnetwork.com';
const SUPPORT_SUBJECT = 'ParkPoint Support Request';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const EMAILJS_CONFIGURED = !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

// Plain-text only, as requested — these are common categories to help a
// visitor recognize their issue before contacting support, not links to
// anywhere (the Landing page is public/unauthenticated, so there's nothing
// account-specific to route them to yet).
const COMMON_ISSUES = [
  "Can't create an account",
  'Login related issue',
  'Forgot password / password reset issue',
  'OTP or verification problem',
  'Email verification issue',
  'Account activation issue',
  'Error during registration or login',
  'Other account-related issues',
];

const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;

export default function HelpSupportModal({ show, onClose }) {
  const [view, setView] = useState('main'); // 'main' | 'contact'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const resetContactForm = () => {
    setName('');
    setEmail('');
    setMessage('');
  };

  const handleClose = () => {
    onClose?.();
    // Wait for the close transition/unmount cycle rather than resetting
    // mid-close, so the modal doesn't visibly flash back to the main view
    // before it disappears.
    setTimeout(() => {
      setView('main');
      resetContactForm();
    }, 200);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      showToast('Please fill in your name, email and message.', 'warning');
      return;
    }
    if (!EMAILJS_CONFIGURED) {
      showToast('Contact form is not set up yet — please use Email Support instead.', 'danger');
      return;
    }

    setBusy(true);
    try {
      // Loaded on demand so the Landing page's initial bundle doesn't pay
      // for the EmailJS SDK unless a visitor actually opens the form.
      const emailjs = (await import('@emailjs/browser')).default;
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { from_name: name.trim(), from_email: email.trim(), message: message.trim(), to_email: SUPPORT_EMAIL },
        { publicKey: EMAILJS_PUBLIC_KEY },
      );
      showToast("Message sent! We'll get back to you soon.", 'success');
      resetContactForm();
      setView('main');
    } catch {
      showToast('Could not send your message. Please try Email Support instead.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      show={show}
      onClose={handleClose}
      title={view === 'contact' ? 'Contact Us' : 'Need Help?'}
      icon={view === 'contact' ? 'bi-envelope' : 'bi-life-preserver'}
    >
      {view === 'main' && (
        <>
          <p style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.65, marginBottom: '1.3rem' }}>
            Having trouble accessing ParkPoint? Contact our support team and we&apos;ll help you
            resolve your issue.
          </p>

          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.68rem', fontWeight: 600, color: 'var(--t2)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.7rem' }}>
            Common Issues
          </div>
          <ul className="help-issue-list">
            {COMMON_ISSUES.map((issue) => (
              <li key={issue}><i className="bi bi-dot" /> <span>{issue}</span></li>
            ))}
          </ul>

          <div className="help-actions">
            <button type="button" className="btn-ag primary full" onClick={() => setView('contact')}>
              <i className="bi bi-chat-dots" /> Contact Us
            </button>
            <a href={mailtoHref} className="btn-ag ghost full">
              <i className="bi bi-envelope-at" /> Email Support
            </a>
          </div>
        </>
      )}

      {view === 'contact' && (
        <form onSubmit={handleSend}>
          <button
            type="button"
            onClick={() => setView('main')}
            style={{ background: 'none', border: 'none', padding: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.78rem', color: 'var(--t2)', cursor: 'pointer', fontFamily: "'Syne',sans-serif", letterSpacing: '.05em' }}
          >
            <i className="bi bi-arrow-left" /> Back
          </button>

          {!EMAILJS_CONFIGURED && (
            <p style={{ fontSize: '.78rem', color: 'var(--solar)', background: 'rgba(255,184,0,.08)', border: '1px solid rgba(255,184,0,.2)', borderRadius: '10px', padding: '.65rem .8rem', marginBottom: '1rem' }}>
              <i className="bi bi-exclamation-triangle" /> Contact form isn&apos;t configured yet — please use Email Support below instead.
            </p>
          )}

          <div className="ag-input-group">
            <label className="ag-label">Name</label>
            <div className="ag-input-icon">
              <i className="bi bi-person" />
              <input className="ag-input" type="text" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="ag-input-group">
            <label className="ag-label">Email Address</label>
            <div className="ag-input-icon">
              <i className="bi bi-at" />
              <input className="ag-input" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="ag-input-group">
            <label className="ag-label">Message</label>
            <textarea
              className="ag-input"
              placeholder="Describe the issue you're facing..."
              required
              rows={4}
              style={{ resize: 'vertical', minHeight: '6rem', paddingTop: '.65rem' }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <ActionButton type="submit" busy={busy} busyLabel="Sending..." className="btn-ag primary full">
            <i className="bi bi-send" /> Send
          </ActionButton>
        </form>
      )}
    </Modal>
  );
}
