// ─── Shared formatting helpers (mirrors js/app.js) ─────────────────

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CLASS_MAP = {
  Available: 'available',
  Booked: 'booked',
  Occupied: 'occupied',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Expired: 'expired',
  Maintenance: 'maintenance',
};

/**
 * Name/email to show for whoever made a booking. Prefers the live user
 * account, but falls back to the name/email snapshotted on the booking at
 * creation time whenever the account is gone or has been soft-deleted
 * (account deletion anonymizes the User doc rather than removing it, so
 * booking.userId can still be a populated object with "Deleted User" /
 * a randomized email — those anonymized values should never be shown).
 */
export function bookingUserName(booking) {
  const deleted = !booking?.userId || booking.userId.isDeleted;
  return (deleted ? booking?.userName : booking?.userId?.name) || booking?.userName || '—';
}
export function bookingUserEmail(booking) {
  const deleted = !booking?.userId || booking.userId.isDeleted;
  return (deleted ? booking?.userEmail : booking?.userId?.email) || booking?.userEmail || '';
}

export function statusClass(status) {
  return STATUS_CLASS_MAP[status] || 'cancelled';
}

export const ROLE_HOME = {
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
  user: '/user/dashboard',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}
