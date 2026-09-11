const { Server } = require('socket.io');

let io = null;

/**
 * Attach Socket.io to the existing HTTP server.
 * Call this once from server.js after creating the http server.
 */
// Same comma-separated CORS_ORIGIN list used in server.js, so the Android
// app's WebView origin (capacitor://localhost / https://localhost) can open
// a socket connection too, not just the Render web origin.
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS: ' + origin));
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Optional: let clients join a room for their role, so admin-only
    // events don't need to be broadcast to every single user. Staff also
    // join a room scoped to their assigned parking location
    // (`loc:<locationId>`) so multi-location booking events (new booking,
    // cancellation, expiry) only reach the staff who should see them —
    // see BookingService's staffBroadcastTargets(). Each client also joins
    // a room scoped to their own account id (`user:<userId>`), which lets
    // the backend push a message straight at one specific logged-in user
    // — currently used to instantly notify someone the moment an admin
    // changes their role/location or deactivates their account (see
    // AdminService's invalidateUserSession helper), instead of them only
    // finding out on their next API call.
    const LOCATION_ROOM = /^loc:[a-f0-9]{24}$/i;
    const USER_ROOM = /^user:[a-f0-9]{24}$/i;
    socket.on('join', (room) => {
      if (['admin', 'staff', 'user'].includes(room) || LOCATION_ROOM.test(room) || USER_ROOM.test(room)) {
        socket.join(room);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
}

/**
 * Get the io instance from anywhere in the backend (controllers, services).
 * Throws if called before initSocket() — that would be a setup bug.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket(server) first.');
  }
  return io;
}

module.exports = { initSocket, getIO };
