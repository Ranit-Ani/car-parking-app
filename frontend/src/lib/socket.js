import { io } from 'socket.io-client';
import { getUser, triggerSessionExpired } from './api';

// One shared socket for the whole app. On Render, backend + frontend are
// served from the same origin, so io() with no URL connects to the page's
// own origin. Inside the Capacitor Android app the page is loaded from
// capacitor://localhost (no backend there), so we need to point the socket
// at the real backend explicitly via VITE_API_BASE_URL — same variable used
// by api.js. Leave it unset for the web build to keep the old behavior.
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || undefined;

let socket = null;

// Joins every room this user should hear events on. Shared by the
// 'connect' handler (fires on first connect and any reconnect) and by
// login(), below, so an account that switches identity in the same tab
// (log out -> log back in as someone else / with a new role) rejoins with
// the right rooms even though the underlying socket connection itself is
// only ever created once per page load.
function joinRoomsFor(sock, user) {
  // Join a room matching the user's role so admin-only events
  // (e.g. new bookings, revenue) don't get sent to every visitor.
  if (user?.role) sock.emit('join', user.role);
  // Multi-location support: a staff member also joins a room scoped
  // to their assigned parking location, so booking events from other
  // locations don't reach them.
  if (user?.role === 'staff' && user?.locationId) sock.emit('join', `loc:${user.locationId}`);
  // Per-account room so the backend can push a message straight at THIS
  // user specifically — currently used for instant session-termination
  // notices when an admin changes their role/location or deactivates
  // their account (see 'sessionInvalidated' below and
  // backend/services/AdminService.js).
  const uid = user?.id || user?._id;
  if (uid) sock.emit('join', `user:${uid}`);
}

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      joinRoomsFor(socket, getUser());
    });

    // Pushed by the backend the moment an admin changes this user's role
    // (or locationId) or deactivates their account — see
    // AdminService.updateUserRole / removeLocationStaff /
    // updateLocationStaff / toggleUserStatus. This is what makes the
    // forced logout instant instead of waiting for this tab's next API
    // call (a background poll, a click, etc.) to discover the token has
    // been invalidated. The REST layer (auth.middleware.js's tokenVersion
    // / isActive check) is still the actual security boundary — this is
    // purely a "notify the user right now" nicety on top of it, so a
    // missed/dropped socket event can never leave stale access in place.
    socket.on('sessionInvalidated', (payload) => {
      triggerSessionExpired(payload);
    });
  }
  return socket;
}

// Called right after a successful login (see AuthContext.login) so an
// already-connected socket immediately joins the newly-logged-in account's
// rooms, instead of only picking them up on the next reconnect.
export function rejoinSocketRooms(user) {
  if (!socket || !socket.connected) return;
  joinRoomsFor(socket, user);
}
