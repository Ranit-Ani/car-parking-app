import PublicPageLayout, { LegalDoc } from '../../components/PublicPageLayout';

const SECTIONS = [
  { id: 'overview', title: 'Overview', paras: [
    'This Privacy Policy explains what personal information ParkPoint (Car Parking Network) collects, why we collect it, how it is used and the choices you have. By creating an account or using the platform you agree to the practices described here.',
    'We follow a simple principle: collect only what is needed to run your account and your bookings, protect it properly, and never sell it.' ] },
  { id: 'collect', title: 'Information We Collect', paras: ['Depending on how you use the platform, we collect:'], items: [
    'Account details — your name, email address, phone number and encrypted password.',
    'Vehicle details — registration numbers, vehicle type and nicknames you save to your profile.',
    'Booking & billing data — locations, slots, check-in / check-out times, amounts charged and receipts.',
    'Location data — your device location, only when you use Nearby Parking and grant permission. You can revoke this in your device settings at any time.',
    'Profile photo — only if you choose to upload one.',
    'Technical data — device type, browser, IP address and error logs used for security and reliability.',
    'Support messages — anything you send us through the Help & Support form.' ] },
  { id: 'use', title: 'How We Use Your Information', items: [
    'Create and secure your account, including email OTP verification.',
    'Show nearby locations and real-time slot availability.',
    'Process bookings, QR check-ins, billing and receipts.',
    'Send service notifications such as booking confirmations, expiry reminders and OTP codes.',
    'Detect fraud, abuse and no-show patterns, and keep the platform secure.',
    'Respond to support requests and improve the reliability and design of the platform.' ] },
  { id: 'sharing', title: 'Sharing & Disclosure', paras: [
    'We do not sell your personal data. Information is shared only in these limited cases:' ], items: [
    'Parking staff and administrators at the location you book, who can see the booking, vehicle number and contact details needed to serve you.',
    'Service providers that help us operate the platform (for example email delivery for OTPs and receipts, hosting and map tiles), bound by confidentiality obligations.',
    'Legal or safety reasons — where required by law, court order, or to protect the rights and safety of users and the public.' ] },
  { id: 'security', title: 'Data Security', paras: [
    'Passwords are stored hashed, sessions use signed tokens, and traffic is encrypted in transit. Access to personal data is limited by role (user, staff, admin).',
    'No system is perfectly secure. If you suspect unauthorised access to your account, change your password immediately and contact support.' ] },
  { id: 'retention', title: 'Data Retention', paras: [
    'We keep account data while your account is active. Booking and billing records are retained as long as needed for receipts, dispute handling and legal or accounting obligations, after which they are deleted or anonymised.' ] },
  { id: 'rights', title: 'Your Rights & Controls', items: [
    'Access and update your details anytime from your Profile page.',
    'Manage or remove saved vehicles and your profile photo.',
    'Withdraw location permission from your device settings.',
    'Request a copy of your data or deletion of your account by contacting support.' ],
    after: 'Some records may be kept where we are legally required to do so.' },
  { id: 'children', title: "Children's Privacy", paras: [
    'ParkPoint is intended for people who are legally permitted to drive and park vehicles. We do not knowingly collect personal information from children.' ] },
  { id: 'cookies', title: 'Cookies & Local Storage', paras: [
    'We use browser local storage to keep you signed in and remember preferences. We do not use third-party advertising trackers.' ] },
  { id: 'changes', title: 'Changes to This Policy', paras: [
    'We may update this policy from time to time. When we make material changes we will update the date above, and continued use of the platform means you accept the updated policy.' ] },
];

export default function Privacy() {
  return (
    <PublicPageLayout title="Privacy Policy"
      subtitle="Clear, plain-language details on what we collect, why we collect it, and how you stay in control.">
      <LegalDoc updated="October 2026" sections={SECTIONS} />
    </PublicPageLayout>
  );
}
