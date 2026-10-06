import { useState } from 'react';
import PublicPageLayout from '../../components/PublicPageLayout';
import { ActionButton } from '../../components/Bits';
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from '../../components/HelpSupportModal';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';

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
    <PublicPageLayout
      title="Help & Support"
      subtitle="Find answers to common questions below. If you cannot find what you need, you can send a message to our support team."
    >
      <h2>Frequently Asked Questions</h2>
      {FAQ.map(([q, a]) => (
        <div key={q}>
          <h3>{q}</h3>
          <p>{a}</p>
        </div>
      ))}

      <h2>Contact Support</h2>
      <p>
        You can email us at <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`}>{SUPPORT_EMAIL}</a> or
        use the form below. We usually respond within one to two business days. Please include your registered email
        address and any error message you see.
      </p>
      <form className="pp-form" onSubmit={send}>
        <div className="ag-input-group"><label className="ag-label">Name</label>
          <input className="ag-input" type="text" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="ag-input-group"><label className="ag-label">Email Address</label>
          <input className="ag-input" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="ag-input-group"><label className="ag-label">Message</label>
          <textarea className="ag-input" rows={5} placeholder="Describe the issue you are facing" required style={{ resize: 'vertical', minHeight: '7rem', paddingTop: '.65rem' }} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <ActionButton type="submit" busy={busy} busyLabel="Sending..." className="btn-ag primary"><i className="bi bi-send" /> Send Message</ActionButton>
      </form>
    </PublicPageLayout>
  );
}
