import jwt from 'jsonwebtoken';
import logger from './logger.js';
import { isAuthorizedForThread } from './chatHelpers.js';

// Route Handlers have no equivalent of Express's `app.set('io', io)` /
// `req.app.get('io')` — server.js stashes the one Socket.IO instance here
// once at boot, and ported controllers that need to emit (order placed,
// status changed, chat message) call getIo() instead. globalThis (not a
// module-level variable) specifically because Next.js may load this module
// more than once across its dev-mode module graph; a plain top-level `let`
// could end up as two different bindings, globalThis can't.
export const setIo = (io) => {
  globalThis.__socketIo = io;
};

export const getIo = () => globalThis.__socketIo ?? null;

/**
 * Ported unchanged from server/src/sockets/orderSocket.js, as part of the
 * plan Phase 10 decision to keep Socket.IO on a long-running host (not
 * migrate to Supabase Realtime) — real-time order/chat updates work exactly
 * as they did on the Express app.
 * @param {import('socket.io').Server} io
 */
export function initOrderSocket(io) {
  // Soft handshake auth: verifies the JWT if one is supplied, but still lets
  // unauthenticated sockets connect — connectivity_notifier.dart's pure
  // reachability probe relies on being able to connect with no token.
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        socket.userId = decoded.userId;
        socket.userRole = decoded.role || 'customer';
      }
      next();
    });
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, userId: socket.userId, role: socket.userRole });

    // Room membership is derived from the verified token, not client input.
    if (socket.userId) socket.join(`user-${socket.userId}`);
    if (socket.userRole === 'manager') socket.join('role-manager');
    if (socket.userRole === 'cook') socket.join('role-cook');

    // customerId is the chat thread's identity (one persistent thread per
    // customer, not per order).
    socket.on('join-chat-room', async (customerId) => {
      if (!customerId || !socket.userId) return;
      const allowed = await isAuthorizedForThread(customerId, socket.userId, socket.userRole);
      if (allowed) {
        socket.join(`chat-${customerId}`);
      } else {
        logger.warn('Rejected join-chat-room for non-participant', { socketId: socket.id, customerId });
      }
    });

    socket.on('leave-chat-room', (customerId) => {
      if (customerId) socket.leave(`chat-${customerId}`);
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });
}
