import { Link } from 'react-router-dom';
import PublicPageLayout from '../../components/PublicPageLayout';

export default function About() {
  return (
    <PublicPageLayout
      title="About Us"
      subtitle="ParkPoint is a multi-location parking platform that allows drivers to find, book and pay for parking at any connected location using a single account."
    >
      <h2>Who We Are</h2>
      <p>Finding parking has traditionally meant using a different application, a different account and a great deal of guesswork at every site. ParkPoint replaces this with one connected network. Drivers sign in once, view real-time slot availability across all participating locations, and reserve a space before they arrive.</p>
      <p>For the people who operate the locations, ParkPoint brings check-ins, check-outs, billing and reporting together in a single real-time dashboard, so that staff can spend less time on paperwork and more time assisting drivers.</p>

      <h2>Our Mission</h2>
      <p>Our mission is to make finding a parking space as simple as parking itself, while keeping the process transparent, secure and reliable for everyone involved.</p>

      <h2>How It Works</h2>
      <ol>
        <li>Create an account and verify your email address with a one-time code.</li>
        <li>Browse nearby parking locations and check how many slots are currently available.</li>
        <li>Select a slot and a vehicle to book. A QR code is issued immediately.</li>
        <li>Present the QR code to staff at the location to check in. Billing is calculated automatically when you check out.</li>
      </ol>

      <h2>What We Offer</h2>
      <ul>
        <li>Real-time slot availability across all connected locations.</li>
        <li>Instant booking with QR-based check-in.</li>
        <li>Automatic billing with a minimum one-hour, round-up model and a receipt for every completed booking.</li>
        <li>Support for multiple saved vehicles with validated registration numbers.</li>
        <li>Email OTP verification and role-based access to protect every account.</li>
        <li>An AI assistant that answers questions about bookings and parking policies.</li>
        <li>Access from desktop, tablet and mobile devices, including an Android application.</li>
      </ul>

      <h2>Who Uses ParkPoint</h2>
      <p><strong>Drivers</strong> use ParkPoint to find and book parking, track their bookings and download receipts.</p>
      <p><strong>Staff</strong> manage check-ins and check-outs at their assigned location and view slot status in real time.</p>
      <p><strong>Administrators</strong> manage locations, slots, users and bookings, and review revenue across the network.</p>

      <h2>Our Commitments</h2>
      <ul>
        <li><strong>Transparency:</strong> clear availability, clear pricing and clear rules.</li>
        <li><strong>Privacy:</strong> we collect only the information required to operate the service and we do not sell personal data.</li>
        <li><strong>Reliability:</strong> bookings are processed atomically, so a slot cannot be booked twice.</li>
      </ul>

      <h2>Get in Touch</h2>
      <p>To start using ParkPoint, <Link to="/register">create an account</Link>. If you need assistance, please visit our <Link to="/help">Help &amp; Support</Link> page. You may also read our <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms &amp; Conditions</Link>.</p>
    </PublicPageLayout>
  );
}
