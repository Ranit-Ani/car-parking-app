import PublicPageLayout, { LegalDoc } from '../../components/PublicPageLayout';

const SECTIONS = [
  { id: 'acceptance', title: 'Acceptance of Terms', paras: [
    'By creating an account or using ParkPoint (Car Parking Network), you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use the platform.' ] },
  { id: 'accounts', title: 'Accounts & Eligibility', items: [
    'You must provide accurate name, contact and vehicle information and keep it up to date.',
    'You are responsible for keeping your password and OTP codes confidential and for all activity under your account.',
    'Accounts are for individual use. Sharing, selling or transferring an account is not permitted.' ] },
  { id: 'bookings', title: 'Bookings & Check-In', items: [
    'A slot is reserved once your booking is confirmed and is held for a limited check-in window (currently 1 hour).',
    'If you do not check in within the window, the booking expires automatically and the slot is released to other users.',
    'You may hold one awaiting-check-in booking at a time. Once checked in, you may book again for another vehicle.',
    'Bookings are for immediate use; advance or scheduled reservations are not offered.',
    'A booking can be cancelled only before check-in.' ] },
  { id: 'billing', title: 'Billing & Payments', items: [
    'Billing follows a minimum 1-hour, auto round-up model applied consistently across all locations.',
    'Charges are calculated from your actual check-in and check-out time at the rate set for that location.',
    'A receipt is available for every completed booking.' ] },
  { id: 'conduct', title: 'Acceptable Use', paras: ['You agree not to:'], items: [
    'Make fraudulent, duplicate or repeated no-show bookings.',
    'Provide false vehicle numbers or impersonate another person.',
    'Interfere with, reverse-engineer or attempt to gain unauthorised access to the platform.',
    'Use the platform for any unlawful purpose or in a way that harms other users or location staff.' ],
    after: 'Violations may lead to warnings, temporary restrictions or permanent account suspension.' },
  { id: 'parking', title: 'Parking on Premises', paras: [
    'While parked at a location you must follow that location\'s rules and staff instructions. Vehicles are parked at the owner\'s risk; ParkPoint and location operators are not responsible for loss of, or damage to, vehicles or personal belongings except where required by law. Please lock your vehicle and do not leave valuables inside.' ] },
  { id: 'availability', title: 'Service Availability', paras: [
    'We work hard to keep availability real-time and accurate, but we do not guarantee uninterrupted or error-free service. Slot status may occasionally lag due to network or maintenance conditions.' ] },
  { id: 'liability', title: 'Limitation of Liability', paras: [
    'To the maximum extent permitted by law, ParkPoint is provided "as is" and is not liable for indirect or consequential losses arising from use of the platform. Nothing in these terms limits liability that cannot legally be limited.' ] },
  { id: 'termination', title: 'Suspension & Termination', paras: [
    'You may stop using ParkPoint and request account deletion at any time. We may suspend or terminate accounts that breach these terms or put the platform or other users at risk.' ] },
  { id: 'changes', title: 'Changes to These Terms', paras: [
    'We may update these terms from time to time. Continued use of the platform after a change means you accept the updated terms.' ] },
];

export default function Terms() {
  return (
    <PublicPageLayout icon="bi-file-earmark-text" eyebrow="THE GROUND RULES" title="Terms & Conditions"
      subtitle="Everything you need to know about bookings, billing and responsible use of the network.">
      <LegalDoc updated="October 2026" sections={SECTIONS} />
    </PublicPageLayout>
  );
}
