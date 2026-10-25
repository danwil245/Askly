import { withAck } from '../utils/ack.js';
import { roomJoinSchema } from './schemas.js';
import { getRoomByCodeOrThrow, getRoomState } from '../services/roomService.js';
import { ensureQaOrMentor } from '../services/roomLifecycleService.js';
import { emitPresence } from './broadcast.js';
import { presenceCount, socketsFromIpInRoom } from './presence.js';
import { env } from '../config/env.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { log } from '../utils/logger.js';

export function registerRoomHandlers(io, socket) {
  socket.on(
    'room:join',
    withAck(async (payload) => {
      const { code } = roomJoinSchema.parse(payload || {});
      const room = await getRoomByCodeOrThrow(code);
      ensureQaOrMentor(room); // quiz rooms join via quiz:* events

      // qa/mentor rooms require an authenticated socket.
      const user = socket.data.user;
      if (!user) throw appError(ERROR_CODES.UNAUTHENTICATED, 'Sign in to join this room');

      const isHost = String(room.ownerId) === String(user.id);

      // Person 3 — Anti-Spamming Security: Enforcement of maxSocketsPerIpPerRoom connection flood limit for campus Wi-Fi networks.
      const alreadyInRoom = socket.rooms.has(code);
      if (!isHost && !alreadyInRoom) {
        const fromIp = await socketsFromIpInRoom(io, code, socket.data.ip);
        if (fromIp >= env.limits.maxSocketsPerIpPerRoom) {
          throw appError(ERROR_CODES.RATE_LIMITED, 'Too many connections from this device');
        }
      }

      // Leaving a previously-joined room on the same socket.
      const prev = socket.data.roomCode;
      if (prev && prev !== code) {
        socket.leave(prev);
        socket.leave(`${prev}:host`);
      }

      socket.data.userId = user.id;
      socket.data.roomCode = code;
      socket.data.isHost = isHost;

      socket.join(code);
      if (isHost) socket.join(`${code}:host`);

      const state = await getRoomState(code, { userId: user.id, isHost });
      emitPresence(io, code, await presenceCount(io, code));

      log.info('room.join', { code, isHost, uid: user.id });
      return state; // delivered via ack as room:state
    })
  );
}
