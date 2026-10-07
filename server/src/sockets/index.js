import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerQuestionHandlers } from './questionHandlers.js';
import { registerPollHandlers } from './pollHandlers.js';
import { registerModerationHandlers } from './moderationHandlers.js';
import { emitPresence } from './broadcast.js';
import { presenceCount } from './presence.js';

/** Best-effort client IP, honoring a single proxy hop. */
function resolveIp(socket) {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return socket.handshake.address || 'unknown';
}

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, methods: ['GET', 'POST'] },
  });

  // Handshake auth: carry the anonymous clientId from `auth` (not a security boundary).
  io.use((socket, next) => {
    const clientId = socket.handshake.auth?.clientId;
    socket.data.clientId = typeof clientId === 'string' ? clientId : undefined;
    socket.data.ip = resolveIp(socket);
    next();
  });

  io.on('connection', (socket) => {
    log.info('socket.connected', { sid: socket.id });

    registerRoomHandlers(io, socket);
    registerQuestionHandlers(io, socket);
    registerPollHandlers(io, socket);
    registerModerationHandlers(io, socket);

    socket.on('disconnect', async (reason) => {
      const code = socket.data.roomCode;
      log.info('socket.disconnected', { sid: socket.id, reason });
      if (code) {
        // socket has already left its rooms by now; recompute presence for the room.
        try {
          emitPresence(io, code, await presenceCount(io, code));
        } catch {
          /* room may be empty; ignore */
        }
      }
    });
  });

  return io;
}
