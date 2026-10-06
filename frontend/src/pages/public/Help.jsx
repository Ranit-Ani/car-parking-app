import { useState } from 'react';
import PublicPageLayout from '../../components/PublicPageLayout';
import { ActionButton } from '../../components/Bits';
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '../../components/HelpSupportModal';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';

const TOPICS = [
  ['bi-person-plus', 'Account & Sign Up', "Can't create an account, activation or registration errors."],
  ['bi-box-arrow-in-right', 'Login Issues', 'Wrong credentials, locked sessions or login errors.'],
  ['bi-key', 'Password Reset', 'Forgot your password or reset links not working.'],
  ['bi-envelope-check', 'OTP & Verification', "Didn't get the OTP, or the code was rejected."],
  ['bi-calendar-check', 'Bookings', 'Booking, cancelling, expiry and check-in questions.'],
  ['bi-receipt', 'Billing & Receipts', 'Charges, round-up pricing and downloading receipts.'],
];
const FAQ = [
  ['How do I create an account?', 'Click Sign Up, enter your details and verify your email with the one-time code we send you. Once verified you can sign in and start booking.'],
  ["I didn't receive my OTP. What should I do?", 'Check your spam or junk folder, make sure the email address is correct, and request a new code after a minute. If it still does not arrive, contact support below.'],
  ['How long is my booking held?', 'A booking is held for 1 hour. If you do not check in within that window it expires automatically and the slot is released.'],
  ['Can I cancel a booking?', 'Yes, as long as you have not checked in yet. Open My Bookings and cancel the active booking.'],
  ['How is parking billed?', 'Billing uses a minimum 1-hour, auto round-up model, calculated from your actual check-in and check-out time. A receipt is available after check-out.'],
  ['Can I add more than one vehicle?', 'Yes. Save as many vehicles as you like in your Profile and choose one each time you book.'],
  ['How do I check in?', 'Show the QR code from your booking to staff at the location. They scan it and your parking session begins.'],
  ['How do I delete my account or my data?', 'Send us a request through the contact form below and we will help you. See our Privacy Policy for details.'],
];

export default function Help() {
  const [open, setOpen] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      showToast('Please fill in your name, email and message.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest('/support/contact', {
        method: 'POST', body: { name: name.trim(), email: email.trim(), message: message.trim() },
      });
      if (data && data.success) {
        showToast(data.message || "Message sent! We'll get back to you soon.", 'success');
        setName(''); setEmail(''); setMessage('');
      } else {
        showToast((data && data.message) || 'Could not send your message. Please try Email Support instead.', 'danger');
      }
    } finally { setBusy(false); }
  };

  return (
    <PublicPageLayout icon="bi-life-preserver" eyebrow="WE'RE HERE TO HELP" title="Help & Support"
      subtitle="Find quick answers, browse common issues, or message our team directly.">
      <section className="pp-section">
        <div className="pp-kicker center">BROWSE BY TOPIC</div>
        <h2 className="center">What do you need help with?</h2>
        <div className="pp-grid-3">
          {TOPICS.map(([ic, t, d]) => (<div key={t} className="pp-card"><i className={`bi ${ic} pp-card-icon`} /><h3>{t}</h3><p>{d}</p></div>))}
        </div>
      </section>

      <section className="pp-section pp-narrow">
        <div className="pp-kicker center">FAQ</div>
        <h2 className="center">Frequently asked questions</h2>
        <div className="pp-faq">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`pp-faq-item ${open === i ? 'open' : ''}`}>
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span>{q}</span><i className="bi bi-chevron-down" />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="pp-section pp-contact">
        <div className="pp-contact-info">
          <div className="pp-kicker">CONTACT US</div>
          <h2>Still need help?</h2>
          <p>Send us a message and our support team will get back to you as soon as possible.</p>
          <div className="pp-contact-row"><i className="bi bi-envelope-at" /><div><strong>Email</strong><a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`}>{SUPPORT_EMAIL}</a></div></div>
          <div className="pp-contact-row"><i className="bi bi-clock" /><div><strong>Response time</strong><span>Usually within 1–2 business days</span></div></div>
          <div className="pp-contact-row"><i className="bi bi-lightbulb" /><div><strong>Tip</strong><span>Include your registered email and any error message you see.</span></div></div>
        </div>
        <form className="pp-contact-form" onSubmit={send}>
          <div className="ag-input-group"><label className="ag-label">Name</label>
            <div className="ag-input-icon"><i className="bi bi-person" /><input className="ag-input" type="text" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} /></div></div>
          <div className="ag-input-group"><label className="ag-label">Email Address</label>
            <div className="ag-input-icon"><i className="bi bi-at" /><input className="ag-input" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <div className="ag-input-group"><label className="ag-label">Message</label>
            <textarea className="ag-input" rows={5} placeholder="Describe the issue you're facing..." required style={{ resize: 'vertical', minHeight: '7rem', paddingTop: '.65rem' }} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          <ActionButton type="submit" busy={busy} busyLabel="Sending..." className="btn-ag primary full"><i className="bi bi-send" /> Send Message</ActionButton>
        </form>
      </section>
    </PublicPageLayout>
  );
}
