import { getRoomOrThrow, isValidHostToken } from '../services/roomService.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';

/**
 * REST host-auth middleware. Reads `Authorization: Bearer <hostToken>`, validates it
 * against the room identified by `:code`, and attaches the room to `req.room`.
 */
export async function hostAuth(req, _res, next) {
  try {
    const code = String(req.params.code || '').toUpperCase();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    const room = await getRoomOrThrow(code);
    if (!isValidHostToken(room, token)) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Invalid or missing host token');
    }
    req.room = room;
    next();
  } catch (err) {
    next(err);
  }
}
