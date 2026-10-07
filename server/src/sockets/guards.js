import { appError, ERROR_CODES } from '../utils/errors.js';

/** Reject if this socket has not been authenticated as the room host. */
export function requireHost(socket) {
  if (!socket.data?.isHost) {
    throw appError(ERROR_CODES.FORBIDDEN, 'Host privileges required');
  }
}

/** Reject if the socket has not joined a room yet. */
export function requireJoined(socket) {
  if (!socket.data?.roomCode) {
    throw appError(ERROR_CODES.ROOM_NOT_FOUND, 'Join a room first');
  }
  return socket.data.roomCode;
}
