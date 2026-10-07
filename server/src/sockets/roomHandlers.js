import { withAck } from '../utils/ack.js';
import { roomJoinSchema } from './schemas.js';
import { getRoomOrThrow, isValidHostToken, getRoomState } from '../services/roomService.js';
import { emitPresence } from './broadcast.js';
import { presenceCount, socketsFromIpInRoom } from './presence.js';
import { env } from '../config/env.js';
import { appError, ERROR_CODES } from '../utils/errors.js';
import { log } from '../utils/logger.js';

export function registerRoomHandlers(io, socket) {
  socket.on(
    'room:join',
    withAck(async (payload) => {
      const { code, clientId, hostToken } = roomJoinSchema.parse(payload || {});
      const room = await getRoomOrThrow(code);

      const isHost = isValidHostToken(room, hostToken);

      // Connection cap: max N concurrent sockets per IP per room (hosts exempt).
      // Only enforce on first join to this room so reconnect/resync never trips it.
      const alreadyInRoom = socket.rooms.has(code);
      if (!isHost && !alreadyInRoom) {
        const fromIp = await socketsFromIpInRoom(io, code, socket.data.ip);
        if (fromIp >= env.limits.maxSocketsPerIpPerRoom) {
          throw appError(ERROR_CODES.RATE_LIMITED, 'Too many connections from this device');
        }
      }

      // If re-joining a different room on the same socket, leave the old one first.
      const prev = socket.data.roomCode;
      if (prev && prev !== code) {
        socket.leave(prev);
        socket.leave(`${prev}:host`);
      }

      socket.data.clientId = clientId;
      socket.data.roomCode = code;
      socket.data.isHost = isHost;

      socket.join(code);
      if (isHost) socket.join(`${code}:host`);

      const state = await getRoomState(code, { clientId, isHost });

      // Presence = connected audience (non-host) sockets in the room.
      emitPresence(io, code, await presenceCount(io, code));

      log.info('room.join', { code, isHost, sid: socket.id });
      return state; // delivered via ack as room:state
    })
  );
}
